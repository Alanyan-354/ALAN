-- Supabase protects the auth schema from custom roles on managed projects.
-- Mirror auth.uid() from request-local JWT claims so the deliberately
-- non-login, non-BYPASSRLS API role does not need auth schema access.
begin;

-- The Pulse hardening migration revokes CREATE after setup. Restore it only
-- for this controlled migration and remove it again before commit.
do $$ begin
 execute format('grant usage,create on schema private to %I',current_user);
 execute format('grant create on schema public to %I',current_user);
end $$;

create or replace function private.request_user_id() returns uuid
language sql stable
set search_path=''
as $$
 select coalesce(
  nullif(current_setting('request.jwt.claim.sub',true),''),
  nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
 )::uuid
$$;

revoke all on function private.request_user_id() from public,anon,authenticated;
grant execute on function private.request_user_id() to rateduke_api;
revoke usage on schema auth from rateduke_api;

-- Update migration-owned helpers while preserving their SECURITY DEFINER flags
-- and explicit search paths.
do $$
declare fn record; definition text;
begin
 for fn in
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
   and p.prokind='f'
   and p.proowner=(select oid from pg_roles where rolname=current_user)
   and pg_get_functiondef(p.oid) like '%auth.uid()%'
 loop
  definition:=replace(pg_get_functiondef(fn.oid),'auth.uid()','private.request_user_id()');
  execute definition;
 end loop;
end $$;

-- Public RPCs and their projection helper are owned by the constrained API
-- role. Temporarily assume that role to replace only functions it owns.
grant create on schema public,private to rateduke_api;
set local role rateduke_api;
do $$
declare fn record; definition text;
begin
 for fn in
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
   and p.prokind='f'
   and p.proowner=(select oid from pg_roles where rolname=current_user)
   and pg_get_functiondef(p.oid) like '%auth.uid()%'
 loop
  definition:=replace(pg_get_functiondef(fn.oid),'auth.uid()','private.request_user_id()');
  execute definition;
 end loop;
end $$;
reset role;
revoke create on schema public,private from rateduke_api;

alter policy profiles_own_update on private.profiles
 using(id=(select private.request_user_id()) and private.is_active_user())
 with check(id=(select private.request_user_id()) and private.is_active_user());
alter policy roles_read on private.account_roles
 using(user_id=(select private.request_user_id()) or private.is_staff());
alter policy reviews_read on private.reviews
 using(private.is_staff() or user_id=(select private.request_user_id()) or (status='published' and deleted_at is null and exists(select 1 from public.entities e where e.id=entity_id and e.status='active')));
alter policy reviews_insert on private.reviews
 with check(user_id=(select private.request_user_id()) and exists(select 1 from public.entities e where e.id=entity_id and e.status='active' and private.can_contribute(e.school_id)));
alter policy reviews_update on private.reviews
 using(private.is_staff() or (user_id=(select private.request_user_id()) and private.is_active_user()))
 with check(private.is_staff() or (user_id=(select private.request_user_id()) and private.is_active_user()));
alter policy values_insert on private.rating_values
 with check(exists(select 1 from private.reviews r where r.id=review_id and r.user_id=(select private.request_user_id()) and private.is_active_user()));
alter policy values_delete on private.rating_values
 using(exists(select 1 from private.reviews r where r.id=review_id and r.user_id=(select private.request_user_id()) and private.is_active_user()));
alter policy reports_read on private.reports
 using(private.is_staff() or reporter_user_id=(select private.request_user_id()));
alter policy reports_insert on private.reports
 with check(reporter_user_id=(select private.request_user_id()) and private.is_active_user());
alter policy audit_insert on private.audit_log
 with check(private.is_staff() and actor_id=(select private.request_user_id()));
alter policy limits_own on private.rate_limits
 using(user_id=(select private.request_user_id()) and private.is_active_user())
 with check(user_id=(select private.request_user_id()) and private.is_active_user());
alter policy question_responses_write on private.question_responses
 with check(user_id=(select private.request_user_id()) and private.is_active_user());
alter policy question_responses_update on private.question_responses
 using(user_id=(select private.request_user_id()) and private.is_active_user())
 with check(user_id=(select private.request_user_id()) and private.is_active_user());

do $$ begin
 execute format('revoke create on schema private from %I',current_user);
end $$;

commit;
