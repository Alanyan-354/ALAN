-- Managed projects may restore the auth schema's default privileges after the
-- initial migration. The RLS-bound API role needs only enough access to call
-- auth.uid(); it receives no access to auth tables.
grant usage on schema auth to rateduke_api;
grant execute on function auth.uid() to rateduke_api;
