import { z } from 'zod';
import { canContribute } from './domain';
import type { Account,Database,ForumCommentNode,ForumPage,ForumPostCard,ForumPostDetail,ForumSort } from './types';

export const forumPostInput=z.object({
  school_id:z.uuid(),title:z.string().trim().min(3).max(160),body:z.string().trim().min(1).max(6000),
  managed_identity_id:z.uuid().optional(),
  images:z.array(z.object({width:z.number().int().min(1).max(12000),height:z.number().int().min(1).max(12000)})).min(1).max(9),
  cover_index:z.number().int().min(0).max(8)
}).refine(value=>value.cover_index<value.images.length,{message:'Choose a cover image from this post.',path:['cover_index']});
export const forumCommentInput=z.object({post_id:z.uuid(),parent_comment_id:z.uuid().nullable().default(null),reply_to_comment_id:z.uuid().nullable().default(null),body:z.string().trim().min(1).max(1500)});

export function forumHotScore(likes:number,comments:number,createdAt:string,now=Date.now()){
  const ageHours=Math.max(0,(now-Date.parse(createdAt))/3_600_000);
  return (1+likes+2*comments)/Math.pow(ageHours+2,1.25);
}
const author=(db:Database,userId:string|null,managedId:string|null)=>managedId?db.managed_identities.find(item=>item.id===managedId)?.name||'Campus contributor':db.accounts.find(item=>item.id===userId)?.nickname||'Campus member';
const imageUrl=(postId:string,image:{id:string;bundled_path:string|null;storage_path:string|null})=>image.bundled_path||`/api/forum/media/${postId}/${image.id}`;
function card(db:Database,viewer:Account|null,post:Database['forum_posts'][number],now=Date.now()):ForumPostCard|null{
  const image=db.forum_post_images.find(item=>item.id===post.cover_image_id&&item.post_id===post.id&&item.status==='ready')||db.forum_post_images.filter(item=>item.post_id===post.id&&item.status==='ready').sort((a,b)=>a.sort_order-b.sort_order)[0];
  if(!image)return null;
  const like_count=db.forum_post_likes.filter(item=>item.post_id===post.id).length;
  const comment_count=db.forum_comments.filter(item=>item.post_id===post.id&&item.status==='published').length;
  return {id:post.id,school_id:post.school_id,title:post.title,cover:{id:image.id,url:imageUrl(post.id,image),width:image.width,height:image.height,sort_order:image.sort_order},author_name:author(db,post.author_user_id,post.managed_identity_id),created_at:post.published_at||post.created_at,like_count,comment_count,liked_by_viewer:!!viewer&&db.forum_post_likes.some(item=>item.post_id===post.id&&item.user_id===viewer.id),hot_score:forumHotScore(like_count,comment_count,post.published_at||post.created_at,now)};
}
export function getForumFeedFromDb(db:Database,viewer:Account|null,schoolId:string,sort:ForumSort,page=1,pageSize=20,now=Date.now()):ForumPage<ForumPostCard>{
  const safePage=Math.max(1,Math.floor(page)||1),safeSize=Math.min(50,Math.max(1,Math.floor(pageSize)||20));
  const rows=db.forum_posts.filter(item=>item.school_id===schoolId&&item.status==='published').map(item=>card(db,viewer,item,now)).filter((item):item is ForumPostCard=>!!item).sort((a,b)=>sort==='latest'?b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id):b.hot_score-a.hot_score||b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  const start=(safePage-1)*safeSize;return {items:rows.slice(start,start+safeSize),page:safePage,page_size:safeSize,has_more:rows.length>start+safeSize};
}
export function getForumPostFromDb(db:Database,viewer:Account|null,id:string):ForumPostDetail|null{
  const post=db.forum_posts.find(item=>item.id===id);const staff=!!viewer&&!viewer.suspended&&viewer.role!=='user';
  if(!post||(!staff&&post.status!=='published')||post.status==='draft'||post.status==='deleted')return null;
  const base=card(db,viewer,post);if(!base)return null;
  return {...base,body:post.body,images:db.forum_post_images.filter(item=>item.post_id===id&&item.status==='ready').sort((a,b)=>a.sort_order-b.sort_order).map(item=>({id:item.id,url:imageUrl(id,item),width:item.width,height:item.height,sort_order:item.sort_order})),status:post.status==='hidden'?'hidden':'published',can_interact:post.status==='published'&&canContribute(db,viewer,post.school_id),can_delete:!!viewer&&(post.author_user_id===viewer.id||staff)};
}
export function getForumCommentsFromDb(db:Database,viewer:Account|null,postId:string,parentId:string|null,page=1,pageSize=parentId?10:20):ForumPage<ForumCommentNode>{
  const post=db.forum_posts.find(item=>item.id===postId);if(!post||post.status==='draft'||post.status==='deleted')return {items:[],page:1,page_size:pageSize,has_more:false};
  const safePage=Math.max(1,Math.floor(page)||1),safeSize=Math.min(50,Math.max(1,Math.floor(pageSize)||20));const staff=!!viewer&&!viewer.suspended&&viewer.role!=='user';
  const rows=db.forum_comments.filter(item=>item.post_id===postId&&item.parent_comment_id===parentId).sort((a,b)=>parentId?a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id):b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  const start=(safePage-1)*safeSize;const items=rows.slice(start,start+safeSize).map(item=>{
    const replyTargetId=item.reply_to_comment_id||item.parent_comment_id;
    const replyTarget=replyTargetId?db.forum_comments.find(comment=>comment.id===replyTargetId):null;
    return {id:item.id,post_id:item.post_id,parent_comment_id:item.parent_comment_id,reply_to_comment_id:item.reply_to_comment_id||null,author_name:author(db,item.author_user_id,item.managed_identity_id),body:item.status==='published'?item.body:item.status==='hidden'?'This comment was hidden by the moderation team.':'This comment was deleted by its author.',status:item.status,created_at:item.created_at,like_count:db.forum_comment_likes.filter(like=>like.comment_id===item.id).length,liked_by_viewer:db.forum_comment_likes.some(like=>like.comment_id===item.id&&like.user_id===viewer?.id),reply_count:parentId?0:db.forum_comments.filter(comment=>comment.parent_comment_id===item.id).length,can_delete:!!viewer&&(item.author_user_id===viewer.id||staff),replying_to:replyTarget?author(db,replyTarget.author_user_id,replyTarget.managed_identity_id):null};
  });
  return {items,page:safePage,page_size:safeSize,has_more:rows.length>start+safeSize};
}
