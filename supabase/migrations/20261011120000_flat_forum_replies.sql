begin;

alter table private.forum_comments add column reply_to_comment_id uuid;

with recursive paths as (
 select c.id,c.post_id,c.parent_comment_id original_parent,c.id root_id,0 depth,array[c.id] path
 from private.forum_comments c where c.parent_comment_id is null
 union all
 select child.id,child.post_id,child.parent_comment_id,paths.root_id,paths.depth+1,paths.path||child.id
 from private.forum_comments child join paths on child.parent_comment_id=paths.id
 where not child.id=any(paths.path)
)
update private.forum_comments comment
set parent_comment_id=case when paths.depth=0 then null else paths.root_id end,
    reply_to_comment_id=case when paths.depth=0 then null else paths.original_parent end
from paths where paths.id=comment.id;

alter table private.forum_comments
 add constraint forum_comments_reply_to_fk foreign key(reply_to_comment_id,post_id) references private.forum_comments(id,post_id),
 add constraint forum_comments_reply_shape check((parent_comment_id is null)=(reply_to_comment_id is null));

create index forum_comments_reply_target on private.forum_comments(reply_to_comment_id) where reply_to_comment_id is not null;

create function private.normalize_forum_reply() returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid;target_root uuid;requested_root uuid;
begin
 if new.parent_comment_id is null then new.reply_to_comment_id:=null;return new;end if;
 target_id:=coalesce(new.reply_to_comment_id,new.parent_comment_id);
 select coalesce(c.parent_comment_id,c.id) into target_root from private.forum_comments c where c.id=target_id and c.post_id=new.post_id;
 if target_root is null then raise exception 'Replies must target a comment in this post.';end if;
 select coalesce(c.parent_comment_id,c.id) into requested_root from private.forum_comments c where c.id=new.parent_comment_id and c.post_id=new.post_id;
 if requested_root is distinct from target_root then raise exception 'Replies must stay in the same conversation.';end if;
 new.parent_comment_id:=target_root;new.reply_to_comment_id:=target_id;return new;
end $$;
alter function private.normalize_forum_reply() owner to rateduke_api;
revoke all on function private.normalize_forum_reply() from public,anon,authenticated;
create trigger forum_comments_flat_replies before insert or update of parent_comment_id,reply_to_comment_id,post_id on private.forum_comments for each row execute function private.normalize_forum_reply();

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
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'post_id',r.post_id,'parent_comment_id',r.parent_comment_id,'reply_to_comment_id',r.reply_to_comment_id,'author_name',private.forum_author_name(r.author_user_id,r.editorial_identity_id),'body',case r.status when 'published' then r.body when 'hidden' then 'This comment was hidden by the moderation team.' else 'This comment was deleted by its author.' end,'status',r.status,'created_at',r.created_at,'reply_count',case when p_parent is null then (select count(*) from private.forum_comments c where c.parent_comment_id=r.id) else 0 end,'can_delete',r.author_user_id=private.request_user_id() or private.is_staff(),'replying_to',(select private.forum_author_name(target.author_user_id,target.editorial_identity_id) from private.forum_comments target where target.id=r.reply_to_comment_id)) order by r.rn),'[]'::jsonb),exists(select 1 from ranked where rn>v_offset+v_limit)
 into v_items,v_more from ranked r where r.rn>v_offset and r.rn<=v_offset+v_limit;
 return jsonb_build_object('items',v_items,'page',v_page,'page_size',v_limit,'has_more',coalesce(v_more,false));end $$;

create function public.create_forum_comment(p_post uuid,p_parent uuid,p_reply_to uuid,p_body text) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_user_id();school uuid;root_id uuid;target_root uuid;target_id uuid:=coalesce(p_reply_to,p_parent);body text:=trim(coalesce(p_body,''));rid uuid:=gen_random_uuid();
begin
 if uid is null or not private.is_active_user() then raise exception 'Sign in with an active account to continue.';end if;
 select school_id into school from private.forum_posts where id=p_post and status='published';if school is null then raise exception 'Post not found.';end if;
 if not private.can_contribute(school) then raise exception 'Use a verified email from this school to comment.';end if;
 if length(body) not between 1 and 1500 then raise exception 'Comments must be between 1 and 1,500 characters.';end if;
 if p_parent is null then
  if p_reply_to is not null then raise exception 'A reply needs an original comment.';end if;
 else
  select id into root_id from private.forum_comments where id=p_parent and post_id=p_post and parent_comment_id is null and status='published';
  if root_id is null then raise exception 'Original comment not found.';end if;
  select coalesce(parent_comment_id,id) into target_root from private.forum_comments where id=target_id and post_id=p_post and status='published';
  if target_root is null then raise exception 'Reply target not found.';end if;
  if target_root is distinct from root_id then raise exception 'Replies must stay in the same conversation.';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('rateduke:forum:'||uid::text,0));perform private.consume_limit('forum_comment',30);
 insert into private.forum_comments(post_id,parent_comment_id,reply_to_comment_id,author_user_id,body) values(p_post,p_parent,target_id,uid,body) returning id into rid;
 return rid::text;
end $$;
alter function public.get_forum_comments(uuid,uuid,integer,integer) owner to rateduke_api;
alter function public.create_forum_comment(uuid,uuid,uuid,text) owner to rateduke_api;
revoke all on function public.get_forum_comments(uuid,uuid,integer,integer),public.create_forum_comment(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_forum_comments(uuid,uuid,integer,integer) to anon,authenticated;
grant execute on function public.create_forum_comment(uuid,uuid,uuid,text) to authenticated;

commit;
