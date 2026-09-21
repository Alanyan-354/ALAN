-- Cover foreign-key lookups reported by the managed Supabase performance advisor.
do $$ begin execute format('grant usage,create on schema private to %I',current_user);end $$;
create index if not exists audit_log_actor on private.audit_log(actor_id);
create index if not exists question_responses_option_question on private.question_responses(option_id,question_id);
create index if not exists question_responses_user on private.question_responses(user_id);
create index if not exists reports_reviewer on private.reports(reviewed_by);
create index if not exists entities_category on public.entities(category_id);
create index if not exists questions_creator on public.questions(created_by);
create index if not exists questions_resolved_option on public.questions(resolved_option_id,id);
do $$ begin execute format('revoke create on schema private from %I',current_user);end $$;
