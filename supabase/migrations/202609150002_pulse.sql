-- Campus Pulse: shared Predictions and Student Stats questions.
do $$ begin execute format('grant usage,create on schema private to %I',current_user);end $$;
grant create on schema private to rateduke_api;
grant create on schema public to rateduke_api;
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  type text not null check(type in ('prediction','poll')),
  title text not null check(char_length(trim(title)) between 1 and 300),
  category text not null check(char_length(trim(category)) between 1 and 80),
  status text not null default 'draft' check(status in ('draft','open','closed','resolved','archived')),
  closes_at timestamptz,
  event_at timestamptz,
  resolved_option_id uuid,
  show_in_popup boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0 check(sort_order>=0),
  created_by uuid references private.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((type='prediction' and closes_at is not null and event_at is not null and closes_at<=event_at) or (type='poll' and event_at is null and resolved_option_id is null and status<>'resolved'))
);
create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null check(char_length(trim(label)) between 1 and 80),
  sort_order integer not null check(sort_order>=0),
  unique(question_id,label), unique(question_id,sort_order), unique(id,question_id)
);
alter table public.questions add constraint questions_resolved_option_fk foreign key(resolved_option_id,id) references public.question_options(id,question_id) deferrable initially deferred;
create table private.question_responses (
  question_id uuid not null references public.questions(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references private.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(question_id,user_id),
  foreign key(option_id,question_id) references public.question_options(id,question_id)
);
create index questions_school_type_status on public.questions(school_id,type,status,sort_order);
create index question_responses_option on private.question_responses(question_id,option_id);
create trigger touch_updated before update on public.questions for each row execute function private.touch_updated();
create trigger touch_updated before update on private.question_responses for each row execute function private.touch_updated();

alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table private.question_responses enable row level security;
create policy questions_read on public.questions for select using(private.is_staff() or status not in ('draft','archived'));
create policy questions_admin on public.questions for all using(private.is_admin()) with check(private.is_admin());
create policy questions_answer_lock on public.questions for update using(status='open' and private.can_contribute(school_id)) with check(status='open' and private.can_contribute(school_id));
create policy question_options_read on public.question_options for select using(exists(select 1 from public.questions q where q.id=question_id));
create policy question_options_admin on public.question_options for all using(private.is_admin()) with check(private.is_admin());
-- The private table is not exposed and clients have no schema/table grants. The projection
-- needs all rows to count participation while it conditionally redacts option totals.
create policy question_responses_read on private.question_responses for select using(private.is_staff() or exists(select 1 from public.questions q where q.id=question_id and q.status not in ('draft','archived')));
create policy question_responses_write on private.question_responses for insert with check(user_id=private.request_user_id() and private.is_active_user());
create policy question_responses_update on private.question_responses for update using(user_id=private.request_user_id() and private.is_active_user()) with check(user_id=private.request_user_id() and private.is_active_user());
grant select,insert,update,delete on public.questions,public.question_options to rateduke_api;
grant select,insert,update,delete on private.question_responses to rateduke_api;
revoke all on private.question_responses from public,anon,authenticated;

create function private.question_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with source as (
    select q.*,
      case when q.status='open' and q.closes_at is not null and q.closes_at<=now()
        then case when q.type='prediction' and q.event_at<=now() then 'awaiting_result' else 'closed' end
        when q.type='prediction' and q.status='closed' and q.event_at<=now() then 'awaiting_result'
        else q.status end as effective_status,
      (select qr.option_id from private.question_responses qr where qr.question_id=q.id and qr.user_id=private.request_user_id()) as own_option,
      (select count(*)::integer from private.question_responses qr where qr.question_id=q.id) as total
    from public.questions q where q.id=p_id
  ), visible as (
    select *, private.is_staff() or own_option is not null or effective_status in ('closed','resolved','awaiting_result') as show_results
    from source
  )
  select to_jsonb(v)-'own_option'-'total'-'show_results' || jsonb_build_object(
    'effective_status',v.effective_status,
    'response_count',v.total,
    'current_user_option_id',v.own_option,
    'results_visible',v.show_results,
    'can_answer',v.effective_status='open' and private.can_contribute(v.school_id),
    'options',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object(
      'response_count',case when v.show_results then (select count(*)::integer from private.question_responses r where r.question_id=v.id and r.option_id=o.id) else null end,
      'percentage',case when not v.show_results then null when v.total=0 then 0 else round(100.0*(select count(*) from private.question_responses r where r.question_id=v.id and r.option_id=o.id)/v.total)::integer end
    ) order by o.sort_order) from public.question_options o where o.question_id=v.id),'[]'::jsonb)
  ) from visible v
$$;

create function public.answer_question(p_question uuid,p_option uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.questions; effective text;
begin
  if private.request_user_id() is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
  perform pg_advisory_xact_lock(hashtextextended('rateduke:question:'||p_question::text||':'||private.request_user_id()::text,0));
  select * into q from public.questions where id=p_question;
  if not found then raise exception 'Question not found.';end if;
  effective:=case when q.status='open' and q.closes_at is not null and q.closes_at<=now() then 'closed' else q.status end;
  if effective<>'open' then raise exception 'This question is closed.';end if;
  if not private.can_contribute(q.school_id) then raise exception 'Use a verified email from this school to answer.';end if;
  select * into q from public.questions where id=p_question for update;
  if not found or q.status<>'open' or (q.closes_at is not null and q.closes_at<=now()) then raise exception 'This question is closed.';end if;
  if not exists(select 1 from public.question_options where id=p_option and question_id=q.id) then raise exception 'Choose an option from this question.';end if;
  perform private.consume_limit('question_response',60);
  insert into private.question_responses(question_id,option_id,user_id) values(q.id,p_option,private.request_user_id())
    on conflict(question_id,user_id) do update set option_id=excluded.option_id;
  return private.question_json(q.id);
end $$;

-- Preserve the existing command implementation and add a narrow question editor.
alter function public.app_command(text,jsonb) rename to app_command_core;
revoke all on function public.app_command_core(text,jsonb) from public,anon,authenticated;
create function public.app_command(p_action text,p_data jsonb) returns text language plpgsql security definer set search_path='' as $$
declare q public.questions; rid uuid; option_data jsonb; option_id uuid; option_ids uuid[]:=array[]::uuid[]; labels text[]:=array[]::text[]; has_responses boolean; old_status text;
begin
  if p_action<>'save_question' then return public.app_command_core(p_action,p_data);end if;
  if private.request_user_id() is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
  if not private.is_admin() then raise exception 'Administrator access required.';end if;
  if jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_data->'options')<>'array' or jsonb_array_length(p_data->'options') not between 2 and 4 then raise exception 'Questions need 2 to 4 options.';end if;
  perform pg_advisory_xact_lock(hashtextextended('rateduke:configuration',0));
  rid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
  select * into q from public.questions where id=rid for update;old_status:=q.status;
  if (p_data->>'id') is not null and not found then raise exception 'Question not found.';end if;
  has_responses:=exists(select 1 from private.question_responses where question_id=rid);
  if has_responses and (q.school_id<>(p_data->>'school_id')::uuid or q.type<>p_data->>'type' or q.title<>trim(p_data->>'title')) then raise exception 'School, type and title are locked after responses arrive.';end if;
  if old_status in ('closed','resolved','archived') and p_data->>'status'='open' then raise exception 'Closed questions cannot be reopened.';end if;
  if p_data->>'type'='prediction' then
    if nullif(p_data->>'closes_at','') is null or nullif(p_data->>'event_at','') is null then raise exception 'Predictions need a closing time and event time.';end if;
    if (p_data->>'closes_at')::timestamptz>(p_data->>'event_at')::timestamptz then raise exception 'Closing time must be before or at the event time.';end if;
    if q.id is null and (p_data->>'closes_at')::timestamptz<=now() then raise exception 'Prediction closing time must be in the future.';end if;
    if p_data->>'status'='resolved' and (p_data->>'event_at')::timestamptz>now() then raise exception 'A prediction can be resolved only after its event time.';end if;
    if p_data->>'status'='resolved' and nullif(p_data->>'resolved_option_id','') is null then raise exception 'Choose the resolved result before resolving this prediction.';end if;
    if p_data->>'status'<>'resolved' and nullif(p_data->>'resolved_option_id','') is not null then raise exception 'A result can be set only when the prediction is resolved.';end if;
  elsif nullif(p_data->>'event_at','') is not null or nullif(p_data->>'resolved_option_id','') is not null or p_data->>'status'='resolved' then raise exception 'Student Stats questions do not use event results.';
  end if;
  for option_data in select * from jsonb_array_elements(p_data->'options') loop
    if char_length(trim(option_data->>'label')) not between 1 and 80 then raise exception 'Each option needs a short label.';end if;
    if lower(trim(option_data->>'label'))=any(labels) then raise exception 'Question options must be unique.';end if;
    labels:=array_append(labels,lower(trim(option_data->>'label')));option_id:=coalesce((option_data->>'id')::uuid,gen_random_uuid());option_ids:=array_append(option_ids,option_id);
    if has_responses and not exists(select 1 from public.question_options o where o.id=option_id and o.question_id=rid and o.label=trim(option_data->>'label')) then raise exception 'Options are locked after responses arrive.';end if;
  end loop;
  if has_responses and (select count(*) from public.question_options where question_id=rid)<>array_length(option_ids,1) then raise exception 'Options are locked after responses arrive.';end if;
  if nullif(p_data->>'resolved_option_id','') is not null and not ((p_data->>'resolved_option_id')::uuid=any(option_ids)) then raise exception 'The resolved option must belong to this question.';end if;
  insert into public.questions(id,school_id,type,title,category,status,closes_at,event_at,resolved_option_id,show_in_popup,is_featured,sort_order,created_by)
    values(rid,(p_data->>'school_id')::uuid,p_data->>'type',trim(p_data->>'title'),trim(p_data->>'category'),p_data->>'status',nullif(p_data->>'closes_at','')::timestamptz,nullif(p_data->>'event_at','')::timestamptz,nullif(p_data->>'resolved_option_id','')::uuid,coalesce((p_data->>'show_in_popup')::boolean,false),coalesce((p_data->>'is_featured')::boolean,false),(p_data->>'sort_order')::integer,private.request_user_id())
    on conflict(id) do update set school_id=excluded.school_id,type=excluded.type,title=excluded.title,category=excluded.category,status=excluded.status,closes_at=excluded.closes_at,event_at=excluded.event_at,resolved_option_id=excluded.resolved_option_id,show_in_popup=excluded.show_in_popup,is_featured=excluded.is_featured,sort_order=excluded.sort_order;
  if not has_responses then
    update public.questions set resolved_option_id=null where id=rid;delete from public.question_options where question_id=rid;
    for option_data in select * from jsonb_array_elements(p_data->'options') loop
      insert into public.question_options(id,question_id,label,sort_order) values(coalesce((option_data->>'id')::uuid,option_ids[((option_data->>'sort_order')::integer)+1]),rid,trim(option_data->>'label'),(option_data->>'sort_order')::integer);
    end loop;
    update public.questions set resolved_option_id=nullif(p_data->>'resolved_option_id','')::uuid where id=rid;
  end if;
  insert into private.audit_log(actor_id,action,target_id) values(private.request_user_id(),p_action,rid);
  return 'Question saved.';
end $$;

create or replace function public.get_app_data() returns jsonb language sql stable security definer set search_path='' as $$
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
 'questions',coalesce((select jsonb_agg(private.question_json(q.id) order by q.sort_order,q.created_at) from public.questions q where private.is_staff() or q.status not in ('draft','archived')),'[]'::jsonb),
 'viewer',private.account_json(private.request_user_id()))
$$;

alter function private.question_json(uuid) owner to rateduke_api;
alter function public.answer_question(uuid,uuid) owner to rateduke_api;
alter function public.app_command(text,jsonb) owner to rateduke_api;
alter function public.get_app_data() owner to rateduke_api;
revoke all on function private.question_json(uuid),public.answer_question(uuid,uuid),public.app_command_core(text,jsonb),public.app_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.question_json(uuid),public.app_command_core(text,jsonb) to rateduke_api;
grant execute on function public.answer_question(uuid,uuid),public.app_command(text,jsonb) to authenticated;
grant execute on function public.get_app_data() to anon,authenticated;
revoke create on schema private from rateduke_api;
revoke create on schema public from rateduke_api;
do $$ begin execute format('revoke create on schema private from %I',current_user);end $$;
