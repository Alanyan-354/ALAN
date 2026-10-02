begin;

do $$ begin execute format('grant usage, create on schema private to %I', current_user); end $$;

create table public.tags(
 id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id),
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=30),
 label text not null check(length(trim(label)) between 2 and 40),description text not null default '' check(length(description)<=500),
 kind text not null check(kind in ('official','custom')),status text not null default 'active' check(status in ('active','archived')),
 created_by uuid references private.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique nulls not distinct(school_id,slug),check((kind='official' and school_id is null and created_by is null) or (kind='custom' and school_id is not null and created_by is not null))
);
create table public.entity_tags(
 entity_id uuid not null references public.entities(id) on delete cascade,tag_id uuid not null references public.tags(id),
 role text not null check(role in ('primary','custom')),created_at timestamptz not null default now(),primary key(entity_id,tag_id)
);
create unique index entity_tags_one_primary on public.entity_tags(entity_id) where role='primary';
create index entity_tags_tag on public.entity_tags(tag_id,entity_id);

insert into public.tags(slug,label,description,kind) values
 ('dining','Dining','Specific dishes, food trucks, cafes, food quality and meal plans.','official'),
 ('academic','Academic','Libraries, advising, tutoring, labs, academic resources and study spaces.','official'),
 ('activities','Activities','Clubs, student organizations, campus events, sports and social activities.','official'),
 ('facilities','Facilities','Gyms, academic buildings, makerspaces, transportation and campus infrastructure.','official'),
 ('other','Other','Community finds that do not fit another official tag.','official')
on conflict(school_id,slug) do update set label=excluded.label,description=excluded.description,status='active';

create table private.community_entity_authors(
 entity_id uuid primary key references public.entities(id) on delete cascade,user_id uuid references private.profiles(id),
 managed_identity_id uuid references private.forum_editorial_identities(id),created_at timestamptz not null default now(),
 check((user_id is not null)::integer+(managed_identity_id is not null)::integer=1)
);
insert into private.community_entity_authors(entity_id,user_id)
select s.entity_id,s.user_id from private.entity_submissions s where s.status='approved' and s.entity_id is not null on conflict(entity_id) do nothing;
insert into public.entity_tags(entity_id,tag_id,role)
select e.id,t.id,'primary' from public.entities e join public.categories c on c.id=e.category_id cross join public.tags t
where c.accepts_submissions and t.kind='official' and t.slug='other' on conflict do nothing;
update private.reviews r set is_anonymous=false from public.entities e join public.categories c on c.id=e.category_id where r.entity_id=e.id and c.accepts_submissions;
create table private.community_comments(
 id uuid primary key default gen_random_uuid(),entity_id uuid not null references public.entities(id) on delete cascade,
 parent_comment_id uuid references private.community_comments(id),reply_to_comment_id uuid references private.community_comments(id),
 review_id uuid references private.reviews(id),author_user_id uuid references private.profiles(id),managed_identity_id uuid references private.forum_editorial_identities(id),
 body text not null,status text not null default 'published' check(status in ('published','hidden','deleted')),check(status='deleted' or length(trim(body)) between 1 and 1500),
 deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((author_user_id is not null)::integer+(managed_identity_id is not null)::integer=1),
 check(not(parent_comment_id is not null and review_id is not null))
);
create index community_comments_entity on private.community_comments(entity_id,created_at desc,id desc);
create index community_comments_parent on private.community_comments(parent_comment_id,created_at,id);
create index community_comments_review on private.community_comments(review_id,created_at,id);
create table private.community_likes(
 target_type text not null check(target_type in ('review','comment')),target_id uuid not null,user_id uuid not null references private.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(target_type,target_id,user_id)
);
create index community_likes_target on private.community_likes(target_type,target_id);

alter table private.entity_submissions add column if not exists managed_identity_id uuid references private.forum_editorial_identities(id);
alter table private.entity_submissions add column if not exists primary_tag_id uuid references public.tags(id);
alter table private.entity_submissions add column if not exists custom_tag_ids uuid[] not null default '{}';
alter table private.entity_submissions drop constraint if exists entity_submissions_image_path_check;
alter table private.entity_submissions add constraint entity_submissions_image_path_check check(image_path ~ '^[0-9a-f-]{36}/(image|[0-9a-f-]{36})\.webp$');
alter table private.reports drop constraint if exists reports_target_type_check;
alter table private.reports add constraint reports_target_type_check check(target_type in ('review','entity','user','forum_post','forum_comment','community_comment'));
create table private.entity_submission_images(
 id uuid primary key default gen_random_uuid(),submission_id uuid not null references private.entity_submissions(id) on delete cascade,
 entity_id uuid references public.entities(id) on delete cascade,storage_path text not null unique,sort_order integer not null check(sort_order between 0 and 4),
 status text not null default 'pending' check(status in ('pending','ready')),width integer not null default 0,height integer not null default 0,created_at timestamptz not null default now(),unique(submission_id,sort_order)
);
insert into private.entity_submission_images(submission_id,entity_id,storage_path,sort_order,status)
select id,entity_id,image_path,0,case when status='draft' then 'pending' else 'ready' end from private.entity_submissions
where image_path is not null on conflict(storage_path) do nothing;
alter table public.entities drop constraint if exists entities_image_path_shape;
alter table public.entities add constraint entities_image_path_shape check(image_path is null or image_path ~ '^[0-9a-f-]{36}/(image|[0-9a-f-]{36})\.webp$');

create trigger touch_updated before update on public.tags for each row execute function private.touch_updated();
create trigger touch_updated before update on private.community_comments for each row execute function private.touch_updated();

create function private.validate_entity_tag() returns trigger language plpgsql set search_path='' as $$
declare entity_school uuid;tag_school uuid;tag_kind text;custom_count integer;
begin
 select school_id into entity_school from public.entities where id=new.entity_id;select school_id,kind into tag_school,tag_kind from public.tags where id=new.tag_id and status='active';
 if entity_school is null or tag_kind is null then raise exception 'Entity and active tag are required.';end if;
 if new.role='primary' and tag_kind<>'official' then raise exception 'Choose one official primary tag.';end if;
 if new.role='custom' and (tag_kind<>'custom' or tag_school<>entity_school) then raise exception 'Custom tags must belong to the entity school.';end if;
 if new.role='custom' then select count(*) into custom_count from public.entity_tags where entity_id=new.entity_id and role='custom' and tag_id<>new.tag_id;if custom_count>=5 then raise exception 'Use no more than five custom tags.';end if;end if;
 return new;
end $$;
create trigger validate_entity_tag before insert or update on public.entity_tags for each row execute function private.validate_entity_tag();

alter table public.tags enable row level security;alter table public.entity_tags enable row level security;
alter table private.community_entity_authors enable row level security;alter table private.community_comments enable row level security;
alter table private.community_likes enable row level security;alter table private.entity_submission_images enable row level security;
create policy tags_read on public.tags for select to rateduke_api using(status='active' or private.is_admin());
create policy tags_admin on public.tags for all to rateduke_api using(private.is_admin()) with check(private.is_admin());
create policy tags_custom_insert on public.tags for insert to rateduke_api with check(kind='custom' and school_id is not null and created_by=private.request_user_id() and private.can_contribute(school_id));
create policy tags_custom_reuse on public.tags for update to rateduke_api using(kind='custom' and school_id is not null and private.can_contribute(school_id)) with check(kind='custom' and school_id is not null and private.can_contribute(school_id));
create policy entities_community_insert on public.entities for insert to rateduke_api with check(status='active' and exists(select 1 from public.categories c where c.id=category_id and c.school_id=school_id and c.accepts_submissions) and (private.can_contribute(school_id) or private.is_admin()));
create policy entity_tags_read on public.entity_tags for select to rateduke_api using(exists(select 1 from public.entities e where e.id=entity_id));
create policy entity_tags_admin on public.entity_tags for all to rateduke_api using(private.is_admin()) with check(private.is_admin());
create policy entity_tags_community_insert on public.entity_tags for insert to rateduke_api with check(exists(select 1 from private.community_entity_authors a join public.entities e on e.id=a.entity_id where a.entity_id=entity_id and (a.user_id=private.request_user_id() or private.is_admin()) and e.status='active'));
create policy community_authors_read on private.community_entity_authors for select to rateduke_api using(exists(select 1 from public.entities e where e.id=entity_id));
create policy community_authors_insert on private.community_entity_authors for insert to rateduke_api with check(private.is_admin() or user_id=private.request_user_id());
create policy community_comments_read on private.community_comments for select to rateduke_api using(private.is_staff() or status<>'hidden');
create policy community_comments_insert on private.community_comments for insert to rateduke_api with check((author_user_id=private.request_user_id() and managed_identity_id is null) or (private.is_admin() and author_user_id is null and managed_identity_id is not null));
create policy community_comments_update on private.community_comments for update to rateduke_api using(private.is_staff() or author_user_id=private.request_user_id()) with check(private.is_staff() or author_user_id=private.request_user_id());
create policy community_likes_own on private.community_likes for all to rateduke_api using(user_id=private.request_user_id()) with check(user_id=private.request_user_id() and private.is_active_user());
create policy submission_images_read on private.entity_submission_images for select to rateduke_api using(exists(select 1 from private.entity_submissions s where s.id=submission_id and (s.user_id=private.request_user_id() or private.is_admin() or s.status='approved')));
create policy submission_images_write on private.entity_submission_images for all to rateduke_api using(exists(select 1 from private.entity_submissions s where s.id=submission_id and s.status='draft' and (s.user_id=private.request_user_id() or private.is_admin()))) with check(exists(select 1 from private.entity_submissions s where s.id=submission_id and s.status='draft' and (s.user_id=private.request_user_id() or private.is_admin())));

grant select,insert,update,delete on public.tags,public.entity_tags to rateduke_api;
grant select,insert,update,delete on private.community_entity_authors,private.community_comments,private.community_likes,private.entity_submission_images to rateduke_api;
revoke all on public.tags,public.entity_tags from public,anon,authenticated;
revoke all on private.community_entity_authors,private.community_comments,private.community_likes,private.entity_submission_images from public,anon,authenticated;

grant create on schema public,private to rateduke_api;set local role rateduke_api;

create function private.normalize_tag(p_value text) returns text language sql immutable set search_path='' as $$
 select left(trim(both '-' from regexp_replace(regexp_replace(lower(trim(p_value)),'^#+','','g'),'[^a-z0-9]+','-','g')),30)
$$;
create function private.community_comment_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',c.id,'entity_id',c.entity_id,'parent_comment_id',c.parent_comment_id,'reply_to_comment_id',c.reply_to_comment_id,'review_id',c.review_id,
  'author_name',coalesce(m.name,p.nickname,'Student'),'body',case c.status when 'published' then c.body when 'hidden' then 'This comment was hidden by the moderation team.' else 'This comment was deleted by its author.' end,
  'status',c.status,'created_at',c.created_at,'like_count',(select count(*) from private.community_likes l where l.target_type='comment' and l.target_id=c.id),
  'liked_by_viewer',exists(select 1 from private.community_likes l where l.target_type='comment' and l.target_id=c.id and l.user_id=private.request_user_id()),
  'can_delete',c.author_user_id=private.request_user_id() or private.is_staff(),'replying_to',(select coalesce(rm.name,rp.nickname) from private.community_comments r left join private.profiles rp on rp.id=r.author_user_id left join private.forum_editorial_identities rm on rm.id=r.managed_identity_id where r.id=c.reply_to_comment_id),'replies','[]'::jsonb)
 from private.community_comments c left join private.profiles p on p.id=c.author_user_id left join private.forum_editorial_identities m on m.id=c.managed_identity_id where c.id=p_id
$$;

create function public.get_community_data() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tags',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'school_id',t.school_id,'slug',t.slug,'label',t.label,'description',t.description,'kind',t.kind,'status',t.status,'created_by',null,'created_at',t.created_at,'usage_count',(select count(*) from public.entity_tags et where et.tag_id=t.id)) order by t.kind,t.label) from public.tags t where t.status='active' or private.is_admin()),'[]'::jsonb),
  'entity_tags',coalesce((select jsonb_agg(to_jsonb(et)) from public.entity_tags et join public.entities e on e.id=et.entity_id where e.status='active' or private.is_admin()),'[]'::jsonb),
  'community_authors',coalesce((select jsonb_agg(jsonb_build_object('entity_id',a.entity_id,'public_identity',coalesce(m.name,p.nickname,'Student'),'managed',a.managed_identity_id is not null)) from private.community_entity_authors a left join private.profiles p on p.id=a.user_id left join private.forum_editorial_identities m on m.id=a.managed_identity_id join public.entities e on e.id=a.entity_id where e.status='active' or private.is_admin()),'[]'::jsonb),
  'community_comments',coalesce((select jsonb_agg(private.community_comment_json(c.id) order by c.created_at) from private.community_comments c join public.entities e on e.id=c.entity_id where private.is_staff() or (c.status='deleted' and c.author_user_id=private.request_user_id()) or (e.status='active' and c.status='published')),'[]'::jsonb),
  'review_likes',coalesce((select jsonb_agg(jsonb_build_object('review_id',r.id,'like_count',(select count(*) from private.community_likes l where l.target_type='review' and l.target_id=r.id),'liked_by_viewer',exists(select 1 from private.community_likes l where l.target_type='review' and l.target_id=r.id and l.user_id=private.request_user_id()))) from private.reviews r join public.entities e on e.id=r.entity_id join public.categories c on c.id=e.category_id where c.accepts_submissions and r.deleted_at is null),'[]'::jsonb),
  'entity_images',coalesce((select jsonb_agg(jsonb_build_object('entity_id',i.entity_id,'storage_path',i.storage_path,'sort_order',i.sort_order,'width',i.width,'height',i.height) order by i.sort_order) from private.entity_submission_images i join public.entities e on e.id=i.entity_id where i.status='ready' and i.entity_id is not null and (e.status='active' or private.is_admin())),'[]'::jsonb),
  'admin_user_counts',case when private.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('user_id',p.id,'community_comment_count',(select count(*) from private.community_comments c where c.author_user_id=p.id and c.status<>'deleted'),'community_like_count',(select count(*) from private.community_likes l where l.user_id=p.id))) from private.profiles p),'[]'::jsonb) else '[]'::jsonb end,
  'managed_counts',case when private.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('managed_identity_id',m.id,'community_entity_count',(select count(*) from private.community_entity_authors a where a.managed_identity_id=m.id),'community_comment_count',(select count(*) from private.community_comments c where c.managed_identity_id=m.id and c.status<>'deleted'))) from private.forum_editorial_identities m),'[]'::jsonb) else '[]'::jsonb end,
  'admin_summary',case when private.is_admin() then jsonb_build_object('community_entities',(select count(*) from public.entities e join public.categories c on c.id=e.category_id where c.accepts_submissions and e.status='active'),'community_comments',(select count(*) from private.community_comments where status<>'deleted'),'community_likes',(select count(*) from private.community_likes),'custom_tags',(select count(*) from public.tags where kind='custom' and status='active')) else null end
 )
$$;

create function public.get_community_feed(p_school uuid,p_sort text default 'hot',p_official_tag text default null,p_custom_tag text default null,p_page integer default 1,p_limit integer default 20) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_sort not in ('hot','latest') then raise exception 'Sort must be hot or latest.';end if;if p_page<1 or p_limit not between 1 and 50 then raise exception 'Invalid pagination.';end if;
 with visible as(
  select e.id,e.created_at,(select count(*) from private.reviews r where r.entity_id=e.id and r.status='published' and r.deleted_at is null) ratings,(select count(*) from private.community_comments x where x.entity_id=e.id and x.status='published' and x.parent_comment_id is null and x.review_id is null) top_comments,(select count(*) from private.community_comments x where x.entity_id=e.id and x.status='published' and (x.parent_comment_id is not null or x.review_id is not null)) replies,(select count(*) from private.community_likes l where (l.target_type='review' and exists(select 1 from private.reviews r where r.id=l.target_id and r.entity_id=e.id and r.status='published' and r.deleted_at is null)) or (l.target_type='comment' and exists(select 1 from private.community_comments x where x.id=l.target_id and x.entity_id=e.id and x.status='published'))) likes
  from public.entities e join public.categories c on c.id=e.category_id where e.school_id=p_school and e.status='active' and c.accepts_submissions and (p_official_tag is null or exists(select 1 from public.entity_tags et join public.tags t on t.id=et.tag_id where et.entity_id=e.id and et.role='primary' and t.slug=p_official_tag and t.status='active')) and (p_custom_tag is null or exists(select 1 from public.entity_tags et join public.tags t on t.id=et.tag_id where et.entity_id=e.id and et.role='custom' and t.slug=private.normalize_tag(p_custom_tag) and t.status='active'))
 ),ranked as(select *,((2*ratings+2*top_comments+replies+likes)/power(greatest(0,extract(epoch from(now()-created_at))/3600)+2,1.25)) hot_score from visible),paged as(select * from ranked order by case when p_sort='hot' then hot_score end desc,created_at desc,id desc offset (p_page-1)*p_limit limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('entity_id',id,'hot_score',hot_score,'rating_count',ratings,'top_comment_count',top_comments,'reply_count',replies,'like_count',likes) order by case when p_sort='hot' then hot_score end desc,created_at desc,id desc) from paged),'[]'::jsonb),'page',p_page,'page_size',p_limit,'total',(select count(*) from ranked),'has_more',p_page*p_limit<(select count(*) from ranked)) into result;return result;
end $$;

create function public.get_community_conversation(p_entity uuid,p_page integer default 1,p_limit integer default 20) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_page<1 or p_limit not between 1 and 50 then raise exception 'Invalid pagination.';end if;if not exists(select 1 from public.entities e join public.categories c on c.id=e.category_id where e.id=p_entity and c.accepts_submissions and (e.status='active' or private.is_staff())) then return jsonb_build_object('items','[]'::jsonb,'page',p_page,'page_size',p_limit,'total',0,'has_more',false);end if;
 with roots as(select r.id,r.created_at,'review'::text kind from private.reviews r where r.entity_id=p_entity and r.status='published' and r.deleted_at is null union all select x.id,x.created_at,'comment' from private.community_comments x where x.entity_id=p_entity and x.parent_comment_id is null and x.review_id is null and (x.status='published' or private.is_staff() or (x.status='deleted' and x.author_user_id=private.request_user_id()))),paged as(select * from roots order by created_at desc,id desc offset (p_page-1)*p_limit limit p_limit),items as(
  select p.id,p.created_at,case when p.kind='review' then jsonb_build_object('type','review','content',private.review_json(p.id,false),'like_count',(select count(*) from private.community_likes l where l.target_type='review' and l.target_id=p.id),'liked_by_viewer',exists(select 1 from private.community_likes l where l.target_type='review' and l.target_id=p.id and l.user_id=private.request_user_id()),'replies',coalesce((select jsonb_agg(private.community_comment_json(x.id) order by x.created_at,x.id) from private.community_comments x where x.review_id=p.id and (x.status='published' or private.is_staff() or (x.status='deleted' and x.author_user_id=private.request_user_id()))),'[]'::jsonb)) else jsonb_build_object('type','comment','content',private.community_comment_json(p.id),'replies',coalesce((select jsonb_agg(private.community_comment_json(x.id) order by x.created_at,x.id) from private.community_comments x where x.parent_comment_id=p.id and (x.status='published' or private.is_staff() or (x.status='deleted' and x.author_user_id=private.request_user_id()))),'[]'::jsonb)) end item from paged p
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(item order by created_at desc,id desc) from items),'[]'::jsonb),'page',p_page,'page_size',p_limit,'total',(select count(*) from roots),'has_more',p_page*p_limit<(select count(*) from roots)) into result;return result;
end $$;

drop function public.begin_entity_submission(jsonb);drop function public.finalize_entity_submission(uuid);drop function public.cancel_entity_submission(uuid);
create function public.begin_entity_submission(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();sid uuid:=gen_random_uuid();school uuid;category uuid;primary_tag uuid;managed uuid:=nullif(p_data->>'managed_identity_id','')::uuid;score numeric;count_images integer;item jsonb;idx integer:=0;tag_value text;tag_slug text;tag_id uuid;custom_ids uuid[]:='{}';slots jsonb:='[]';path text;
begin
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;school:=(p_data->>'school_id')::uuid;score:=(p_data->>'initial_overall_rating')::numeric;primary_tag:=(p_data->>'primary_tag_id')::uuid;count_images:=coalesce((p_data->>'image_count')::integer,0);
 if managed is null then if not private.can_contribute(school) then raise exception 'Use a verified email from this school to contribute.';end if;perform private.consume_limit('entity_submission',5);elsif not private.is_admin() or not exists(select 1 from private.forum_editorial_identities where id=managed and school_id=school and status='active') then raise exception 'Administrator access and an active contributor profile are required.';end if;
 select id into category from public.categories where school_id=school and status='active' and accepts_submissions order by is_discover_default desc,sort_order limit 1;if category is null then raise exception 'Community publishing is not enabled for this school.';end if;
 if not exists(select 1 from public.tags where id=primary_tag and kind='official' and status='active') then raise exception 'Choose one official tag.';end if;
 if count_images not between 1 and 5 then raise exception 'Add between one and five images.';end if;if not private.valid_ten_point_score(score) then raise exception 'Choose a rating from 1.0 to 10.0 in half-point steps.';end if;
 if length(trim(coalesce(p_data->>'name',''))) not between 2 and 200 or length(trim(coalesce(p_data->>'location_name',''))) not between 2 and 200 or length(trim(coalesce(p_data->>'description',''))) not between 10 and 3000 then raise exception 'Add a name, campus location and useful description.';end if;
 if jsonb_typeof(coalesce(p_data->'custom_tags','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_data->'custom_tags','[]'::jsonb))>5 then raise exception 'Use no more than five custom tags.';end if;
 for item in select * from jsonb_array_elements(coalesce(p_data->'custom_tags','[]'::jsonb)) loop tag_value:=item #>> '{}';tag_slug:=private.normalize_tag(tag_value);if length(tag_slug)<2 then raise exception 'Custom tags must contain at least two letters or numbers.';end if;insert into public.tags(school_id,slug,label,kind,created_by) values(school,tag_slug,tag_slug,'custom',uid) on conflict(school_id,slug) do update set status='active' returning id into tag_id;custom_ids:=array_append(custom_ids,tag_id);end loop;custom_ids:=array(select distinct unnest(custom_ids));
 insert into private.entity_submissions(id,user_id,managed_identity_id,school_id,category_id,name,location_name,description,image_path,initial_overall_rating,initial_review_body,is_anonymous,status,primary_tag_id,custom_tag_ids)
 values(sid,uid,managed,school,category,trim(p_data->>'name'),trim(p_data->>'location_name'),trim(p_data->>'description'),sid::text||'/image.webp',score,trim(coalesce(p_data->>'initial_review_body','')),false,'draft',primary_tag,custom_ids);
 while idx<count_images loop path:=sid::text||'/'||gen_random_uuid()::text||'.webp';insert into private.entity_submission_images(submission_id,storage_path,sort_order) values(sid,path,idx);slots:=slots||jsonb_build_array(jsonb_build_object('index',idx,'path',path));idx:=idx+1;end loop;
 update private.entity_submissions set image_path=slots->0->>'path' where id=sid;return jsonb_build_object('id',sid,'images',slots);
end $$;
create function public.mark_entity_submission_image_ready(p_id uuid,p_path text,p_width integer,p_height integer) returns void language plpgsql security definer set search_path='' as $$
begin update private.entity_submission_images i set status='ready',width=p_width,height=p_height from private.entity_submissions s where i.submission_id=s.id and s.id=p_id and i.storage_path=p_path and s.status='draft' and (s.user_id=private.request_user_id() or (s.managed_identity_id is not null and private.is_admin()));if not found then raise exception 'Upload slot not found.';end if;end $$;
create function public.finalize_entity_submission(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s private.entity_submissions;created_entity uuid:=gen_random_uuid();review_id uuid;base_slug text;final_slug text;tag_id uuid;
begin select * into s from private.entity_submissions where id=p_id and status='draft' and (user_id=private.request_user_id() or (managed_identity_id is not null and private.is_admin())) for update;if not found then raise exception 'Submission draft not found.';end if;if not exists(select 1 from private.entity_submission_images where submission_id=s.id) or exists(select 1 from private.entity_submission_images where submission_id=s.id and status<>'ready') then raise exception 'Finish uploading every image before publishing.';end if;
 base_slug:=trim(both '-' from lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','-','g')));if base_slug='' then base_slug:='community-find';end if;final_slug:=left(base_slug,90);if exists(select 1 from public.entities where slug=final_slug) then final_slug:=left(base_slug,80)||'-'||left(replace(s.id::text,'-',''),8);end if;
 insert into public.entities(id,school_id,category_id,name,slug,short_description,description,location_name,image_path,status,is_featured,metadata) values(created_entity,s.school_id,s.category_id,s.name,final_slug,left(s.description,250),s.description,s.location_name,s.image_path,'active',false,'{}');
 insert into private.community_entity_authors(entity_id,user_id,managed_identity_id) values(created_entity,case when s.managed_identity_id is null then s.user_id end,s.managed_identity_id);insert into public.entity_tags(entity_id,tag_id,role) values(created_entity,s.primary_tag_id,'primary');foreach tag_id in array s.custom_tag_ids loop insert into public.entity_tags(entity_id,tag_id,role) values(created_entity,tag_id,'custom');end loop;
 insert into private.reviews(entity_id,user_id,managed_identity_id,overall_rating,body,is_anonymous,status) values(created_entity,case when s.managed_identity_id is null then s.user_id end,s.managed_identity_id,s.initial_overall_rating,s.initial_review_body,false,'published') returning id into review_id;
 update private.entity_submission_images set entity_id=created_entity where submission_id=s.id;update private.entity_submissions set status='approved',entity_id=created_entity,submitted_at=now(),reviewed_at=now(),rejection_reason='' where id=s.id;if s.managed_identity_id is not null then insert into private.audit_log(actor_id,action,target_id) values(private.request_user_id(),'publish_managed_community_entity',created_entity);end if;return created_entity;
end $$;
create function public.cancel_entity_submission(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin delete from private.entity_submissions where id=p_id and status='draft' and (user_id=private.request_user_id() or private.is_admin());end $$;

alter function public.app_command(text,jsonb) rename to app_command_before_community_interactions;revoke all on function public.app_command_before_community_interactions(text,jsonb) from public,anon,authenticated;
create function public.app_command(p_action text,p_data jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();v_entity_id uuid;v_target_id uuid;v_target_type text;comment_id uuid;root_id uuid;reply_id uuid;v_review_id uuid;school uuid;managed uuid;body text;deleted_count integer;
begin
 if p_action='save_review' then v_entity_id:=(p_data->>'entity_id')::uuid;if exists(select 1 from public.entities e join public.categories c on c.id=e.category_id where e.id=v_entity_id and c.accepts_submissions) then return public.app_command_before_community_interactions(p_action,p_data||jsonb_build_object('is_anonymous',false));end if;return public.app_command_before_community_interactions(p_action,p_data);end if;
 if p_action not in ('community_comment','community_toggle_like','community_delete_comment','moderate_community_comment','moderate_community_entity','archive_tag','merge_tag') and not(p_action='report' and p_data->>'target_type'='community_comment') then return public.app_command_before_community_interactions(p_action,p_data);end if;
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
 if p_action='archive_tag' then if not private.is_admin() then raise exception 'Administrator access required.';end if;v_target_id:=(p_data->>'id')::uuid;update public.tags set status='archived' where id=v_target_id and kind='custom';if not found then raise exception 'Only custom tags can be archived.';end if;insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,v_target_id);return 'Custom tag archived.';
 elsif p_action='merge_tag' then if not private.is_admin() then raise exception 'Administrator access required.';end if;comment_id:=(p_data->>'source_id')::uuid;v_target_id:=(p_data->>'target_id')::uuid;if comment_id=v_target_id or not exists(select 1 from public.tags s join public.tags t on t.id=v_target_id where s.id=comment_id and s.kind='custom' and t.kind='custom' and s.school_id=t.school_id) then raise exception 'Choose two different custom tags from the same school.';end if;insert into public.entity_tags(entity_id,tag_id,role) select entity_id,v_target_id,'custom' from public.entity_tags where tag_id=comment_id on conflict do nothing;delete from public.entity_tags where tag_id=comment_id;update public.tags set status='archived' where id=comment_id;insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,comment_id);return 'Custom tags merged.';
 elsif p_action='community_comment' then v_entity_id:=(p_data->>'entity_id')::uuid;managed:=nullif(p_data->>'managed_identity_id','')::uuid;body:=trim(coalesce(p_data->>'body',''));select e.school_id into school from public.entities e join public.categories c on c.id=e.category_id where e.id=v_entity_id and e.status='active' and c.accepts_submissions;if school is null then raise exception 'Community listing not found.';end if;if managed is null and not private.can_contribute(school) then raise exception 'Use a verified email from this school to comment.';elsif managed is not null and (not private.is_admin() or not exists(select 1 from private.forum_editorial_identities where id=managed and school_id=school and status='active')) then raise exception 'Choose an active contributor profile from the same school.';end if;if length(body) not between 1 and 1500 then raise exception 'Comments must be between 1 and 1,500 characters.';end if;
  v_review_id:=nullif(p_data->>'review_id','')::uuid;if v_review_id is not null and not exists(select 1 from private.reviews r where r.id=v_review_id and r.entity_id=v_entity_id and r.status='published' and r.deleted_at is null) then raise exception 'Rating not found.';end if;reply_id:=nullif(p_data->>'parent_comment_id','')::uuid;if reply_id is not null then select coalesce(x.parent_comment_id,x.id) into root_id from private.community_comments x where x.id=reply_id and x.entity_id=v_entity_id and x.status<>'deleted';if root_id is null then raise exception 'Comment not found.';end if;end if;perform private.consume_limit('community_comment',60);insert into private.community_comments(entity_id,parent_comment_id,reply_to_comment_id,review_id,author_user_id,managed_identity_id,body) values(v_entity_id,root_id,reply_id,v_review_id,case when managed is null then uid end,managed,body) returning id into comment_id;if managed is not null then insert into private.audit_log(actor_id,action,target_id) values(uid,'publish_managed_community_comment',comment_id);end if;return comment_id::text;
 elsif p_action='community_toggle_like' then v_target_type:=p_data->>'target_type';v_target_id:=(p_data->>'target_id')::uuid;if v_target_type='review' then select e.id,e.school_id into v_entity_id,school from private.reviews r join public.entities e on e.id=r.entity_id join public.categories c on c.id=e.category_id where r.id=v_target_id and r.status='published' and r.deleted_at is null and c.accepts_submissions;elsif v_target_type='comment' then select e.id,e.school_id into v_entity_id,school from private.community_comments x join public.entities e on e.id=x.entity_id join public.categories c on c.id=e.category_id where x.id=v_target_id and x.status='published' and c.accepts_submissions;else raise exception 'Invalid like target.';end if;if v_entity_id is null then raise exception 'Content not found.';end if;if not private.can_contribute(school) then raise exception 'Use a verified email from this school to like content.';end if;perform private.consume_limit('community_like',180);delete from private.community_likes where target_type=v_target_type and target_id=v_target_id and user_id=uid;get diagnostics deleted_count=row_count;if deleted_count>0 then return 'Like removed.';end if;insert into private.community_likes(target_type,target_id,user_id) values(v_target_type,v_target_id,uid);return 'Liked.';
 elsif p_action='community_delete_comment' then comment_id:=(p_data->>'id')::uuid;update private.community_comments set status='deleted',body='',deleted_at=now() where id=comment_id and (author_user_id=uid or private.is_staff());if not found then raise exception 'Comment not found.';end if;delete from private.community_likes where target_type='comment' and target_id=comment_id;return 'Comment deleted.';
 elsif p_action='moderate_community_comment' then if not private.is_staff() then raise exception 'Moderator access required.';end if;comment_id:=(p_data->>'id')::uuid;update private.community_comments set status=p_data->>'status' where id=comment_id and status<>'deleted' and p_data->>'status' in ('published','hidden');if not found then raise exception 'Comment not found.';end if;insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,comment_id);return 'Comment visibility updated.';
 elsif p_action='moderate_community_entity' then if not private.is_staff() then raise exception 'Moderator access required.';end if;v_entity_id:=(p_data->>'id')::uuid;update public.entities e set status=p_data->>'status' from public.categories c where e.id=v_entity_id and c.id=e.category_id and c.accepts_submissions and p_data->>'status' in ('active','archived');if not found then raise exception 'Community listing not found.';end if;insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,v_entity_id);return 'Community listing visibility updated.';
 else comment_id:=(p_data->>'target_id')::uuid;select c.entity_id,c.author_user_id,e.school_id into v_entity_id,reply_id,school from private.community_comments c join public.entities e on e.id=c.entity_id where c.id=comment_id and c.status='published';if v_entity_id is null then raise exception 'Comment not found.';end if;if not private.can_contribute(school) then raise exception 'Use a verified email from this school to report content.';end if;perform private.consume_limit('report',10);insert into private.reports(reporter_user_id,target_type,target_id,target_author_user_id,reason,details) values(uid,'community_comment',comment_id,reply_id,p_data->>'reason',trim(coalesce(p_data->>'details','')));return 'Report sent to the moderation team.';end if;
end $$;

create or replace function public.can_read_submission_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.entity_submission_images i join private.entity_submissions s on s.id=i.submission_id where i.storage_path=p_name and (s.user_id=private.request_user_id() or private.is_admin() or (s.status='approved' and exists(select 1 from public.entities e where e.id=s.entity_id and e.status='active'))))$$;
create or replace function public.can_write_submission_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.entity_submission_images i join private.entity_submissions s on s.id=i.submission_id where i.storage_path=p_name and s.status='draft' and (s.user_id=private.request_user_id() or (s.managed_identity_id is not null and private.is_admin())))$$;

alter function private.normalize_tag(text) owner to rateduke_api;alter function private.community_comment_json(uuid) owner to rateduke_api;alter function public.get_community_data() owner to rateduke_api;alter function public.get_community_feed(uuid,text,text,text,integer,integer) owner to rateduke_api;alter function public.get_community_conversation(uuid,integer,integer) owner to rateduke_api;alter function public.begin_entity_submission(jsonb) owner to rateduke_api;alter function public.mark_entity_submission_image_ready(uuid,text,integer,integer) owner to rateduke_api;alter function public.finalize_entity_submission(uuid) owner to rateduke_api;alter function public.cancel_entity_submission(uuid) owner to rateduke_api;alter function public.app_command(text,jsonb) owner to rateduke_api;alter function public.can_read_submission_image(text) owner to rateduke_api;alter function public.can_write_submission_image(text) owner to rateduke_api;
revoke all on function private.normalize_tag(text),private.community_comment_json(uuid),public.get_community_data(),public.get_community_feed(uuid,text,text,text,integer,integer),public.get_community_conversation(uuid,integer,integer),public.begin_entity_submission(jsonb),public.mark_entity_submission_image_ready(uuid,text,integer,integer),public.finalize_entity_submission(uuid),public.cancel_entity_submission(uuid),public.app_command(text,jsonb),public.can_read_submission_image(text),public.can_write_submission_image(text) from public,anon,authenticated;
grant execute on function private.normalize_tag(text),private.community_comment_json(uuid),public.app_command_before_community_interactions(text,jsonb) to rateduke_api;
grant execute on function public.get_community_data(),public.get_community_feed(uuid,text,text,text,integer,integer),public.get_community_conversation(uuid,integer,integer),public.can_read_submission_image(text) to anon,authenticated;
grant execute on function public.begin_entity_submission(jsonb),public.mark_entity_submission_image_ready(uuid,text,integer,integer),public.finalize_entity_submission(uuid),public.cancel_entity_submission(uuid),public.app_command(text,jsonb),public.can_write_submission_image(text) to authenticated;

reset role;revoke create on schema public,private from rateduke_api;

do $$ begin
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists rateduke_submission_images_read on storage.objects';execute 'drop policy if exists rateduke_submission_images_insert on storage.objects';execute 'drop policy if exists rateduke_submission_images_delete_draft on storage.objects';
  execute $sql$create policy rateduke_submission_images_read on storage.objects for select to anon,authenticated using(bucket_id='entity-images' and public.can_read_submission_image(name))$sql$;
  execute $sql$create policy rateduke_submission_images_insert on storage.objects for insert to authenticated with check(bucket_id='entity-images' and public.can_write_submission_image(name))$sql$;
  execute $sql$create policy rateduke_submission_images_delete_draft on storage.objects for delete to authenticated using(bucket_id='entity-images' and public.can_write_submission_image(name))$sql$;
 end if;
end $$;

commit;
