begin;

alter table private.reports drop constraint if exists reports_target_type_check;
alter table private.reports add constraint reports_target_type_check check(target_type in ('review','entity','user','forum_post','forum_comment'));
alter table private.reports add column if not exists target_author_user_id uuid references private.profiles(id) on delete set null;

create table private.forum_editorial_identities(
 id uuid primary key default gen_random_uuid(),name text not null unique check(length(trim(name)) between 2 and 80),
 seeded boolean not null default true,created_at timestamptz not null default now()
);
create table private.forum_posts(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 author_user_id uuid references private.profiles(id),editorial_identity_id uuid references private.forum_editorial_identities(id),
 title text not null check(length(trim(title)) between 3 and 160),body text not null check(length(trim(body)) between 1 and 6000),
 status text not null default 'draft' check(status in ('draft','published','hidden','deleted')),cover_image_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),published_at timestamptz,deleted_at timestamptz,
 check((author_user_id is not null)::integer+(editorial_identity_id is not null)::integer=1),unique(id,school_id)
);
create table private.forum_post_images(
 id uuid primary key default gen_random_uuid(),post_id uuid not null references private.forum_posts(id) on delete cascade,
 storage_path text,bundled_path text,sort_order integer not null check(sort_order between 0 and 8),
 width integer not null check(width between 1 and 12000),height integer not null check(height between 1 and 12000),
 status text not null default 'pending' check(status in ('pending','ready')),created_at timestamptz not null default now(),
 check((storage_path is not null)::integer+(bundled_path is not null)::integer=1),unique(post_id,sort_order),unique(id,post_id)
);
alter table private.forum_posts add constraint forum_posts_cover_fk foreign key(cover_image_id,id) references private.forum_post_images(id,post_id) deferrable initially deferred;
create table private.forum_comments(
 id uuid primary key default gen_random_uuid(),post_id uuid not null references private.forum_posts(id) on delete cascade,
 parent_comment_id uuid,author_user_id uuid references private.profiles(id),editorial_identity_id uuid references private.forum_editorial_identities(id),
 body text not null check(length(body)<=1500),status text not null default 'published' check(status in ('published','hidden','deleted')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 check((author_user_id is not null)::integer+(editorial_identity_id is not null)::integer=1),
 unique(id,post_id),foreign key(parent_comment_id,post_id) references private.forum_comments(id,post_id)
);
create table private.forum_post_likes(
 post_id uuid not null references private.forum_posts(id) on delete cascade,user_id uuid not null references private.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(post_id,user_id)
);

create index forum_posts_school_latest on private.forum_posts(school_id,published_at desc,id desc) where status='published';
create index forum_images_post_order on private.forum_post_images(post_id,sort_order) where status='ready';
create index forum_comments_roots on private.forum_comments(post_id,created_at desc,id desc) where parent_comment_id is null;
create index forum_comments_parent on private.forum_comments(parent_comment_id,created_at,id) where parent_comment_id is not null;
create index forum_comments_author on private.forum_comments(author_user_id) where author_user_id is not null;
create index forum_likes_user on private.forum_post_likes(user_id,created_at desc);

create trigger forum_posts_touch before update on private.forum_posts for each row execute function private.touch_updated();
create trigger forum_comments_touch before update on private.forum_comments for each row execute function private.touch_updated();

alter table private.forum_editorial_identities enable row level security;
alter table private.forum_posts enable row level security;
alter table private.forum_post_images enable row level security;
alter table private.forum_comments enable row level security;
alter table private.forum_post_likes enable row level security;
create policy forum_editorial_read on private.forum_editorial_identities for select using(true);
create policy forum_posts_read on private.forum_posts for select using(status='published' or private.is_staff() or author_user_id=private.request_user_id());
create policy forum_posts_insert on private.forum_posts for insert with check(author_user_id=private.request_user_id() and editorial_identity_id is null and status='draft' and private.can_contribute(school_id));
create policy forum_posts_update on private.forum_posts for update using(private.is_staff() or author_user_id=private.request_user_id()) with check(private.is_staff() or (author_user_id=private.request_user_id() and editorial_identity_id is null));
create policy forum_posts_delete on private.forum_posts for delete using(status='draft' and author_user_id=private.request_user_id());
create policy forum_images_read on private.forum_post_images for select using(exists(select 1 from private.forum_posts p where p.id=post_id));
create policy forum_images_insert on private.forum_post_images for insert with check(exists(select 1 from private.forum_posts p where p.id=post_id and p.status='draft' and p.author_user_id=private.request_user_id()));
create policy forum_images_update on private.forum_post_images for update using(exists(select 1 from private.forum_posts p where p.id=post_id and p.status='draft' and p.author_user_id=private.request_user_id()));
create policy forum_comments_read on private.forum_comments for select using(exists(select 1 from private.forum_posts p where p.id=post_id));
create policy forum_comments_insert on private.forum_comments for insert with check(author_user_id=private.request_user_id() and editorial_identity_id is null and exists(select 1 from private.forum_posts p where p.id=post_id and p.status='published' and private.can_contribute(p.school_id)));
create policy forum_comments_update on private.forum_comments for update using(private.is_staff() or author_user_id=private.request_user_id()) with check(private.is_staff() or author_user_id=private.request_user_id());
create policy forum_likes_read on private.forum_post_likes for select using(exists(select 1 from private.forum_posts p where p.id=post_id));
create policy forum_likes_write on private.forum_post_likes for all using(user_id=private.request_user_id() and private.is_active_user()) with check(user_id=private.request_user_id() and private.is_active_user());

grant select,insert,update,delete on private.forum_editorial_identities,private.forum_posts,private.forum_post_images,private.forum_comments,private.forum_post_likes to rateduke_api;
revoke all on private.forum_editorial_identities,private.forum_posts,private.forum_post_images,private.forum_comments,private.forum_post_likes from public,anon,authenticated;

create function private.forum_author_name(p_user uuid,p_editorial uuid) returns text language sql stable security definer set search_path='' as $$
 select case when p_editorial is not null then (select name from private.forum_editorial_identities where id=p_editorial) else (select nickname from private.profiles where id=p_user) end
$$;
create function private.forum_image_json(p_image uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'storage_path',i.storage_path,'bundled_path',i.bundled_path,'width',i.width,'height',i.height,'sort_order',i.sort_order) from private.forum_post_images i where i.id=p_image and i.status='ready'
$$;

create function public.get_forum_feed(p_school uuid,p_sort text default 'hot',p_page integer default 1,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_page integer:=greatest(1,coalesce(p_page,1));v_limit integer:=least(50,greatest(1,coalesce(p_limit,20)));v_offset integer;v_items jsonb;v_more boolean;
begin
 if p_sort not in ('hot','latest') then p_sort:='hot';end if;v_offset:=(v_page-1)*v_limit;
 with facts as(
  select p.*,coalesce(l.n,0)::integer like_count,coalesce(c.n,0)::integer comment_count,
   (1+coalesce(l.n,0)+2*coalesce(c.n,0))/power(greatest(0,extract(epoch from(now()-p.published_at))/3600)+2,1.25) hot_score
  from private.forum_posts p
  left join lateral(select count(*) n from private.forum_post_likes x where x.post_id=p.id) l on true
  left join lateral(select count(*) n from private.forum_comments x where x.post_id=p.id and x.status='published') c on true
  where p.school_id=p_school and p.status='published'
 ),ranked as(
  select f.*,row_number() over(order by case when p_sort='hot' then f.hot_score end desc,f.published_at desc,f.id desc) rn from facts f
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'school_id',r.school_id,'title',r.title,'cover',private.forum_image_json(r.cover_image_id),'author_name',private.forum_author_name(r.author_user_id,r.editorial_identity_id),'created_at',r.published_at,'like_count',r.like_count,'comment_count',r.comment_count,'liked_by_viewer',exists(select 1 from private.forum_post_likes x where x.post_id=r.id and x.user_id=private.request_user_id()),'hot_score',r.hot_score) order by r.rn),'[]'::jsonb),exists(select 1 from ranked where rn>v_offset+v_limit)
 into v_items,v_more from ranked r where r.rn>v_offset and r.rn<=v_offset+v_limit;
 return jsonb_build_object('items',v_items,'page',v_page,'page_size',v_limit,'has_more',coalesce(v_more,false));
end $$;

create function public.get_forum_post(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'school_id',p.school_id,'title',p.title,'body',p.body,'cover',private.forum_image_json(p.cover_image_id),
  'images',coalesce((select jsonb_agg(private.forum_image_json(i.id) order by i.sort_order) from private.forum_post_images i where i.post_id=p.id and i.status='ready'),'[]'::jsonb),
  'author_name',private.forum_author_name(p.author_user_id,p.editorial_identity_id),'created_at',p.published_at,'like_count',(select count(*) from private.forum_post_likes l where l.post_id=p.id),
  'comment_count',(select count(*) from private.forum_comments c where c.post_id=p.id and c.status='published'),'liked_by_viewer',exists(select 1 from private.forum_post_likes l where l.post_id=p.id and l.user_id=private.request_user_id()),
  'hot_score',(1+(select count(*) from private.forum_post_likes l where l.post_id=p.id)+2*(select count(*) from private.forum_comments c where c.post_id=p.id and c.status='published'))/power(greatest(0,extract(epoch from(now()-p.published_at))/3600)+2,1.25),
  'status',p.status,'can_interact',p.status='published' and private.can_contribute(p.school_id),'can_delete',p.author_user_id=private.request_user_id() or private.is_staff())
 from private.forum_posts p where p.id=p_id and p.status in ('published','hidden') and (p.status='published' or private.is_staff())
$$;

create function public.get_forum_comments(p_post uuid,p_parent uuid default null,p_page integer default 1,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_page integer:=greatest(1,coalesce(p_page,1));v_limit integer:=least(50,greatest(1,coalesce(p_limit,20)));v_offset integer;v_items jsonb;v_more boolean;
begin v_offset:=(v_page-1)*v_limit;
 with ranked as(
  select c.*,row_number() over(order by case when p_parent is null then c.created_at end desc,case when p_parent is not null then c.created_at end asc,c.id) rn
  from private.forum_comments c
  where c.post_id=p_post and c.parent_comment_id is not distinct from p_parent
    and exists(select 1 from private.forum_posts p where p.id=c.post_id and (p.status='published' or private.is_staff()))
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'post_id',r.post_id,'parent_comment_id',r.parent_comment_id,'author_name',private.forum_author_name(r.author_user_id,r.editorial_identity_id),'body',case r.status when 'published' then r.body when 'hidden' then 'This comment was hidden by the moderation team.' else 'This comment was deleted by its author.' end,'status',r.status,'created_at',r.created_at,'reply_count',(select count(*) from private.forum_comments c where c.parent_comment_id=r.id),'can_delete',r.author_user_id=private.request_user_id() or private.is_staff(),'replying_to',(select private.forum_author_name(p.author_user_id,p.editorial_identity_id) from private.forum_comments p where p.id=r.parent_comment_id)) order by r.rn),'[]'::jsonb),exists(select 1 from ranked where rn>v_offset+v_limit)
 into v_items,v_more from ranked r where r.rn>v_offset and r.rn<=v_offset+v_limit;
 return jsonb_build_object('items',v_items,'page',v_page,'page_size',v_limit,'has_more',coalesce(v_more,false));end $$;

create function public.begin_forum_post(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();pid uuid:=gen_random_uuid();iid uuid;school uuid;cover_index integer;images jsonb;item jsonb;idx integer:=0;slots jsonb:='[]'::jsonb;
begin
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
 school:=(p_data->>'school_id')::uuid;images:=p_data->'images';cover_index:=(p_data->>'cover_index')::integer;
 if not private.can_contribute(school) then raise exception 'Use a verified email from this school to create a post.';end if;
 if length(trim(coalesce(p_data->>'title',''))) not between 3 and 160 or length(trim(coalesce(p_data->>'body',''))) not between 1 and 6000 then raise exception 'Add a title and post text.';end if;
 if jsonb_typeof(images)<>'array' or jsonb_array_length(images) not between 1 and 9 or cover_index not between 0 and jsonb_array_length(images)-1 then raise exception 'Add between one and nine images and choose a cover.';end if;
 perform private.consume_limit('forum_post',5);perform pg_advisory_xact_lock(hashtextextended('rateduke:forum:'||uid::text,0));
 insert into private.forum_posts(id,school_id,author_user_id,title,body,status) values(pid,school,uid,trim(p_data->>'title'),trim(p_data->>'body'),'draft');
 for item in select * from jsonb_array_elements(images) loop
  iid:=gen_random_uuid();insert into private.forum_post_images(id,post_id,storage_path,sort_order,width,height) values(iid,pid,uid::text||'/'||pid::text||'/'||iid::text||'.webp',idx,(item->>'width')::integer,(item->>'height')::integer);
  slots:=slots||jsonb_build_array(jsonb_build_object('id',iid,'index',idx,'path',uid::text||'/'||pid::text||'/'||iid::text||'.webp'));
  if idx=cover_index then update private.forum_posts set cover_image_id=iid where id=pid;end if;idx:=idx+1;
 end loop;return jsonb_build_object('id',pid,'images',slots);end $$;
create function public.mark_forum_image_ready(p_id uuid,p_width integer,p_height integer) returns void language plpgsql security definer set search_path='' as $$
begin update private.forum_post_images i set status='ready',width=p_width,height=p_height from private.forum_posts p where i.id=p_id and p.id=i.post_id and p.status='draft' and p.author_user_id=private.request_user_id();if not found then raise exception 'Upload slot not found.';end if;end $$;
create function public.finalize_forum_post(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin update private.forum_posts p set status='published',published_at=now() where p.id=p_id and p.status='draft' and p.author_user_id=private.request_user_id() and p.cover_image_id is not null and exists(select 1 from private.forum_post_images i where i.id=p.cover_image_id and i.status='ready') and not exists(select 1 from private.forum_post_images i where i.post_id=p.id and i.status<>'ready');if not found then raise exception 'Finish uploading every image before publishing.';end if;return p_id;end $$;
create function public.get_forum_draft_paths(p_id uuid) returns text[] language sql stable security definer set search_path='' as $$select coalesce(array_agg(i.storage_path),'{}') from private.forum_post_images i join private.forum_posts p on p.id=i.post_id where p.id=p_id and p.status='draft' and p.author_user_id=private.request_user_id()$$;
create function public.cancel_forum_post(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin delete from private.forum_posts where id=p_id and status='draft' and author_user_id=private.request_user_id();end $$;

alter function public.app_command(text,jsonb) rename to app_command_before_forum;
revoke all on function public.app_command_before_forum(text,jsonb) from public,anon,authenticated;
create function public.app_command(p_action text,p_data jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();rid uuid;pid uuid;parent_id uuid;school uuid;target text;body text;
begin
 if p_action not in ('forum_toggle_like','forum_comment','forum_delete_comment','forum_delete_post','moderate_forum_post','moderate_forum_comment') and not(p_action='report' and p_data->>'target_type' in ('forum_post','forum_comment')) then return public.app_command_before_forum(p_action,p_data);end if;
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;perform pg_advisory_xact_lock(hashtextextended('rateduke:forum:'||uid::text,0));rid:=(p_data->>'id')::uuid;
 if p_action='forum_toggle_like' then
  select id,school_id into pid,school from private.forum_posts where id=rid and status='published';if pid is null then raise exception 'Post not found.';end if;if not private.can_contribute(school) then raise exception 'Use a verified email from this school to like posts.';end if;perform private.consume_limit('forum_like',120);
  delete from private.forum_post_likes where post_id=pid and user_id=uid;if found then return 'Like removed.';end if;insert into private.forum_post_likes(post_id,user_id) values(pid,uid);return 'Post liked.';
 elsif p_action='forum_comment' then
  pid:=(p_data->>'post_id')::uuid;parent_id:=nullif(p_data->>'parent_comment_id','')::uuid;body:=trim(coalesce(p_data->>'body',''));select school_id into school from private.forum_posts where id=pid and status='published';if school is null then raise exception 'Post not found.';end if;if not private.can_contribute(school) then raise exception 'Use a verified email from this school to comment.';end if;if length(body) not between 1 and 1500 then raise exception 'Comments must be between 1 and 1,500 characters.';end if;if parent_id is not null and not exists(select 1 from private.forum_comments where id=parent_id and post_id=pid) then raise exception 'Replies must stay within the same post.';end if;perform private.consume_limit('forum_comment',30);insert into private.forum_comments(post_id,parent_comment_id,author_user_id,body) values(pid,parent_id,uid,body) returning id into rid;return rid::text;
 elsif p_action='forum_delete_comment' then update private.forum_comments set status='deleted',body='',deleted_at=now() where id=rid and (author_user_id=uid or private.is_staff());if not found then raise exception 'Comment not found.';end if;return 'Comment deleted.';
 elsif p_action='forum_delete_post' then update private.forum_posts set status='deleted',deleted_at=now() where id=rid and (author_user_id=uid or private.is_staff());if not found then raise exception 'Post not found.';end if;return 'Post deleted.';
 elsif p_action in ('moderate_forum_post','moderate_forum_comment') then if not private.is_staff() then raise exception 'Moderator access required.';end if;target:=p_data->>'status';if target not in ('published','hidden') then raise exception 'Invalid moderation status.';end if;if p_action='moderate_forum_post' then update private.forum_posts set status=target where id=rid and status<>'deleted';else update private.forum_comments set status=target where id=rid and status<>'deleted';end if;if not found then raise exception 'Forum content not found.';end if;insert into private.audit_log(actor_id,action,target_id) values(uid,p_action,rid);return 'Forum visibility updated.';
 else
  rid:=(p_data->>'target_id')::uuid;target:=p_data->>'target_type';if target='forum_post' then select id,school_id,author_user_id into pid,school,parent_id from private.forum_posts where id=rid and status='published';else select c.post_id,p.school_id,c.author_user_id into pid,school,parent_id from private.forum_comments c join private.forum_posts p on p.id=c.post_id where c.id=rid and c.status='published' and p.status='published';end if;if pid is null then raise exception 'Forum content not found.';end if;if not private.can_contribute(school) then raise exception 'Use a verified email from this school to report content.';end if;perform private.consume_limit('report',10);insert into private.reports(reporter_user_id,target_type,target_id,target_author_user_id,reason,details) values(uid,target,rid,parent_id,p_data->>'reason',trim(coalesce(p_data->>'details','')));return 'Report sent to the moderation team.';
 end if;
end $$;

alter function private.forum_author_name(uuid,uuid) owner to rateduke_api;
alter function private.forum_image_json(uuid) owner to rateduke_api;
alter function public.get_forum_feed(uuid,text,integer,integer) owner to rateduke_api;
alter function public.get_forum_post(uuid) owner to rateduke_api;
alter function public.get_forum_comments(uuid,uuid,integer,integer) owner to rateduke_api;
alter function public.begin_forum_post(jsonb) owner to rateduke_api;
alter function public.mark_forum_image_ready(uuid,integer,integer) owner to rateduke_api;
alter function public.finalize_forum_post(uuid) owner to rateduke_api;
alter function public.get_forum_draft_paths(uuid) owner to rateduke_api;
alter function public.cancel_forum_post(uuid) owner to rateduke_api;
alter function public.app_command(text,jsonb) owner to rateduke_api;
revoke all on function private.forum_author_name(uuid,uuid),private.forum_image_json(uuid) from public,anon,authenticated;
grant execute on function private.forum_author_name(uuid,uuid),private.forum_image_json(uuid),public.app_command_before_forum(text,jsonb) to rateduke_api;
revoke all on function public.get_forum_feed(uuid,text,integer,integer),public.get_forum_post(uuid),public.get_forum_comments(uuid,uuid,integer,integer),public.begin_forum_post(jsonb),public.mark_forum_image_ready(uuid,integer,integer),public.finalize_forum_post(uuid),public.get_forum_draft_paths(uuid),public.cancel_forum_post(uuid),public.app_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.get_forum_feed(uuid,text,integer,integer),public.get_forum_post(uuid),public.get_forum_comments(uuid,uuid,integer,integer) to anon,authenticated;
grant execute on function public.begin_forum_post(jsonb),public.mark_forum_image_ready(uuid,integer,integer),public.finalize_forum_post(uuid),public.get_forum_draft_paths(uuid),public.cancel_forum_post(uuid),public.app_command(text,jsonb) to authenticated;

create function public.can_read_forum_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.forum_post_images i join private.forum_posts p on p.id=i.post_id where i.storage_path=p_name and i.status='ready' and (p.status='published' or p.author_user_id=private.request_user_id() or private.is_staff()))$$;
create function public.can_write_forum_image(p_name text) returns boolean language sql stable security definer set search_path='' as $$select split_part(p_name,'/',1)=private.request_user_id()::text and exists(select 1 from private.forum_post_images i join private.forum_posts p on p.id=i.post_id where i.storage_path=p_name and p.status='draft' and p.author_user_id=private.request_user_id())$$;
alter function public.can_read_forum_image(text) owner to rateduke_api;alter function public.can_write_forum_image(text) owner to rateduke_api;
revoke all on function public.can_read_forum_image(text),public.can_write_forum_image(text) from public,anon,authenticated;grant execute on function public.can_read_forum_image(text) to anon,authenticated;grant execute on function public.can_write_forum_image(text) to authenticated;

insert into private.forum_editorial_identities(id,name,seeded) values('00000000-0000-4000-8000-000000000600','RATEDUKE Campus Team',true),('00000000-0000-4000-8000-000000000601','Campus Contributor',true) on conflict(id) do nothing;
with duke as(select id school_id from public.schools where slug='duke-university'),seed(id,title,body,hours,cover) as(values
 ('00000000-0000-4000-8000-000000000610'::uuid,'Perkins or Bostock? A quiet-seat field guide','A practical walk-through of study environments: natural light, nearby outlets, conversation level, and how each floor feels during a study session.',-3,1),
 ('00000000-0000-4000-8000-000000000611'::uuid,'An unhurried East Campus morning','A small visual diary of brick paths, shaded benches, and the kind of ten-minute pause that makes a full class day feel more manageable.',-8,4),
 ('00000000-0000-4000-8000-000000000612'::uuid,'Brodhead lunch: build a calmer route','Decide before you arrive, keep circulation lanes clear, and take your meal outside when the weather is comfortable.',-14,6),
 ('00000000-0000-4000-8000-000000000613'::uuid,'A slow loop through Duke Gardens','A gentle study-break route built around paths, water, leaves, and a place to sit. Leave every corner as you found it.',-20,8),
 ('00000000-0000-4000-8000-000000000614'::uuid,'Cameron game-day essentials, minus the rush','Water, a light layer, a clear meeting point, and a plan for getting home make a crowded campus event easier.',-27,10),
 ('00000000-0000-4000-8000-000000000615'::uuid,'West Campus light: when the stone feels warm','Late afternoon brings out texture in arches, steps, and trees. These are general photo notes, not a weather promise.',-36,12),
 ('00000000-0000-4000-8000-000000000616'::uuid,'Three small habits for an easier campus commute','Leave a buffer, check the next connection, and keep one backup route in mind. The best commute has fewer decisions.',-48,14),
 ('00000000-0000-4000-8000-000000000617'::uuid,'A Durham study-break route for a reset','Books, coffee, a short walk, and a quiet corner: a generic off-campus reset built around slowing down.',-62,15)
) insert into private.forum_posts(id,school_id,editorial_identity_id,title,body,status,created_at,updated_at,published_at)
 select seed.id,duke.school_id,'00000000-0000-4000-8000-000000000600',title,body,'published',now()+hours*interval '1 hour',now()+hours*interval '1 hour',now()+hours*interval '1 hour' from duke,seed on conflict(id) do nothing;
with assets(n,post_n,ord,w,h) as(values (1,610,0,1000,1320),(2,610,1,1200,1000),(3,610,2,1000,1320),(4,611,0,1000,1320),(5,611,1,1200,1000),(6,612,0,1000,1320),(7,612,1,1200,1000),(8,613,0,1000,1320),(9,613,1,1200,1000),(10,614,0,1000,1320),(11,614,1,1200,1000),(12,615,0,1000,1320),(13,615,1,1200,1000),(14,616,0,1000,1320),(15,617,0,1000,1320),(16,617,1,1200,1000))
insert into private.forum_post_images(id,post_id,bundled_path,sort_order,width,height,status)
select ('00000000-0000-4000-8000-'||lpad((700+n-1)::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(post_n::text,12,'0'))::uuid,'/forum-seed/'||lpad(n::text,2,'0')||'.webp',ord,w,h,'ready' from assets on conflict(id) do nothing;
update private.forum_posts p set cover_image_id=('00000000-0000-4000-8000-'||lpad((699+x.cover)::text,12,'0'))::uuid from (values(610,1),(611,4),(612,6),(613,8),(614,10),(615,12),(616,14),(617,15)) x(post_n,cover) where p.id=('00000000-0000-4000-8000-'||lpad(x.post_n::text,12,'0'))::uuid;
with comments(n,post_n,parent_n,who,body,hours) as(values
 (800,611,null,601,'The quiet morning pace is the detail I always forget to protect. 🌤️',-2.6),(801,611,800,600,'Same here — ten minutes on a bench changes the whole day.',-2.4),(802,611,801,601,'And leaving the phone in my bag helps more than expected 😅',-2.2),(803,611,802,600,'A small reset before class is genuinely useful.',-2.0),(804,610,null,601,'Bostock feels better for group work; Perkins is my reset zone.',-2.1),(805,610,null,601,'This is the exact level of detail I wanted before finals week. 📚',-1.8),
 (806,611,null,601,'East Campus mornings have such a different pace.',-7.1),(807,611,806,600,'The shaded benches are an underrated ten-minute break. 🌿',-6.8),(808,611,null,601,'A small walk before class genuinely helps.',-6.3),
 (809,612,null,601,'Choosing before entering is the best lunch advice.',-13.4),(810,612,809,600,'It also keeps the line moving for everyone.',-13.1),(811,612,810,601,'Team “find a seat second, food first” 🙌',-12.8),(812,612,null,601,'Taking lunch outside makes the whole day feel less rushed.',-12.2),
 (813,613,null,601,'The reminder to leave shared spaces as we found them matters.',-19.0),(814,613,813,600,'Absolutely. Quiet paths work because people care for them.',-18.7),(815,613,null,601,'A slow loop is perfect after a long reading block. 🌱',-18.1),
 (816,614,null,601,'A clear meeting point is the real game-day life hack.',-25.8),(817,614,816,600,'Especially when everyone’s phone is low on battery.',-25.4),(818,614,817,601,'Portable charger: promoted to essential status 🔋',-25.1),(819,614,null,601,'The light-layer reminder is so real.',-24.6),
 (820,615,null,601,'Late afternoon texture on the stone is beautiful. 📷',-34.9),(821,615,820,600,'And the softer contrast is much easier to photograph.',-34.5),(822,615,null,601,'Thanks for avoiding a “secret exact time” claim — weather changes everything.',-33.8),
 (823,616,null,601,'The backup-route habit lowers my stress immediately.',-46.7),(824,616,null,601,'Fewer decisions is exactly the goal. 🚌',-45.9),(825,617,null,601,'Books + coffee + a short walk is my ideal reset. ☕',-60.2),(826,617,825,600,'Same — the route matters less than actually taking the break.',-59.8)
) insert into private.forum_comments(id,post_id,parent_comment_id,editorial_identity_id,body,status,created_at,updated_at)
select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(post_n::text,12,'0'))::uuid,case when parent_n is null then null else ('00000000-0000-4000-8000-'||lpad(parent_n::text,12,'0'))::uuid end,('00000000-0000-4000-8000-'||lpad(who::text,12,'0'))::uuid,body,'published',now()+hours*interval '1 hour',now()+hours*interval '1 hour' from comments on conflict(id) do nothing;

do $$ begin if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
 execute $sql$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('forum-images','forum-images',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types$sql$;
 execute 'drop policy if exists rateduke_forum_images_read on storage.objects';execute 'drop policy if exists rateduke_forum_images_insert on storage.objects';execute 'drop policy if exists rateduke_forum_images_delete on storage.objects';
 execute $sql$create policy rateduke_forum_images_read on storage.objects for select to anon,authenticated using(bucket_id='forum-images' and public.can_read_forum_image(name))$sql$;
 execute $sql$create policy rateduke_forum_images_insert on storage.objects for insert to authenticated with check(bucket_id='forum-images' and public.can_write_forum_image(name))$sql$;
 execute $sql$create policy rateduke_forum_images_delete on storage.objects for delete to authenticated using(bucket_id='forum-images' and public.can_write_forum_image(name))$sql$;
end if;end $$;

commit;
