-- RATEDUKE P0. Run with the Supabase migration owner, never from a browser.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='rateduke_api') then
    create role rateduke_api nologin noinherit nobypassrls;
  end if;
end $$;
-- Managed Supabase postgres is not a superuser. Make ownership transfers explicit.
-- Only the trusted migration operator receives membership; never the API auth roles.
do $$ begin execute format('grant rateduke_api to %I with set true',current_user);end $$;
grant create on schema public to rateduke_api;
grant usage on schema public, private to rateduke_api;

create table public.schools (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=100),
 email_domain text not null check(email_domain=lower(email_domain) and email_domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
 city text not null default '', state text not null default '', country text not null default '',
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id),
 name text not null check(length(trim(name)) between 1 and 200), slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=100),
 description text not null default '' check(length(description)<=1000), icon text not null default 'compass' check(length(icon)<=40),
 status text not null default 'active' check(status in ('active','archived')), sort_order integer not null default 0 check(sort_order>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique nulls not distinct(school_id,slug)
);
create table public.entities (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), category_id uuid not null references public.categories(id),
 parent_entity_id uuid references public.entities(id), name text not null check(length(trim(name)) between 1 and 200),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=100),
 short_description text not null default '' check(length(short_description)<=250), description text not null default '' check(length(description)<=6000),
 location_name text not null default '' check(length(location_name)<=200), address text not null default '' check(length(address)<=500),
 latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
 official_url text not null default '' check(official_url='' or official_url ~ '^https?://'), source_name text not null default '',
 source_url text not null default '' check(source_url='' or source_url ~ '^https?://'), last_verified_at timestamptz,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=24000),
 status text not null default 'active' check(status in ('active','archived')), is_featured boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(parent_entity_id is distinct from id)
);
create table public.rating_dimensions (
 id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id),
 key text not null check(key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key)<=100), label text not null check(length(trim(label)) between 1 and 200), description text not null default '' check(length(description)<=1000),
 min_value integer not null default 1 check(min_value between -100 and 100), max_value integer not null default 5 check(max_value between -100 and 100),
 sort_order integer not null default 0 check(sort_order>=0), is_required boolean not null default true, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(category_id,key), check(max_value>min_value)
);
create table private.profiles (
 id uuid primary key references auth.users(id) on delete cascade, email text not null,
 nickname text not null default 'Student' check(length(trim(nickname)) between 2 and 60 and nickname !~* '(@|https?://)'), verified boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.account_roles (
 user_id uuid primary key references private.profiles(id) on delete cascade,
 role text not null default 'user' check(role in ('user','moderator','admin')), suspended boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.reviews (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references public.entities(id), user_id uuid not null references private.profiles(id),
 overall_rating integer check(overall_rating between 1 and 5), body text not null default '' check(length(body)<=3000), is_anonymous boolean not null default true,
 status text not null default 'published' check(status in ('published','hidden')), deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,entity_id)
);
create table private.rating_values (
 review_id uuid not null references private.reviews(id) on delete cascade, rating_dimension_id uuid not null references public.rating_dimensions(id), score integer not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(review_id,rating_dimension_id)
);
create table private.reports (
 id uuid primary key default gen_random_uuid(), reporter_user_id uuid not null references private.profiles(id), target_type text not null check(target_type in ('review','entity','user')), target_id uuid not null,
 reason text not null check(reason in ('Harassment','Privacy violation','Hate or threats','Spam','Inaccurate information','Other')), details text not null default '' check(length(details)<=2000),
 status text not null default 'pending' check(status in ('pending','resolved')), reviewed_by uuid references private.profiles(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index reports_pending_unique on private.reports(reporter_user_id,target_type,target_id) where status='pending';
create table private.audit_log (id uuid primary key default gen_random_uuid(),actor_id uuid not null references private.profiles(id),action text not null,target_id uuid not null,created_at timestamptz not null default now());
create table private.rate_limits (user_id uuid not null references private.profiles(id),action text not null,bucket timestamptz not null,hits integer not null default 1,primary key(user_id,action,bucket));
create index entities_school_category on public.entities(school_id,category_id);
create index entities_parent on public.entities(parent_entity_id);
create index reviews_entity_status on private.reviews(entity_id,status) where deleted_at is null;
create index reviews_author on private.reviews(user_id);
create index values_dimension on private.rating_values(rating_dimension_id);
create index reports_status on private.reports(status,created_at);
create index entities_search on public.entities using gin(to_tsvector('english',name||' '||short_description||' '||description||' '||location_name));

create function private.touch_updated() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text; begin
 foreach t in array array['public.schools','public.categories','public.entities','public.rating_dimensions','private.profiles','private.account_roles','private.reviews','private.rating_values','private.reports'] loop
 execute format('create trigger touch_updated before update on %s for each row execute function private.touch_updated()',t);
 end loop;
end $$;
create function private.sync_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.profiles(id,email,verified) values(new.id,coalesce(new.email,''),new.email_confirmed_at is not null)
 on conflict(id) do update set email=excluded.email,verified=excluded.verified;
 insert into private.account_roles(user_id) values(new.id) on conflict do nothing;
 return new;
end $$;
create trigger rateduke_auth_sync after insert or update of email,email_confirmed_at on auth.users for each row execute function private.sync_auth_user();
insert into private.profiles(id,email,verified) select id,coalesce(email,''),email_confirmed_at is not null from auth.users on conflict do nothing;
insert into private.account_roles(user_id) select id from private.profiles on conflict do nothing;

-- Narrow trusted helpers avoid recursive policy checks; never accept a caller-supplied identity.
create function private.request_user_id() returns uuid language sql stable set search_path='' as $$
 select coalesce(
  nullif(current_setting('request.jwt.claim.sub',true),''),
  nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
 )::uuid
$$;
create function private.current_role() returns text language sql stable security definer set search_path='' as $$
 select case when suspended then 'suspended' else role end from private.account_roles where user_id=private.request_user_id()
$$;
create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.current_role() in ('admin','moderator'),false) $$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.current_role()='admin',false) $$;
create function private.is_active_user() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.current_role() in ('admin','moderator','user'),false) $$;
create function private.can_contribute(p_school uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.profiles p join private.account_roles a on a.user_id=p.id join public.schools s on s.id=p_school
 where p.id=private.request_user_id() and p.verified and not a.suspended and s.status='active' and lower(split_part(p.email,'@',2))=s.email_domain)
$$;

-- Every business table uses RLS, including the private tables accessed through RPCs.
alter table public.schools enable row level security;
alter table public.categories enable row level security;
alter table public.entities enable row level security;
alter table public.rating_dimensions enable row level security;
alter table private.profiles enable row level security;
alter table private.account_roles enable row level security;
alter table private.reviews enable row level security;
alter table private.rating_values enable row level security;
alter table private.reports enable row level security;
alter table private.audit_log enable row level security;
alter table private.rate_limits enable row level security;

create policy schools_read on public.schools for select using(status='active' or private.is_staff());
create policy schools_admin on public.schools for all using(private.is_admin()) with check(private.is_admin());
create policy categories_read on public.categories for select using(private.is_staff() or (status='active' and (school_id is null or exists(select 1 from public.schools s where s.id=school_id and s.status='active'))));
create policy categories_admin on public.categories for all using(private.is_admin()) with check(private.is_admin());
create policy entities_read on public.entities for select using(private.is_staff() or (status='active' and exists(select 1 from public.schools s where s.id=school_id and s.status='active') and exists(select 1 from public.categories c where c.id=category_id and c.status='active')));
create policy entities_admin on public.entities for all using(private.is_admin()) with check(private.is_admin());
create policy dimensions_read on public.rating_dimensions for select using(exists(select 1 from public.categories c where c.id=category_id));
create policy dimensions_admin on public.rating_dimensions for all using(private.is_admin()) with check(private.is_admin());
create policy profiles_read on private.profiles for select using(true);
create policy profiles_own_update on private.profiles for update using(id=private.request_user_id() and private.is_active_user()) with check(id=private.request_user_id() and private.is_active_user());
create policy roles_read on private.account_roles for select using(user_id=private.request_user_id() or private.is_staff());
create policy roles_staff_update on private.account_roles for update using(private.is_staff()) with check(private.is_staff());
create policy reviews_read on private.reviews for select using(private.is_staff() or user_id=private.request_user_id() or (status='published' and deleted_at is null and exists(select 1 from public.entities e where e.id=entity_id and e.status='active')));
create policy reviews_insert on private.reviews for insert with check(user_id=private.request_user_id() and exists(select 1 from public.entities e where e.id=entity_id and e.status='active' and private.can_contribute(e.school_id)));
create policy reviews_update on private.reviews for update using(private.is_staff() or (user_id=private.request_user_id() and private.is_active_user())) with check(private.is_staff() or (user_id=private.request_user_id() and private.is_active_user()));
create policy values_read on private.rating_values for select using(exists(select 1 from private.reviews r where r.id=review_id));
create policy values_insert on private.rating_values for insert with check(exists(select 1 from private.reviews r where r.id=review_id and r.user_id=private.request_user_id() and private.is_active_user()));
create policy values_delete on private.rating_values for delete using(exists(select 1 from private.reviews r where r.id=review_id and r.user_id=private.request_user_id() and private.is_active_user()));
create policy reports_read on private.reports for select using(private.is_staff() or reporter_user_id=private.request_user_id());
create policy reports_insert on private.reports for insert with check(reporter_user_id=private.request_user_id() and private.is_active_user());
create policy reports_update on private.reports for update using(private.is_staff()) with check(private.is_staff());
create policy audit_read on private.audit_log for select using(private.is_staff());
create policy audit_insert on private.audit_log for insert with check(private.is_staff() and actor_id=private.request_user_id());
create policy limits_own on private.rate_limits for all using(user_id=private.request_user_id() and private.is_active_user()) with check(user_id=private.request_user_id() and private.is_active_user());

-- Functions run as a non-login, non-owner role that remains subject to the policies above.
grant select,insert,update,delete on public.schools,public.categories,public.entities,public.rating_dimensions to rateduke_api;
grant select,insert,update,delete on all tables in schema private to rateduke_api;
revoke all on public.schools,public.categories,public.entities,public.rating_dimensions from anon,authenticated;
revoke all on all tables in schema private from public,anon,authenticated;

create function private.consume_limit(p_action text,p_max integer) returns void language plpgsql set search_path='' as $$
declare n integer; begin
 insert into private.rate_limits(user_id,action,bucket,hits) values(private.request_user_id(),p_action,date_trunc('hour',now()),1)
 on conflict(user_id,action,bucket) do update set hits=private.rate_limits.hits+1 returning hits into n;
 if n>p_max then raise exception 'Too many requests. Please try again in an hour.';end if;
end $$;
create function private.account_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'email',p.email,'nickname',p.nickname,'verified',p.verified,'role',a.role,'suspended',a.suspended)
 from private.profiles p join private.account_roles a on a.user_id=p.id where p.id=p_id
$$;
create function private.review_json(p_id uuid,p_internal boolean default false) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',r.id,'entity_id',r.entity_id,'overall_rating',r.overall_rating,'body',r.body,'is_anonymous',r.is_anonymous,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
 'public_identity',case when r.is_anonymous then 'Anonymous Student' else p.nickname end,'verified',p.verified,
 'values',coalesce((select jsonb_agg(jsonb_build_object('review_id',v.review_id,'rating_dimension_id',v.rating_dimension_id,'score',v.score)) from private.rating_values v where v.review_id=r.id),'[]'::jsonb))
 || case when p_internal and private.is_staff() then jsonb_build_object('account_id',r.user_id) else '{}'::jsonb end
 from private.reviews r join private.profiles p on p.id=r.user_id where r.id=p_id and r.deleted_at is null
$$;
create function public.get_app_data() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'schools',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.schools s),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.categories c),'[]'::jsonb),
 'entities',coalesce((select jsonb_agg(to_jsonb(e)) from public.entities e),'[]'::jsonb),
 'dimensions',coalesce((select jsonb_agg(to_jsonb(d) order by d.sort_order) from public.rating_dimensions d),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(private.review_json(r.id,private.is_staff()) order by r.created_at desc) from private.reviews r where r.deleted_at is null and (private.is_staff() or (r.status='published' and exists(select 1 from public.entities e where e.id=r.entity_id)))),'[]'::jsonb),
 'own_reviews',coalesce((select jsonb_agg(private.review_json(r.id,false)) from private.reviews r where r.user_id=private.request_user_id() and r.deleted_at is null),'[]'::jsonb),
 'accounts',case when private.is_staff() then coalesce((select jsonb_agg(private.account_json(p.id)) from private.profiles p),'[]'::jsonb) else '[]'::jsonb end,
 'reports',case when private.is_staff() then coalesce((select jsonb_agg(to_jsonb(r)) from private.reports r),'[]'::jsonb) else '[]'::jsonb end,
 'audit',case when private.is_staff() then coalesce((select jsonb_agg(to_jsonb(a)) from (select * from private.audit_log order by created_at desc limit 100) a),'[]'::jsonb) else '[]'::jsonb end,
 'viewer',private.account_json(private.request_user_id()))
$$;
create function public.search_entities(p_query text,p_school uuid default null) returns table(id uuid) language sql stable security definer set search_path='' as $$
 select e.id from public.entities e join public.categories c on c.id=e.category_id
 where e.status='active' and c.status='active' and (p_school is null or e.school_id=p_school)
 and (to_tsvector('english',e.name||' '||e.short_description||' '||e.description||' '||e.location_name) @@ websearch_to_tsquery('english',left(p_query,200))
 or to_tsvector('english',c.name) @@ websearch_to_tsquery('english',left(p_query,200)))
$$;

create function public.app_command(p_action text,p_data jsonb) returns text language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=private.request_user_id(); rid uuid; eid uuid; did uuid; current_parent uuid; visited uuid[]; actual_role text; target_role text; target_suspended boolean; v jsonb; n integer;
 s public.schools; c public.categories; d public.rating_dimensions; e public.entities; old_e public.entities; old_d public.rating_dimensions;
 r private.reviews; target_account private.account_roles; ids uuid[]; score_value integer;
begin
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>50000 then raise exception 'Invalid request.';end if;
 -- Serialize each actor and all staff configuration transactions. Prevent duplicate reviews,
 -- concurrent scale changes, hierarchy cycles and last-admin races without external infrastructure.
 perform pg_advisory_xact_lock(hashtextextended('rateduke:'||uid::text,0));
 perform pg_advisory_xact_lock(hashtextextended('rateduke:configuration',0));
 actual_role:=private.current_role();
 if p_action='save_profile' then
   update private.profiles set nickname=trim(p_data->>'nickname') where id=uid;return 'Profile updated.';
 elsif p_action='save_review' then
   eid:=(p_data->>'entity_id')::uuid;
   select * into e from public.entities where id=eid and status='active';
   if not found or not private.can_contribute(e.school_id) or not exists(select 1 from public.categories where id=e.category_id and status='active') then raise exception 'Use a verified email from this school to contribute.';end if;
   perform 1 from public.rating_dimensions where category_id=e.category_id;
   if jsonb_typeof(p_data->'values') is distinct from 'array' or jsonb_array_length(p_data->'values')>50 then raise exception 'Invalid rating values.';end if;
   if (p_data->>'overall_rating') is null and jsonb_array_length(p_data->'values')=0 then raise exception 'Add at least one rating.';end if;
   ids:=array[]::uuid[];
   for v in select * from jsonb_array_elements(p_data->'values') loop
     did:=(v->>'rating_dimension_id')::uuid;score_value:=(v->>'score')::integer;
     if did=any(ids) then raise exception 'Each dimension may be rated only once.';end if;
     ids:=array_append(ids,did);
     select * into d from public.rating_dimensions where id=did and category_id=e.category_id and is_active;
     if not found or score_value is null or score_value<d.min_value or score_value>d.max_value then raise exception 'A rating is outside its configured range. Refresh the form and try again.';end if;
   end loop;
   if exists(select 1 from public.rating_dimensions where category_id=e.category_id and is_active and is_required and not(id=any(ids))) then raise exception 'Please complete all required rating dimensions.';end if;
   perform private.consume_limit('review',20);
   insert into private.reviews(entity_id,user_id,overall_rating,body,is_anonymous) values(eid,uid,(p_data->>'overall_rating')::integer,trim(coalesce(p_data->>'body','')),coalesce((p_data->>'is_anonymous')::boolean,true))
   on conflict(user_id,entity_id) do update set overall_rating=excluded.overall_rating,body=excluded.body,is_anonymous=excluded.is_anonymous,deleted_at=null
   returning id,status into rid,target_role;
   delete from private.rating_values rv using public.rating_dimensions rd where rv.review_id=rid and rv.rating_dimension_id=rd.id and rd.is_active;
   for v in select * from jsonb_array_elements(p_data->'values') loop
     insert into private.rating_values(review_id,rating_dimension_id,score) values(rid,(v->>'rating_dimension_id')::uuid,(v->>'score')::integer);
   end loop;
   return case when target_role='hidden' then 'Review saved. It remains hidden pending moderation.' else 'Your review has been saved.' end;
 elsif p_action='delete_review' then
   rid:=(p_data->>'id')::uuid;
   select * into r from private.reviews where id=rid and user_id=uid and deleted_at is null for update;
   if not found then raise exception 'Review not found.';end if;
   -- Keep only the unique author/entity moderation tombstone. Never resurrect hidden content.
   update private.reviews set deleted_at=now(),body='',overall_rating=null where id=rid;
   delete from private.rating_values where review_id=rid;
   return 'Review deleted.';
 elsif p_action='report' then
   rid:=(p_data->>'target_id')::uuid;target_role:=p_data->>'target_type';
   if target_role='review' then select entity_id into eid from private.reviews where id=rid and status='published' and deleted_at is null;
   elsif target_role='entity' then eid:=rid;
   else raise exception 'Report a review to flag its author for moderator review.';end if;
   select * into e from public.entities where id=eid and status='active';
   if not found or not private.can_contribute(e.school_id) then raise exception 'Use a verified email from this school to contribute.';end if;
   perform private.consume_limit('report',10);
   if exists(select 1 from private.reports where target_id=rid and target_type=target_role and reporter_user_id=uid and status='pending') then raise exception 'You already have an open report for this content.';end if;
   insert into private.reports(reporter_user_id,target_type,target_id,reason,details) values(uid,target_role,rid,p_data->>'reason',trim(coalesce(p_data->>'details','')));
   return 'Report sent to the moderation team.';
 elsif p_action in ('moderate_review','resolve_report','update_user') then
   if not private.is_staff() then raise exception 'Moderator access required.';end if;
   rid:=(p_data->>'id')::uuid;
   if p_action='moderate_review' then
     update private.reviews set status=p_data->>'status' where id=rid and deleted_at is null;
     if not found then raise exception 'Review not found.';end if;
   elsif p_action='resolve_report' then
     update private.reports set status='resolved',reviewed_by=uid,reviewed_at=now() where id=rid;
     if not found then raise exception 'Report not found.';end if;
   else
     if rid=uid then raise exception 'You cannot change your own role or suspension.';end if;
     select * into target_account from private.account_roles where user_id=rid for update;
     if not found then raise exception 'Account not found.';end if;
     target_role:=p_data->>'role';target_suspended:=(p_data->>'suspended')::boolean;
     if actual_role<>'admin' and (target_account.role<>'user' or target_role<>'user') then raise exception 'Only admins can manage staff roles.';end if;
     if target_account.role='admin' and (target_role<>'admin' or target_suspended) and (select count(*) from private.account_roles where role='admin' and not suspended)<=1 then raise exception 'Keep at least one active administrator.';end if;
     update private.account_roles set role=target_role,suspended=target_suspended where user_id=rid;
   end if;
   insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,rid);
   return case p_action when 'moderate_review' then 'Review visibility updated.' when 'resolve_report' then 'Report resolved.' else 'Account updated.' end;
 end if;
 if not private.is_admin() then raise exception 'Administrator access required.';end if;
 rid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
 if p_action='save_school' then
   select * into s from jsonb_populate_record(null::public.schools,p_data);
   if s.id is not null and not exists(select 1 from public.schools where id=s.id) then raise exception 'School not found.';end if;
   insert into public.schools(id,name,slug,email_domain,city,state,country,status) values(rid,trim(s.name),s.slug,lower(trim(s.email_domain)),coalesce(s.city,''),coalesce(s.state,''),coalesce(s.country,''),s.status)
   on conflict(id) do update set name=excluded.name,slug=excluded.slug,email_domain=excluded.email_domain,city=excluded.city,state=excluded.state,country=excluded.country,status=excluded.status;
 elsif p_action='save_category' then
   select * into c from jsonb_populate_record(null::public.categories,p_data);
   if c.id is not null and not exists(select 1 from public.categories where id=c.id) then raise exception 'Category not found.';end if;
   if exists(select 1 from public.categories existing where existing.slug=c.slug and existing.id<>rid and (existing.school_id=c.school_id or existing.school_id is null or c.school_id is null)) then raise exception 'That category slug conflicts with a global or school category. Choose a different slug.';end if;
   if c.school_id is not null and exists(select 1 from public.entities where category_id=rid and school_id<>c.school_id) then raise exception 'This category is used by another school.';end if;
   insert into public.categories(id,school_id,name,slug,description,icon,status,sort_order) values(rid,c.school_id,trim(c.name),c.slug,coalesce(c.description,''),coalesce(c.icon,'compass'),c.status,c.sort_order)
   on conflict(id) do update set school_id=excluded.school_id,name=excluded.name,slug=excluded.slug,description=excluded.description,icon=excluded.icon,status=excluded.status,sort_order=excluded.sort_order;
 elsif p_action='save_dimension' then
   select * into d from jsonb_populate_record(null::public.rating_dimensions,p_data);
   select * into old_d from public.rating_dimensions where id=rid for update;
   if d.id is not null and not found then raise exception 'Dimension not found.';end if;
   if old_d.id is not null and exists(select 1 from private.rating_values where rating_dimension_id=rid) and (d.min_value<>old_d.min_value or d.max_value<>old_d.max_value or d.category_id<>old_d.category_id) then raise exception 'This dimension has ratings. Disable it and create a new dimension to change its scale or category.';end if;
   insert into public.rating_dimensions(id,category_id,key,label,description,min_value,max_value,sort_order,is_required,is_active) values(rid,d.category_id,d.key,trim(d.label),coalesce(d.description,''),d.min_value,d.max_value,d.sort_order,d.is_required,d.is_active)
   on conflict(id) do update set category_id=excluded.category_id,key=excluded.key,label=excluded.label,description=excluded.description,min_value=excluded.min_value,max_value=excluded.max_value,sort_order=excluded.sort_order,is_required=excluded.is_required,is_active=excluded.is_active;
 elsif p_action='save_entity' then
   select * into e from jsonb_populate_record(null::public.entities,p_data);
   select * into old_e from public.entities where id=rid for update;
   if e.id is not null and not found then raise exception 'Entity not found.';end if;
   select * into c from public.categories where id=e.category_id;
   if not found or (c.school_id is not null and c.school_id<>e.school_id) then raise exception 'Choose a category available at this school.';end if;
   if old_e.id is not null and exists(select 1 from private.reviews where entity_id=rid) and (old_e.category_id<>e.category_id or old_e.school_id<>e.school_id) then raise exception 'An entity with reviews cannot change category or school.';end if;
   if exists(select 1 from public.entities where parent_entity_id=rid and school_id<>e.school_id) then raise exception 'Child entities must belong to the same school.';end if;
   current_parent:=e.parent_entity_id;visited:=array[rid];
   while current_parent is not null loop
     if current_parent=any(visited) then raise exception 'Parent relationships cannot contain a cycle.';end if;
     visited:=array_append(visited,current_parent);
     select parent_entity_id into current_parent from public.entities where id=current_parent and school_id=e.school_id;
     if not found then raise exception 'Parent must be in the same school.';end if;
   end loop;
   insert into public.entities(id,school_id,category_id,parent_entity_id,name,slug,short_description,description,location_name,address,latitude,longitude,official_url,source_name,source_url,last_verified_at,metadata,status,is_featured)
   values(rid,e.school_id,e.category_id,e.parent_entity_id,trim(e.name),e.slug,coalesce(e.short_description,''),coalesce(e.description,''),coalesce(e.location_name,''),coalesce(e.address,''),e.latitude,e.longitude,coalesce(e.official_url,''),coalesce(e.source_name,''),coalesce(e.source_url,''),e.last_verified_at,coalesce(e.metadata,'{}'),e.status,coalesce(e.is_featured,false))
   on conflict(id) do update set school_id=excluded.school_id,category_id=excluded.category_id,parent_entity_id=excluded.parent_entity_id,name=excluded.name,slug=excluded.slug,short_description=excluded.short_description,description=excluded.description,location_name=excluded.location_name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,official_url=excluded.official_url,source_name=excluded.source_name,source_url=excluded.source_url,last_verified_at=excluded.last_verified_at,metadata=excluded.metadata,status=excluded.status,is_featured=excluded.is_featured;
 else raise exception 'Unknown action.';end if;
 insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,rid);
 return 'Record saved.';
end $$;

alter function public.get_app_data() owner to rateduke_api;
alter function public.search_entities(text,uuid) owner to rateduke_api;
alter function public.app_command(text,jsonb) owner to rateduke_api;
revoke create on schema public from rateduke_api;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to rateduke_api;
revoke all on function public.get_app_data(),public.search_entities(text,uuid),public.app_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.get_app_data(),public.search_entities(text,uuid) to anon,authenticated;
grant execute on function public.app_command(text,jsonb) to authenticated;

-- An explicit operator-only RPC for initial setup. Not callable by runtime user sessions.
create function public.bootstrap_admin(p_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('rateduke:bootstrap',0));
 if exists(select 1 from private.account_roles where role='admin' and not suspended) then raise exception 'An active administrator already exists. Use the administration UI.';end if;
 select id into target from private.profiles where lower(email)=lower(trim(p_email)) and verified;
 if target is null then raise exception 'Sign in and verify that email before bootstrapping.';end if;
 update private.account_roles set role='admin',suspended=false where user_id=target;
 insert into private.audit_log(actor_id,action,target_id) values(target,'bootstrap_admin',target);
 return target;
end $$;
revoke all on function public.bootstrap_admin(text) from public,anon,authenticated,rateduke_api;
grant execute on function public.bootstrap_admin(text) to service_role;
commit;
