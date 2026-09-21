begin;

-- Managed Supabase projects can retain an explicit ACL entry even for the
-- migration owner. Grant only the current trusted migration session.
do $$ begin execute format('grant usage, create on schema private to %I', current_user); end $$;

-- Discover behavior remains data driven. One school-specific category may be the
-- default, and submission capability is an explicit category property.
alter table public.categories add column if not exists is_discover_default boolean not null default false;
alter table public.categories add column if not exists accepts_submissions boolean not null default false;
create unique index if not exists categories_one_discover_default_per_school
  on public.categories(school_id) where is_discover_default and school_id is not null;

insert into public.categories(school_id,name,slug,description,icon,status,sort_order,is_discover_default,accepts_submissions)
select s.id,'Community','community','Student-submitted campus finds, reviewed before publication.','sparkles','active',0,true,true
from public.schools s where s.slug='duke-university'
on conflict(school_id,slug) do update set
  name=excluded.name,description=excluded.description,icon=excluded.icon,status='active',sort_order=0,
  is_discover_default=true,accepts_submissions=true;

-- Convert every existing score to the single 1-10 half-point scale. Existing
-- 1-5 ratings are doubled exactly; any nonstandard historic dimension is
-- normalized into the same range before its configuration is locked.
alter table private.reviews drop constraint if exists reviews_overall_rating_check;
alter table public.rating_dimensions drop constraint if exists rating_dimensions_min_value_check;
alter table public.rating_dimensions drop constraint if exists rating_dimensions_max_value_check;
alter table public.rating_dimensions drop constraint if exists rating_dimensions_check;
alter table private.reviews alter column overall_rating type numeric(3,1) using overall_rating::numeric;
alter table private.rating_values alter column score type numeric(3,1) using score::numeric;
alter table public.rating_dimensions alter column min_value type numeric(3,1) using min_value::numeric;
alter table public.rating_dimensions alter column max_value type numeric(3,1) using max_value::numeric;

update private.reviews set overall_rating=overall_rating*2 where overall_rating is not null;
update private.rating_values v set score=case
  when d.min_value=1 and d.max_value=5 then v.score*2
  else round((1 + 9*((v.score-d.min_value)/nullif(d.max_value-d.min_value,0)))*2)/2
end
from public.rating_dimensions d where d.id=v.rating_dimension_id;
update public.rating_dimensions set min_value=1,max_value=10;

alter table private.reviews add constraint reviews_overall_rating_check check(
  overall_rating is null or (overall_rating between 1 and 10 and mod(overall_rating*2,1)=0)
);
alter table private.rating_values add constraint rating_values_score_half_step check(
  score between 1 and 10 and mod(score*2,1)=0
);
alter table public.rating_dimensions add constraint rating_dimensions_ten_point_scale check(
  min_value=1 and max_value=10
);

alter table public.entities add column if not exists image_path text;
alter table public.entities add constraint entities_image_path_shape check(
  image_path is null or image_path ~ '^[0-9a-f-]{36}/image\.webp$'
);

create table private.entity_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references private.profiles(id),
  school_id uuid not null references public.schools(id),
  category_id uuid not null references public.categories(id),
  name text not null check(length(trim(name)) between 2 and 200),
  location_name text not null check(length(trim(location_name)) between 2 and 200),
  description text not null check(length(trim(description)) between 10 and 3000),
  image_path text not null check(image_path ~ '^[0-9a-f-]{36}/image\.webp$'),
  initial_overall_rating numeric(3,1) not null check(initial_overall_rating between 1 and 10 and mod(initial_overall_rating*2,1)=0),
  initial_review_body text not null default '' check(length(initial_review_body)<=3000),
  is_anonymous boolean not null default true,
  status text not null default 'draft' check(status in ('draft','pending','approved','rejected')),
  rejection_reason text not null default '' check(length(rejection_reason)<=1000),
  resume_status text check(resume_status in ('rejected')),
  reviewed_by uuid references private.profiles(id),
  reviewed_at timestamptz,
  entity_id uuid unique references public.entities(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  check(status<>'approved' or entity_id is not null)
);
create index entity_submissions_owner on private.entity_submissions(user_id,created_at desc);
create index entity_submissions_queue on private.entity_submissions(status,submitted_at);
create trigger touch_updated before update on private.entity_submissions for each row execute function private.touch_updated();

alter table private.entity_submissions enable row level security;
create policy submissions_read on private.entity_submissions for select
  using(user_id=private.request_user_id() or private.is_admin() or status='approved');
create policy submissions_insert on private.entity_submissions for insert
  with check(user_id=private.request_user_id() and private.can_contribute(school_id));
create policy submissions_owner_update on private.entity_submissions for update
  using(user_id=private.request_user_id() and private.is_active_user())
  with check(user_id=private.request_user_id() and private.is_active_user());
create policy submissions_admin_update on private.entity_submissions for update
  using(private.is_admin()) with check(private.is_admin());
create policy submissions_owner_delete on private.entity_submissions for delete
  using(user_id=private.request_user_id() and status='draft');

grant select,insert,update,delete on private.entity_submissions to rateduke_api;
revoke all on private.entity_submissions from public,anon,authenticated;

-- Approving a submission inserts the student's first review. This remains
-- admin-only and does not weaken ordinary user insert ownership.
drop policy if exists reviews_insert on private.reviews;
create policy reviews_insert on private.reviews for insert with check(
  private.is_admin() or
  (user_id=private.request_user_id() and exists(
    select 1 from public.entities e where e.id=entity_id and e.status='active' and private.can_contribute(e.school_id)
  ))
);

create or replace function private.account_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,'email',p.email,'nickname',p.nickname,'verified',p.verified,'role',a.role,'suspended',a.suspended,
  'created_at',p.created_at,'updated_at',p.updated_at,'last_sign_in_at',p.last_sign_in_at,
  'review_count',(select count(*) from private.reviews r where r.user_id=p.id and r.deleted_at is null),
  'response_count',(select count(*) from private.question_responses qr where qr.user_id=p.id),
  'submission_count',(select count(*) from private.entity_submissions es where es.user_id=p.id and es.status<>'draft')
 ) from private.profiles p join private.account_roles a on a.user_id=p.id where p.id=p_id
$$;

-- Existing RPCs are owned by the deliberately constrained API role. Assume
-- that role only while replacing its functions, then revoke CREATE again.
grant create on schema public,private to rateduke_api;
set local role rateduke_api;

create or replace function private.valid_ten_point_score(p_score numeric) returns boolean
language sql immutable set search_path='' as $$
  select p_score between 1 and 10 and mod(p_score*2,1)=0
$$;

create function private.submission_json(p_id uuid,p_internal boolean default false) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',s.id,'school_id',s.school_id,'category_id',s.category_id,'name',s.name,
    'location_name',s.location_name,'description',s.description,'image_path',s.image_path,
    'initial_overall_rating',s.initial_overall_rating,'initial_review_body',s.initial_review_body,
    'is_anonymous',s.is_anonymous,'status',s.status,'rejection_reason',s.rejection_reason,
    'entity_id',s.entity_id,'created_at',s.created_at,'updated_at',s.updated_at,'submitted_at',s.submitted_at,
    'reviewed_at',s.reviewed_at
  ) || case when p_internal and private.is_admin() then jsonb_build_object(
    'account_id',s.user_id,'author_email',p.email,'reviewed_by',s.reviewed_by
  ) else '{}'::jsonb end
  from private.entity_submissions s join private.profiles p on p.id=s.user_id where s.id=p_id
$$;

create function public.begin_entity_submission(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id(); sid uuid; existing private.entity_submissions; v_school_id uuid; v_category_id uuid; score numeric;
begin
  if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>20000 then raise exception 'Invalid submission.';end if;
  v_school_id:=(p_data->>'school_id')::uuid;score:=(p_data->>'initial_overall_rating')::numeric;
  if not private.can_contribute(v_school_id) then raise exception 'Use a verified email from this school to contribute.';end if;
  select c.id into v_category_id from public.categories c
   where c.school_id=v_school_id and c.status='active' and c.accepts_submissions order by c.is_discover_default desc,c.sort_order limit 1;
  if v_category_id is null then raise exception 'Community submissions are not enabled for this school.';end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 2 and 200 then raise exception 'Enter a name between 2 and 200 characters.';end if;
  if length(trim(coalesce(p_data->>'location_name',''))) not between 2 and 200 then raise exception 'Enter a campus location.';end if;
  if length(trim(coalesce(p_data->>'description',''))) not between 10 and 3000 then raise exception 'Describe this campus find in 10 to 3,000 characters.';end if;
  if length(coalesce(p_data->>'initial_review_body',''))>3000 then raise exception 'Keep the review under 3,000 characters.';end if;
  if not private.valid_ten_point_score(score) then raise exception 'Choose a rating from 1.0 to 10.0 in half-point steps.';end if;
  perform private.consume_limit('entity_submission',5);
  sid:=nullif(p_data->>'id','')::uuid;
  if sid is not null then
    select * into existing from private.entity_submissions where id=sid and user_id=uid for update;
    if not found or existing.status<>'rejected' then raise exception 'Only a rejected submission can be edited and resubmitted.';end if;
    update private.entity_submissions set school_id=v_school_id,category_id=v_category_id,name=trim(p_data->>'name'),
      location_name=trim(p_data->>'location_name'),description=trim(p_data->>'description'),
      initial_overall_rating=score,initial_review_body=trim(coalesce(p_data->>'initial_review_body','')),
      is_anonymous=coalesce((p_data->>'is_anonymous')::boolean,true),status='draft',resume_status='rejected',
      reviewed_by=null,reviewed_at=null
    where id=sid;
  else
    sid:=gen_random_uuid();
    insert into private.entity_submissions(id,user_id,school_id,category_id,name,location_name,description,image_path,
      initial_overall_rating,initial_review_body,is_anonymous)
    values(sid,uid,v_school_id,v_category_id,trim(p_data->>'name'),trim(p_data->>'location_name'),trim(p_data->>'description'),
      sid::text||'/image.webp',score,trim(coalesce(p_data->>'initial_review_body','')),coalesce((p_data->>'is_anonymous')::boolean,true));
  end if;
  return jsonb_build_object('id',sid,'path',sid::text||'/image.webp');
end $$;

create function public.finalize_entity_submission(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
begin
  update private.entity_submissions set status='pending',resume_status=null,rejection_reason='',submitted_at=now()
  where id=p_id and user_id=private.request_user_id() and status='draft';
  if not found then raise exception 'Submission draft not found.';end if;
  return 'Submission sent for review.';
end $$;

create function public.cancel_entity_submission(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from private.entity_submissions where id=p_id and user_id=private.request_user_id() and status='draft' and resume_status is null;
  if not found then
    update private.entity_submissions set status='rejected',resume_status=null
    where id=p_id and user_id=private.request_user_id() and status='draft' and resume_status='rejected';
  end if;
end $$;

-- Add half-point reviews and submission moderation without weakening the
-- established command surface for the rest of the application.
alter function public.app_command(text,jsonb) rename to app_command_before_community;
revoke all on function public.app_command_before_community(text,jsonb) from public,anon,authenticated;

create function public.app_command(p_action text,p_data jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id(); eid uuid; rid uuid; did uuid; score numeric; v jsonb; ids uuid[]:=array[]::uuid[];
  e public.entities; d public.rating_dimensions; v_review_id uuid; review_status text; sub private.entity_submissions;
  base_slug text; final_slug text; created_entity uuid; message text; target_category uuid;
begin
  if p_action='save_review' then
    if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
    eid:=(p_data->>'entity_id')::uuid;
    select * into e from public.entities where id=eid and status='active';
    if not found or not private.can_contribute(e.school_id) or not exists(select 1 from public.categories where id=e.category_id and status='active') then raise exception 'Use a verified email from this school to contribute.';end if;
    if jsonb_typeof(p_data->'values') is distinct from 'array' or jsonb_array_length(p_data->'values')>50 then raise exception 'Invalid rating values.';end if;
    score:=nullif(p_data->>'overall_rating','')::numeric;
    if score is not null and not private.valid_ten_point_score(score) then raise exception 'Choose a rating from 1.0 to 10.0 in half-point steps.';end if;
    if score is null and jsonb_array_length(p_data->'values')=0 then raise exception 'Add at least one rating.';end if;
    for v in select * from jsonb_array_elements(p_data->'values') loop
      did:=(v->>'rating_dimension_id')::uuid;score:=(v->>'score')::numeric;
      if did=any(ids) then raise exception 'Each dimension may be rated only once.';end if;
      ids:=array_append(ids,did);select * into d from public.rating_dimensions where id=did and category_id=e.category_id and is_active;
      if not found or not private.valid_ten_point_score(score) then raise exception 'A rating is outside the 1-10 half-point scale. Refresh the form and try again.';end if;
    end loop;
    if exists(select 1 from public.rating_dimensions where category_id=e.category_id and is_active and is_required and not(id=any(ids))) then raise exception 'Please complete all required rating dimensions.';end if;
    perform private.consume_limit('review',20);
    insert into private.reviews(entity_id,user_id,overall_rating,body,is_anonymous)
    values(eid,uid,nullif(p_data->>'overall_rating','')::numeric,trim(coalesce(p_data->>'body','')),coalesce((p_data->>'is_anonymous')::boolean,true))
    on conflict(user_id,entity_id) do update set overall_rating=excluded.overall_rating,body=excluded.body,is_anonymous=excluded.is_anonymous,deleted_at=null
    returning id,status into v_review_id,review_status;
    delete from private.rating_values rv using public.rating_dimensions rd where rv.review_id=v_review_id and rv.rating_dimension_id=rd.id and rd.is_active;
    for v in select * from jsonb_array_elements(p_data->'values') loop
      insert into private.rating_values(review_id,rating_dimension_id,score) values(v_review_id,(v->>'rating_dimension_id')::uuid,(v->>'score')::numeric);
    end loop;
    return case when review_status='hidden' then 'Review saved. It remains hidden pending moderation.' else 'Your review has been saved.' end;
  elsif p_action='review_submission' then
    if not private.is_admin() then raise exception 'Administrator access required.';end if;
    rid:=(p_data->>'id')::uuid;select * into sub from private.entity_submissions where id=rid for update;
    if not found or sub.status<>'pending' then raise exception 'Pending submission not found.';end if;
    if p_data->>'decision'='rejected' then
      if length(trim(coalesce(p_data->>'rejection_reason',''))) not between 3 and 1000 then raise exception 'Add a clear rejection reason.';end if;
      update private.entity_submissions set status='rejected',rejection_reason=trim(p_data->>'rejection_reason'),reviewed_by=uid,reviewed_at=now() where id=rid;
      insert into private.audit_log(actor_id,action,target_id) values(uid,'reject_entity_submission',rid);
      return 'Submission rejected with feedback.';
    elsif p_data->>'decision'<>'approved' then raise exception 'Choose approve or reject.';end if;
    base_slug:=trim(both '-' from lower(regexp_replace(sub.name,'[^a-zA-Z0-9]+','-','g')));
    if base_slug='' then base_slug:='community-find';end if;
    final_slug:=left(base_slug,90);
    if exists(select 1 from public.entities where slug=final_slug) then final_slug:=left(base_slug,80)||'-'||left(replace(rid::text,'-',''),8);end if;
    created_entity:=gen_random_uuid();
    insert into public.entities(id,school_id,category_id,name,slug,short_description,description,location_name,image_path,status,is_featured)
    values(created_entity,sub.school_id,sub.category_id,sub.name,final_slug,left(sub.description,250),sub.description,sub.location_name,sub.image_path,'active',false);
    insert into private.reviews(entity_id,user_id,overall_rating,body,is_anonymous)
    values(created_entity,sub.user_id,sub.initial_overall_rating,sub.initial_review_body,sub.is_anonymous);
    update private.entity_submissions set status='approved',entity_id=created_entity,rejection_reason='',reviewed_by=uid,reviewed_at=now() where id=rid;
    insert into private.audit_log(actor_id,action,target_id) values(uid,'approve_entity_submission',rid);
    return 'Submission approved and published.';
  elsif p_action='save_category' then
    message:=public.app_command_before_community(p_action,p_data);
    select c.id into target_category from public.categories c
    where c.slug=p_data->>'slug' and c.school_id is not distinct from nullif(p_data->>'school_id','')::uuid;
    update public.categories set
      is_discover_default=false,
      accepts_submissions=coalesce((p_data->>'accepts_submissions')::boolean,false)
    where id=target_category;
    if coalesce((p_data->>'is_discover_default')::boolean,false) then
      update public.categories set is_discover_default=false
      where id<>target_category and school_id is not distinct from nullif(p_data->>'school_id','')::uuid;
      update public.categories set is_discover_default=true where id=target_category;
    end if;
    return message;
  elsif p_action='save_dimension' then
    return public.app_command_before_community(p_action,p_data||jsonb_build_object('min_value',1,'max_value',10));
  end if;
  return public.app_command_before_community(p_action,p_data);
end $$;

create or replace function public.get_app_data() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'schools',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.schools s),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.categories c),'[]'::jsonb),
 'entities',coalesce((select jsonb_agg(to_jsonb(e)) from public.entities e),'[]'::jsonb),
 'dimensions',coalesce((select jsonb_agg(to_jsonb(d) order by d.sort_order) from public.rating_dimensions d),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(private.review_json(r.id,private.is_staff()) order by r.created_at desc) from private.reviews r where r.deleted_at is null and (private.is_staff() or (r.status='published' and exists(select 1 from public.entities e where e.id=r.entity_id and e.status='active')))),'[]'::jsonb),
 'own_reviews',coalesce((select jsonb_agg(private.review_json(r.id,false)) from private.reviews r where r.user_id=private.request_user_id() and r.deleted_at is null),'[]'::jsonb),
 'own_submissions',coalesce((select jsonb_agg(private.submission_json(s.id,false) order by s.created_at desc) from private.entity_submissions s where s.user_id=private.request_user_id() and s.status<>'draft'),'[]'::jsonb),
 'admin_submissions',case when private.is_admin() then coalesce((select jsonb_agg(private.submission_json(s.id,true) order by s.created_at desc) from private.entity_submissions s where s.status<>'draft'),'[]'::jsonb) else '[]'::jsonb end,
 'accounts',case when private.is_staff() then coalesce((select jsonb_agg(private.account_json(p.id)) from private.profiles p),'[]'::jsonb) else '[]'::jsonb end,
 'reports',case when private.is_staff() then coalesce((select jsonb_agg(to_jsonb(r)) from private.reports r),'[]'::jsonb) else '[]'::jsonb end,
 'audit',case when private.is_staff() then coalesce((select jsonb_agg(to_jsonb(a)) from (select * from private.audit_log order by created_at desc limit 100) a),'[]'::jsonb) else '[]'::jsonb end,
 'questions',coalesce((select jsonb_agg(private.question_json(q.id) order by q.sort_order,q.created_at) from public.questions q where private.is_staff() or q.status not in ('draft','archived')),'[]'::jsonb),
 'viewer',private.account_json(private.request_user_id()))
$$;

-- Storage is present on hosted Supabase, while the portable PGlite contract
-- intentionally omits it. Install the bucket and policies only where available.
create function public.can_read_submission_image(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.entity_submissions s where s.image_path=p_name and (
    s.user_id=private.request_user_id() or private.is_admin() or
    (s.status='approved' and exists(select 1 from public.entities e where e.id=s.entity_id and e.status='active'))
  ))
$$;
create function public.can_write_submission_image(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.entity_submissions s where s.image_path=p_name and s.user_id=private.request_user_id() and s.status='draft')
$$;

revoke all on function private.valid_ten_point_score(numeric),private.submission_json(uuid,boolean) from public,anon,authenticated;
grant execute on function private.valid_ten_point_score(numeric),private.submission_json(uuid,boolean) to rateduke_api;
revoke all on function public.begin_entity_submission(jsonb),public.finalize_entity_submission(uuid),public.cancel_entity_submission(uuid),
  public.app_command(text,jsonb),public.can_read_submission_image(text),public.can_write_submission_image(text) from public,anon,authenticated;
grant execute on function public.begin_entity_submission(jsonb),public.finalize_entity_submission(uuid),public.cancel_entity_submission(uuid),public.app_command(text,jsonb) to authenticated;
grant execute on function public.can_read_submission_image(text) to anon,authenticated;
grant execute on function public.can_write_submission_image(text) to authenticated;
grant execute on function public.get_app_data() to anon,authenticated;
grant execute on function public.app_command_before_community(text,jsonb) to rateduke_api;

reset role;
revoke create on schema public,private from rateduke_api;

do $$ begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    execute $sql$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('entity-images','entity-images',false,5242880,array['image/jpeg','image/png','image/webp'])
      on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types$sql$;
    execute 'drop policy if exists rateduke_submission_images_read on storage.objects';
    execute 'drop policy if exists rateduke_submission_images_insert on storage.objects';
    execute 'drop policy if exists rateduke_submission_images_delete_draft on storage.objects';
    execute $sql$create policy rateduke_submission_images_read on storage.objects for select to anon,authenticated
      using(bucket_id='entity-images' and public.can_read_submission_image(name))$sql$;
    execute $sql$create policy rateduke_submission_images_insert on storage.objects for insert to authenticated
      with check(bucket_id='entity-images' and public.can_write_submission_image(name))$sql$;
    execute $sql$create policy rateduke_submission_images_delete_draft on storage.objects for delete to authenticated
      using(bucket_id='entity-images' and public.can_write_submission_image(name))$sql$;
  end if;
end $$;

commit;
