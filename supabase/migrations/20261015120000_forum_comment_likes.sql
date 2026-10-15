begin;
create table private.forum_comment_likes(
 comment_id uuid not null references private.forum_comments(id) on delete cascade,
 user_id uuid not null references private.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(comment_id,user_id)
);
alter table private.forum_comment_likes enable row level security;
create policy comment_likes_read on private.forum_comment_likes for select using(
 exists(select 1 from private.forum_comments c join private.forum_posts p on p.id=c.post_id where c.id=comment_id and (p.status='published' or private.is_staff()))
);
create policy comment_likes_insert on private.forum_comment_likes for insert with check(
 user_id=private.request_user_id() and private.is_active_user() and exists(
 select 1 from private.forum_comments c join private.forum_posts p on p.id=c.post_id
 where c.id=comment_id and c.status='published' and p.status='published' and private.can_contribute(p.school_id))
);
create policy comment_likes_delete on private.forum_comment_likes for delete using(user_id=private.request_user_id() and private.is_active_user());
grant select,insert,delete on private.forum_comment_likes to rateduke_api;
revoke all on private.forum_comment_likes from public,anon,authenticated;
create function public.toggle_forum_comment_like(p_comment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id(); school uuid; liked boolean;
begin
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
 select p.school_id into school from private.forum_comments c join private.forum_posts p on p.id=c.post_id
 where c.id=p_comment and c.status='published' and p.status='published';
 if school is null then raise exception 'Comment not found.';end if;
 if not private.can_contribute(school) then raise exception 'Use a verified email from this school to like comments.';end if;
 perform pg_advisory_xact_lock(hashtextextended('rateduke:comment-like:'||uid::text,0));
 perform private.consume_limit('forum_comment_like',120);
 delete from private.forum_comment_likes where comment_id=p_comment and user_id=uid;
 liked:=not found;
 if liked then insert into private.forum_comment_likes(comment_id,user_id) values(p_comment,uid);end if;
 return jsonb_build_object('liked',liked,'count',(select count(*) from private.forum_comment_likes where comment_id=p_comment));
end $$;
alter function public.toggle_forum_comment_like(uuid) owner to rateduke_api;
revoke all on function public.toggle_forum_comment_like(uuid) from public,anon,authenticated;
grant execute on function public.toggle_forum_comment_like(uuid) to authenticated;
create or replace function public.get_forum_comments(p_post uuid,p_parent uuid default null,p_page integer default 1,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_page integer:=greatest(1,coalesce(p_page,1));v_limit integer:=least(50,greatest(1,coalesce(p_limit,20)));v_offset integer;v_items jsonb;v_more boolean;
begin v_offset:=(v_page-1)*v_limit;
 with ranked as(
  select c.*,row_number() over(order by case when p_parent is null then c.created_at end desc,case when p_parent is not null then c.created_at end asc,c.id) rn
  from private.forum_comments c
  where c.post_id=p_post and c.parent_comment_id is not distinct from p_parent
    and exists(select 1 from private.forum_posts p where p.id=c.post_id and (p.status='published' or private.is_staff()))
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'post_id',r.post_id,'parent_comment_id',r.parent_comment_id,'reply_to_comment_id',r.reply_to_comment_id,'author_name',private.forum_author_name(r.author_user_id,r.editorial_identity_id),'body',case r.status when 'published' then r.body when 'hidden' then 'This comment was hidden by the moderation team.' else 'This comment was deleted by its author.' end,'status',r.status,'created_at',r.created_at,'like_count',(select count(*) from private.forum_comment_likes l where l.comment_id=r.id),'liked_by_viewer',exists(select 1 from private.forum_comment_likes l where l.comment_id=r.id and l.user_id=private.request_user_id()),'reply_count',case when p_parent is null then (select count(*) from private.forum_comments c where c.parent_comment_id=r.id) else 0 end,'can_delete',r.author_user_id=private.request_user_id() or private.is_staff(),'replying_to',(select private.forum_author_name(target.author_user_id,target.editorial_identity_id) from private.forum_comments target where target.id=r.reply_to_comment_id)) order by r.rn),'[]'::jsonb),exists(select 1 from ranked where rn>v_offset+v_limit)
 into v_items,v_more from ranked r where r.rn>v_offset and r.rn<=v_offset+v_limit;
 return jsonb_build_object('items',v_items,'page',v_page,'page_size',v_limit,'has_more',coalesce(v_more,false));end $$;


commit;
