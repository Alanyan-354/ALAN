begin;

-- Managed projects can retain an explicit ACL entry even for the migration owner.
do $$ begin execute format('grant usage, create on schema private to %I',current_user); end $$;

alter table private.profiles add column if not exists last_sign_in_at timestamptz;

update private.profiles p
set last_sign_in_at=u.last_sign_in_at
from auth.users u
where u.id=p.id and p.last_sign_in_at is distinct from u.last_sign_in_at;

create or replace function private.sync_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.profiles(id,email,verified,last_sign_in_at)
 values(new.id,coalesce(new.email,''),new.email_confirmed_at is not null,new.last_sign_in_at)
 on conflict(id) do update set
  email=excluded.email,
  verified=excluded.verified,
  last_sign_in_at=excluded.last_sign_in_at;
 insert into private.account_roles(user_id) values(new.id) on conflict do nothing;
 return new;
end $$;

drop trigger if exists rateduke_auth_sync on auth.users;
create trigger rateduke_auth_sync
after insert or update of email,email_confirmed_at,last_sign_in_at on auth.users
for each row execute function private.sync_auth_user();

create or replace function private.account_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,
  'email',p.email,
  'nickname',p.nickname,
  'verified',p.verified,
  'role',a.role,
  'suspended',a.suspended,
  'created_at',p.created_at,
  'updated_at',p.updated_at,
  'last_sign_in_at',p.last_sign_in_at,
  'review_count',(select count(*) from private.reviews r where r.user_id=p.id and r.deleted_at is null),
  'response_count',(select count(*) from private.question_responses qr where qr.user_id=p.id)
 )
 from private.profiles p join private.account_roles a on a.user_id=p.id where p.id=p_id
$$;

commit;
