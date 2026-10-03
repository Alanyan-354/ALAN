begin;

-- Managed projects can retain an explicit ACL entry even for the migration owner.
do $$ begin execute format('grant usage, create on schema private to %I', current_user); end $$;
grant create on schema public, private to rateduke_api;

create table private.entity_gallery_images (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  storage_path text,
  source_url text,
  sort_order integer not null default 0 check (sort_order >= 0),
  alt_text text not null check (char_length(alt_text) between 1 and 240),
  kind text not null default 'photo' check (kind in ('photo','graphic')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  status text not null default 'pending' check (status in ('pending','ready')),
  created_by uuid references private.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((storage_path is null) <> (source_url is null))
);
create index entity_gallery_images_entity_order_idx on private.entity_gallery_images(entity_id,sort_order,id);
create unique index entity_gallery_images_storage_path_idx on private.entity_gallery_images(storage_path) where storage_path is not null;
alter table private.entity_gallery_images enable row level security;
create policy entity_gallery_images_read on private.entity_gallery_images for select to rateduke_api using (private.is_staff() or status='ready');
create policy entity_gallery_images_admin_write on private.entity_gallery_images for all to rateduke_api using (private.is_admin()) with check (private.is_admin());
grant select,insert,update,delete on private.entity_gallery_images to rateduke_api;

insert into private.entity_gallery_images(entity_id,source_url,sort_order,alt_text,kind,status,created_by,created_at)
select e.id,item.value->>'src',item.ordinality-1,coalesce(nullif(item.value->>'alt',''),e.name||' image'),
  case when item.value->>'kind'='graphic' then 'graphic' else 'photo' end,'ready',null,e.created_at
from public.entities e
cross join lateral jsonb_array_elements(case when jsonb_typeof(e.metadata->'gallery')='array' then e.metadata->'gallery' else '[]'::jsonb end) with ordinality item(value,ordinality)
where nullif(item.value->>'src','') is not null;

insert into private.entity_gallery_images(entity_id,storage_path,sort_order,alt_text,kind,width,height,status,created_by,created_at)
select s.entity_id,i.storage_path,i.sort_order,s.name||' community photo','photo',i.width,i.height,'ready',s.user_id,i.created_at
from private.entity_submission_images i join private.entity_submissions s on s.id=i.submission_id
where s.status='approved' and s.entity_id is not null and i.status='ready'
  and not exists(select 1 from private.entity_gallery_images g where g.storage_path=i.storage_path);

create function public.get_entity_gallery_data() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('images',coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'entity_id',g.entity_id,'storage_path',g.storage_path,'source_url',g.source_url,
    'sort_order',g.sort_order,'alt_text',g.alt_text,'kind',g.kind,'width',g.width,'height',g.height,
    'status',g.status,'uploaded',g.storage_path is not null
  ) order by g.entity_id,g.sort_order,g.id) filter(where g.id is not null),'[]'::jsonb))
  from private.entity_gallery_images g
  join public.entities e on e.id=g.entity_id
  where (g.status='ready' and e.status='active') or private.is_admin()
$$;

create function public.begin_entity_gallery_upload(p_entity uuid,p_count integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.request_user_id();v_existing integer;v_entity_name text;v_result jsonb;
begin
  if not private.is_admin() then raise exception 'Administrator access required.';end if;
  if p_count<1 or p_count>12 then raise exception 'Choose between 1 and 12 images.';end if;
  select name into v_entity_name from public.entities where id=p_entity for update;
  if v_entity_name is null then raise exception 'Entity not found.';end if;
  select count(*) into v_existing from private.entity_gallery_images where entity_id=p_entity;
  if v_existing+p_count>12 then raise exception 'An entity can have up to 12 images.';end if;
  with slots as (
    insert into private.entity_gallery_images(entity_id,storage_path,sort_order,alt_text,kind,status,created_by)
    select p_entity,'official/'||p_entity::text||'/'||gen_random_uuid()::text||'.webp',v_existing+n-1,v_entity_name||' official photo','photo','pending',v_user
    from generate_series(1,p_count) n returning id,storage_path,sort_order
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'index',sort_order-v_existing) order by sort_order),'[]'::jsonb) into v_result from slots;
  return v_result;
end$$;

create function public.mark_entity_gallery_image_ready(p_id uuid,p_width integer,p_height integer) returns void
language plpgsql security definer set search_path='' as $$
declare v_entity uuid;begin
  if not private.is_admin() then raise exception 'Administrator access required.';end if;
  update private.entity_gallery_images set status='ready',width=p_width,height=p_height where id=p_id and status='pending' returning entity_id into v_entity;
  if v_entity is null then raise exception 'Upload slot not found.';end if;
  insert into private.audit_log(actor_id,action,target_id) values(private.request_user_id(),'upload_entity_gallery_image',v_entity);
end$$;

create function public.cancel_entity_gallery_upload(p_ids uuid[]) returns text[]
language plpgsql security definer set search_path='' as $$
declare v_paths text[];begin
  if not private.is_admin() then raise exception 'Administrator access required.';end if;
  select coalesce(array_agg(storage_path) filter(where storage_path is not null),'{}') into v_paths from private.entity_gallery_images where id=any(p_ids) and status='pending';
  delete from private.entity_gallery_images where id=any(p_ids) and status='pending';return v_paths;
end$$;

create function public.save_entity_gallery(p_entity uuid,p_items jsonb) returns text[]
language plpgsql security definer set search_path='' as $$
declare v_count integer;v_paths text[];begin
  if not private.is_admin() then raise exception 'Administrator access required.';end if;
  if jsonb_typeof(p_items)<>'array' then raise exception 'Invalid gallery.';end if;
  v_count:=jsonb_array_length(p_items);if v_count>12 then raise exception 'An entity can have up to 12 images.';end if;
  if (select count(distinct (item->>'id')::uuid) from jsonb_array_elements(p_items) item)<>v_count then raise exception 'Gallery images must be unique.';end if;
  if exists(select 1 from jsonb_array_elements(p_items) item left join private.entity_gallery_images g on g.id=(item->>'id')::uuid and g.entity_id=p_entity and g.status='ready' where g.id is null) then raise exception 'Gallery image not found.';end if;
  select coalesce(array_agg(storage_path) filter(where storage_path is not null),'{}') into v_paths from private.entity_gallery_images where entity_id=p_entity and status='ready' and id not in(select (item->>'id')::uuid from jsonb_array_elements(p_items) item);
  delete from private.entity_gallery_images where entity_id=p_entity and status='ready' and id not in(select (item->>'id')::uuid from jsonb_array_elements(p_items) item);
  with parsed as(select (item->>'id')::uuid id,ordinality-1 sort_order,left(coalesce(nullif(btrim(item->>'alt_text'),''),'Campus entity image'),240) alt_text,case when item->>'kind'='graphic' then 'graphic' else 'photo' end kind from jsonb_array_elements(p_items) with ordinality x(item,ordinality))
  update private.entity_gallery_images g set sort_order=p.sort_order,alt_text=p.alt_text,kind=p.kind from parsed p where g.id=p.id;
  insert into private.audit_log(actor_id,action,target_id) values(private.request_user_id(),'update_entity_gallery',p_entity);
  return v_paths;
end$$;

create or replace function public.can_read_submission_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from private.entity_submission_images i join private.entity_submissions s on s.id=i.submission_id where i.storage_path=p_name and (s.user_id=private.request_user_id() or private.is_admin() or (s.status='approved' and exists(select 1 from public.entities e where e.id=s.entity_id and e.status='active'))))
or exists(select 1 from private.entity_gallery_images g join public.entities e on e.id=g.entity_id where g.storage_path=p_name and (private.is_admin() or (g.status='ready' and e.status='active')))
$$;
create function public.can_write_entity_gallery_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$select private.is_admin() and p_name like 'official/%' and position('..' in p_name)=0$$;

alter function public.get_entity_gallery_data() owner to rateduke_api;
alter function public.begin_entity_gallery_upload(uuid,integer) owner to rateduke_api;
alter function public.mark_entity_gallery_image_ready(uuid,integer,integer) owner to rateduke_api;
alter function public.cancel_entity_gallery_upload(uuid[]) owner to rateduke_api;
alter function public.save_entity_gallery(uuid,jsonb) owner to rateduke_api;
alter function public.can_read_submission_image(text) owner to rateduke_api;
alter function public.can_write_entity_gallery_image(text) owner to rateduke_api;
revoke all on function public.get_entity_gallery_data(),public.begin_entity_gallery_upload(uuid,integer),public.mark_entity_gallery_image_ready(uuid,integer,integer),public.cancel_entity_gallery_upload(uuid[]),public.save_entity_gallery(uuid,jsonb),public.can_write_entity_gallery_image(text) from public,anon,authenticated;
grant execute on function public.get_entity_gallery_data() to anon,authenticated;
grant execute on function public.begin_entity_gallery_upload(uuid,integer),public.mark_entity_gallery_image_ready(uuid,integer,integer),public.cancel_entity_gallery_upload(uuid[]),public.save_entity_gallery(uuid,jsonb),public.can_write_entity_gallery_image(text) to authenticated;

do $$begin if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists rateduke_submission_images_insert on storage.objects';
  execute $p$create policy rateduke_submission_images_insert on storage.objects for insert to authenticated with check(bucket_id='entity-images' and (public.can_write_submission_image(name) or public.can_write_entity_gallery_image(name)))$p$;
  execute 'drop policy if exists rateduke_submission_images_delete on storage.objects';
  execute $p$create policy rateduke_submission_images_delete on storage.objects for delete to authenticated using(bucket_id='entity-images' and (public.can_write_submission_image(name) or public.can_write_entity_gallery_image(name)))$p$;
end if;end$$;

revoke create on schema public, private from rateduke_api;

commit;
