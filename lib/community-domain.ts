import type { CommunityConversationItem,CommunityEntityCard,Entity,Snapshot,Tag } from './types';

export type CommunitySort='hot'|'latest';
export function communitySort(value?:string):CommunitySort{return value==='latest'?'latest':'hot';}
export function normalizeCustomTag(value:string){return value.trim().replace(/^#+/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);}
export function isCommunityEntity(snapshot:Pick<Snapshot,'categories'>,entity:Entity){return !!snapshot.categories.find(category=>category.id===entity.category_id&&category.accepts_submissions);}
export function tagsForEntity(snapshot:Pick<Snapshot,'tags'|'entity_tags'>,entityId:string){
 const links=snapshot.entity_tags.filter(item=>item.entity_id===entityId);const find=(role:'primary'|'custom')=>links.filter(item=>item.role===role).map(item=>snapshot.tags.find(tag=>tag.id===item.tag_id)).filter((tag):tag is Tag=>!!tag&&tag.status==='active');
 return {official:find('primary')[0]||null,custom:find('custom')};
}
export function communityCards(snapshot:Snapshot,entities:Entity[],sortValue?:string,now=Date.now()):CommunityEntityCard[]{
 const cards=entities.filter(entity=>isCommunityEntity(snapshot,entity)).map(entity=>{
  const reviews=snapshot.reviews.filter(review=>review.entity_id===entity.id&&review.status==='published');const comments=snapshot.community_comments.filter(comment=>comment.entity_id===entity.id&&comment.status==='published');const topLevel=comments.filter(comment=>!comment.parent_comment_id&&!comment.review_id).length;const replies=comments.length-topLevel;const likeCount=reviews.reduce((sum,review)=>sum+(review.like_count||0),0)+comments.reduce((sum,comment)=>sum+comment.like_count,0);const interaction=2*reviews.length+2*topLevel+replies+likeCount;const ageHours=Math.max(0,(now-Date.parse(entity.created_at))/3_600_000);const tags=tagsForEntity(snapshot,entity.id);
  return {entity,author_name:snapshot.community_authors.find(author=>author.entity_id===entity.id)?.public_identity||'Student',official_tag:tags.official,custom_tags:tags.custom,average_rating:reviews.length?reviews.reduce((sum,review)=>sum+(review.overall_rating||0),0)/reviews.length:null,rating_count:reviews.length,comment_count:comments.length,like_count:likeCount,hot_score:interaction/Math.pow(ageHours+2,1.25)};
 });
 return cards.sort((left,right)=>communitySort(sortValue)==='latest'?right.entity.created_at.localeCompare(left.entity.created_at)||right.entity.id.localeCompare(left.entity.id):right.hot_score-left.hot_score||right.entity.created_at.localeCompare(left.entity.created_at)||right.entity.id.localeCompare(left.entity.id));
}
export function communityConversation(snapshot:Snapshot,entityId:string):CommunityConversationItem[]{
 const comments=snapshot.community_comments.filter(comment=>comment.entity_id===entityId&&comment.status!=='deleted');const reviews=snapshot.reviews.filter(review=>review.entity_id===entityId&&review.status==='published').map(review=>({type:'review' as const,review,like_count:review.like_count||0,liked_by_viewer:!!review.liked_by_viewer,replies:comments.filter(comment=>comment.review_id===review.id).sort((a,b)=>a.created_at.localeCompare(b.created_at))}));
 const roots=comments.filter(comment=>!comment.review_id&&!comment.parent_comment_id).map(comment=>({type:'comment' as const,comment:{...comment,replies:comments.filter(reply=>reply.parent_comment_id===comment.id).sort((a,b)=>a.created_at.localeCompare(b.created_at))}}));
 return [...reviews,...roots].sort((left,right)=>{const a=left.type==='review'?left.review.created_at:left.comment.created_at;const b=right.type==='review'?right.review.created_at:right.comment.created_at;return b.localeCompare(a);});
}
