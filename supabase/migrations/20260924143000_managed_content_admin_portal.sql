begin;

-- Managed projects can retain an explicit ACL entry even for the migration owner.
do $$ begin execute format('grant usage, create on schema private to %I', current_user); end $$;

-- Generalize the existing editorial bylines without breaking seeded forum history.
alter table private.forum_editorial_identities add column if not exists school_id uuid references public.schools(id);
alter table private.forum_editorial_identities add column if not exists status text not null default 'active' check(status in ('active','archived'));
alter table private.forum_editorial_identities add column if not exists created_by uuid references private.profiles(id);
alter table private.forum_editorial_identities add column if not exists updated_at timestamptz not null default now();
update private.forum_editorial_identities set school_id=(select id from public.schools where slug='duke-university' limit 1) where school_id is null;
alter table private.forum_editorial_identities alter column school_id set not null;
alter table private.forum_editorial_identities drop constraint if exists forum_editorial_identities_name_key;
create unique index if not exists managed_identity_school_name_unique on private.forum_editorial_identities(school_id,lower(name));
create policy managed_identity_admin_insert on private.forum_editorial_identities for insert with check(private.is_admin());
create policy managed_identity_admin_update on private.forum_editorial_identities for update using(private.is_admin()) with check(private.is_admin());

-- Reviews have exactly one author: a real account or a managed publishing identity.
alter table private.reviews alter column user_id drop not null;
alter table private.reviews add column if not exists managed_identity_id uuid references private.forum_editorial_identities(id);
alter table private.reviews drop constraint if exists reviews_status_check;
alter table private.reviews add constraint reviews_status_check check(status in ('draft','published','hidden'));
alter table private.reviews add constraint reviews_author_xor check((user_id is not null)::integer+(managed_identity_id is not null)::integer=1);
create unique index if not exists reviews_managed_entity_unique on private.reviews(managed_identity_id,entity_id) where managed_identity_id is not null;
create policy reviews_managed_admin_insert on private.reviews for insert with check(private.is_admin() and user_id is null and managed_identity_id is not null);
create policy values_managed_admin_insert on private.rating_values for insert with check(private.is_admin() and exists(select 1 from private.reviews r where r.id=review_id and r.managed_identity_id is not null));
create policy values_managed_admin_delete on private.rating_values for delete using(private.is_admin() and exists(select 1 from private.reviews r where r.id=review_id and r.managed_identity_id is not null));
create policy forum_posts_managed_admin_insert on private.forum_posts for insert with check(private.is_admin() and author_user_id is null and editorial_identity_id is not null and status='draft');
create policy forum_images_managed_admin_insert on private.forum_post_images for insert with check(private.is_admin() and exists(select 1 from private.forum_posts p where p.id=post_id and p.status='draft' and p.editorial_identity_id is not null));
create policy forum_images_managed_admin_update on private.forum_post_images for update using(private.is_admin() and exists(select 1 from private.forum_posts p where p.id=post_id and p.status='draft' and p.editorial_identity_id is not null));

create or replace function private.review_json(p_id uuid,p_internal boolean default false) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',r.id,'entity_id',r.entity_id,'overall_rating',r.overall_rating,'body',r.body,'is_anonymous',r.is_anonymous,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
 'public_identity',case when r.managed_identity_id is not null then m.name when r.is_anonymous then 'Anonymous Student' else p.nickname end,
 'verified',case when r.managed_identity_id is not null then false else coalesce(p.verified,false) end,
 'values',coalesce((select jsonb_agg(jsonb_build_object('review_id',v.review_id,'rating_dimension_id',v.rating_dimension_id,'score',v.score)) from private.rating_values v where v.review_id=r.id),'[]'::jsonb))
 || case when p_internal and private.is_admin() and r.user_id is not null then jsonb_build_object('account_id',r.user_id)
         when p_internal and private.is_admin() and r.managed_identity_id is not null then jsonb_build_object('managed_identity_id',r.managed_identity_id) else '{}'::jsonb end
 from private.reviews r left join private.profiles p on p.id=r.user_id left join private.forum_editorial_identities m on m.id=r.managed_identity_id
 where r.id=p_id and r.deleted_at is null
$$;

alter function public.app_command(text,jsonb) rename to app_command_before_managed_content;
revoke all on function public.app_command_before_managed_content(text,jsonb) from public,anon,authenticated;
create function public.app_command(p_action text,p_data jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();mid uuid;eid uuid;rid uuid;v jsonb;did uuid;score numeric;ids uuid[]:=array[]::uuid[];e public.entities;d public.rating_dimensions;publish boolean;
begin
 if p_action not in ('save_managed_identity','save_managed_review','archive_managed_review') then return public.app_command_before_managed_content(p_action,p_data);end if;
 if not private.is_admin() then raise exception 'Administrator access required.';end if;
 if p_action='archive_managed_review' then rid:=(p_data->>'id')::uuid;update private.reviews set deleted_at=now() where id=rid and managed_identity_id is not null and deleted_at is null;if not found then raise exception 'Managed review not found.';end if;insert into private.audit_log(actor_id,action,target_id) values(uid,'archive_managed_review',rid);return 'Managed review archived.';end if;
 if p_action='save_managed_identity' then
  mid:=nullif(p_data->>'id','')::uuid;
  if length(trim(coalesce(p_data->>'name',''))) not between 2 and 60 then raise exception 'Contributor usernames must be between 2 and 60 characters.';end if;
  if p_data->>'status' not in ('active','archived') then raise exception 'Invalid contributor status.';end if;
  if not exists(select 1 from public.schools where id=(p_data->>'school_id')::uuid) then raise exception 'School not found.';end if;
  if mid is null then insert into private.forum_editorial_identities(school_id,name,status,seeded,created_by) values((p_data->>'school_id')::uuid,trim(p_data->>'name'),p_data->>'status',false,uid) returning id into mid;
  else update private.forum_editorial_identities set school_id=(p_data->>'school_id')::uuid,name=trim(p_data->>'name'),status=p_data->>'status',updated_at=now() where id=mid;if not found then raise exception 'Contributor profile not found.';end if;end if;
  insert into private.audit_log(actor_id,action,target_id) values(uid,case when p_data->>'status'='archived' then 'archive_managed_identity' else 'save_managed_identity' end,mid);return 'Contributor profile saved.';
 end if;
 mid:=(p_data->>'managed_identity_id')::uuid;eid:=(p_data->>'entity_id')::uuid;publish:=coalesce((p_data->>'publish')::boolean,false);
 select * into e from public.entities where id=eid; if not found then raise exception 'Entity not found.';end if;
 if not exists(select 1 from private.forum_editorial_identities where id=mid and school_id=e.school_id and status='active') then raise exception 'Choose an active contributor profile from the same school.';end if;
 if jsonb_typeof(p_data->'values') is distinct from 'array' or jsonb_array_length(p_data->'values')>50 then raise exception 'Invalid rating values.';end if;
 score:=nullif(p_data->>'overall_rating','')::numeric;if score is not null and not private.valid_ten_point_score(score) then raise exception 'Choose a rating from 1.0 to 10.0 in half-point steps.';end if;
 for v in select * from jsonb_array_elements(p_data->'values') loop did:=(v->>'rating_dimension_id')::uuid;score:=(v->>'score')::numeric;if did=any(ids) then raise exception 'Each dimension may be rated only once.';end if;ids:=array_append(ids,did);select * into d from public.rating_dimensions where id=did and category_id=e.category_id and is_active;if not found or not private.valid_ten_point_score(score) then raise exception 'A rating is outside the configured scale.';end if;end loop;
 if publish and nullif(p_data->>'overall_rating','') is null and jsonb_array_length(p_data->'values')=0 then raise exception 'Add at least one rating.';end if;
 if publish and exists(select 1 from public.rating_dimensions where category_id=e.category_id and is_active and is_required and not(id=any(ids))) then raise exception 'Please complete all required rating dimensions.';end if;
 select id into rid from private.reviews where managed_identity_id=mid and entity_id=eid and deleted_at is null;
 if rid is null then insert into private.reviews(entity_id,user_id,managed_identity_id,overall_rating,body,is_anonymous,status) values(eid,null,mid,nullif(p_data->>'overall_rating','')::numeric,trim(coalesce(p_data->>'body','')),false,case when publish then 'published' else 'draft' end) returning id into rid;
 else update private.reviews set overall_rating=nullif(p_data->>'overall_rating','')::numeric,body=trim(coalesce(p_data->>'body','')),status=case when publish then 'published' else 'draft' end,deleted_at=null where id=rid;delete from private.rating_values where review_id=rid;end if;
 for v in select * from jsonb_array_elements(p_data->'values') loop insert into private.rating_values(review_id,rating_dimension_id,score) values(rid,(v->>'rating_dimension_id')::uuid,(v->>'score')::numeric);end loop;
 insert into private.audit_log(actor_id,action,target_id) values(uid,case when publish then 'publish_managed_review' else 'save_managed_review_draft' end,rid);return case when publish then 'Managed review published.' else 'Managed review draft saved.' end;
end $$;

create or replace function public.begin_forum_post(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();pid uuid:=gen_random_uuid();iid uuid;mid uuid:=nullif(p_data->>'managed_identity_id','')::uuid;school uuid;cover_index integer;images jsonb;item jsonb;idx integer:=0;slots jsonb:='[]'::jsonb;
begin
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;school:=(p_data->>'school_id')::uuid;images:=p_data->'images';cover_index:=(p_data->>'cover_index')::integer;
 if mid is not null then if not private.is_admin() or not exists(select 1 from private.forum_editorial_identities where id=mid and school_id=school and status='active') then raise exception 'Administrator access and an active contributor profile are required.';end if;
 elsif not private.can_contribute(school) then raise exception 'Use a verified email from this school to create a post.';end if;
 if length(trim(coalesce(p_data->>'title',''))) not between 3 and 160 or length(trim(coalesce(p_data->>'body',''))) not between 1 and 6000 then raise exception 'Add a title and post text.';end if;
 if jsonb_typeof(images)<>'array' or jsonb_array_length(images) not between 1 and 9 or cover_index not between 0 and jsonb_array_length(images)-1 then raise exception 'Add between one and nine images and choose a cover.';end if;
 if mid is null then perform private.consume_limit('forum_post',5);end if;perform pg_advisory_xact_lock(hashtextextended('rateduke:forum:'||uid::text,0));
 insert into private.forum_posts(id,school_id,author_user_id,editorial_identity_id,title,body,status) values(pid,school,case when mid is null then uid end,mid,trim(p_data->>'title'),trim(p_data->>'body'),'draft');
 for item in select * from jsonb_array_elements(images) loop iid:=gen_random_uuid();insert into private.forum_post_images(id,post_id,storage_path,sort_order,width,height) values(iid,pid,uid::text||'/'||pid::text||'/'||iid::text||'.webp',idx,(item->>'width')::integer,(item->>'height')::integer);slots:=slots||jsonb_build_array(jsonb_build_object('id',iid,'index',idx,'path',uid::text||'/'||pid::text||'/'||iid::text||'.webp'));if idx=cover_index then update private.forum_posts set cover_image_id=iid where id=pid;end if;idx:=idx+1;end loop;
 if mid is not null then insert into private.audit_log(actor_id,action,target_id) values(uid,'save_managed_forum_draft',pid);end if;return jsonb_build_object('id',pid,'images',slots);
end $$;
create or replace function public.mark_forum_image_ready(p_id uuid,p_width integer,p_height integer) returns void language plpgsql security definer set search_path='' as $$begin update private.forum_post_images i set status='ready',width=p_width,height=p_height from private.forum_posts p where i.id=p_id and p.id=i.post_id and p.status='draft' and (p.author_user_id=private.request_user_id() or (p.editorial_identity_id is not null and private.is_admin()));if not found then raise exception 'Upload slot not found.';end if;end $$;
create or replace function public.finalize_forum_post(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare managed boolean;begin select editorial_identity_id is not null into managed from private.forum_posts where id=p_id;update private.forum_posts p set status='published',published_at=now() where p.id=p_id and p.status='draft' and (p.author_user_id=private.request_user_id() or (p.editorial_identity_id is not null and private.is_admin())) and p.cover_image_id is not null and exists(select 1 from private.forum_post_images i where i.id=p.cover_image_id and i.status='ready') and not exists(select 1 from private.forum_post_images i where i.post_id=p.id and i.status<>'ready');if not found then raise exception 'Finish uploading every image before publishing.';end if;if managed then insert into private.audit_log(actor_id,action,target_id) values(private.request_user_id(),'publish_managed_forum_post',p_id);end if;return p_id;end $$;
create or replace function public.get_forum_draft_paths(p_id uuid) returns text[] language sql stable security definer set search_path='' as $$select coalesce(array_agg(i.storage_path),'{}') from private.forum_post_images i join private.forum_posts p on p.id=i.post_id where p.id=p_id and p.status='draft' and (p.author_user_id=private.request_user_id() or (p.editorial_identity_id is not null and private.is_admin()))$$;
create or replace function public.cancel_forum_post(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin delete from private.forum_posts where id=p_id and status='draft' and (author_user_id=private.request_user_id() or (editorial_identity_id is not null and private.is_admin()));end $$;
create or replace function public.can_write_forum_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$select split_part(p_name,'/',1)=private.request_user_id()::text and exists(select 1 from private.forum_post_images i join private.forum_posts p on p.id=i.post_id where i.storage_path=p_name and p.status='draft' and (p.author_user_id=private.request_user_id() or (p.editorial_identity_id is not null and private.is_admin())))$$;

create or replace function public.get_app_data() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'schools',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.schools s),'[]'::jsonb),'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.categories c),'[]'::jsonb),'entities',coalesce((select jsonb_agg(to_jsonb(e)) from public.entities e),'[]'::jsonb),'dimensions',coalesce((select jsonb_agg(to_jsonb(d) order by d.sort_order) from public.rating_dimensions d),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(private.review_json(r.id,private.is_admin()) order by r.created_at desc) from private.reviews r where r.deleted_at is null and (private.is_staff() or (r.status='published' and exists(select 1 from public.entities e where e.id=r.entity_id and e.status='active')))),'[]'::jsonb),
 'own_reviews',coalesce((select jsonb_agg(private.review_json(r.id,false)) from private.reviews r where r.user_id=private.request_user_id() and r.deleted_at is null),'[]'::jsonb),
 'own_submissions',coalesce((select jsonb_agg(private.submission_json(s.id,false) order by s.created_at desc) from private.entity_submissions s where s.user_id=private.request_user_id() and s.status<>'draft'),'[]'::jsonb),'admin_submissions',case when private.is_admin() then coalesce((select jsonb_agg(private.submission_json(s.id,true) order by s.created_at desc) from private.entity_submissions s where s.status<>'draft'),'[]'::jsonb) else '[]'::jsonb end,
 'accounts',case when private.is_staff() then coalesce((select jsonb_agg(private.account_json(p.id)) from private.profiles p),'[]'::jsonb) else '[]'::jsonb end,'reports',case when private.is_staff() then coalesce((select jsonb_agg(to_jsonb(r)) from private.reports r),'[]'::jsonb) else '[]'::jsonb end,'audit',case when private.is_admin() then coalesce((select jsonb_agg(to_jsonb(a)) from (select * from private.audit_log order by created_at desc limit 100) a),'[]'::jsonb) else '[]'::jsonb end,'questions',coalesce((select jsonb_agg(private.question_json(q.id) order by q.sort_order,q.created_at) from public.questions q where private.is_staff() or q.status not in ('draft','archived')),'[]'::jsonb),
 'managed_identities',case when private.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'school_id',m.school_id,'name',m.name,'status',m.status,'seeded',m.seeded,'created_by',m.created_by,'created_at',m.created_at,'updated_at',m.updated_at,'review_count',(select count(*) from private.reviews r where r.managed_identity_id=m.id and r.deleted_at is null),'post_count',(select count(*) from private.forum_posts p where p.editorial_identity_id=m.id and p.status<>'deleted')) order by m.created_at) from private.forum_editorial_identities m),'[]'::jsonb) else '[]'::jsonb end,
 'managed_review_drafts',case when private.is_admin() then coalesce((select jsonb_agg(private.review_json(r.id,true) order by r.updated_at desc) from private.reviews r where r.managed_identity_id is not null and r.status='draft' and r.deleted_at is null),'[]'::jsonb) else '[]'::jsonb end,
 'managed_forum_drafts',case when private.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'school_id',p.school_id,'managed_identity_id',p.editorial_identity_id,'title',p.title,'body',p.body,'status',p.status,'cover_image_id',p.cover_image_id,'image_count',(select count(*) from private.forum_post_images i where i.post_id=p.id),'created_at',p.created_at,'updated_at',p.updated_at)) from private.forum_posts p where p.editorial_identity_id is not null and p.status='draft'),'[]'::jsonb) else '[]'::jsonb end,
 'admin_summary',case when private.is_admin() then jsonb_build_object('active_users',(select count(*) from private.profiles p join private.account_roles a on a.user_id=p.id where p.verified and not a.suspended),'managed_profiles',(select count(*) from private.forum_editorial_identities where status='active'),'managed_reviews',(select count(*) from private.reviews where managed_identity_id is not null and deleted_at is null and status in ('published','hidden')),'managed_forum_posts',(select count(*) from private.forum_posts where editorial_identity_id is not null and deleted_at is null and status in ('published','hidden')),'total_reviews',(select count(*) from private.reviews where deleted_at is null and status in ('published','hidden')),'review_drafts',(select count(*) from private.reviews where deleted_at is null and status='draft'),'total_forum_posts',(select count(*) from private.forum_posts where deleted_at is null and status in ('published','hidden')),'forum_drafts',(select count(*) from private.forum_posts where deleted_at is null and status='draft'),'campus_entities',(select count(*) from public.entities where status='active'),'open_reports',(select count(*) from private.reports where status='pending'),'pending_submissions',(select count(*) from private.entity_submissions where status='pending')) else null end,
 'viewer',private.account_json(private.request_user_id()))
$$;

alter function public.app_command(text,jsonb) owner to rateduke_api;alter function public.begin_forum_post(jsonb) owner to rateduke_api;alter function public.mark_forum_image_ready(uuid,integer,integer) owner to rateduke_api;alter function public.finalize_forum_post(uuid) owner to rateduke_api;alter function public.get_forum_draft_paths(uuid) owner to rateduke_api;alter function public.cancel_forum_post(uuid) owner to rateduke_api;alter function public.can_write_forum_image(text) owner to rateduke_api;alter function public.get_app_data() owner to rateduke_api;
revoke all on function public.app_command_before_managed_content(text,jsonb),public.app_command(text,jsonb) from public,anon,authenticated;grant execute on function public.app_command_before_managed_content(text,jsonb) to rateduke_api;grant execute on function public.app_command(text,jsonb) to authenticated;

commit;
