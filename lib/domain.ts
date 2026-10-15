import { z } from 'zod';
import type { Account, Aggregate, Command, CommunityCommentNode, Database, Entity, PublicReview, QuestionView, Snapshot } from './types';
const uuid = z.uuid();
const text = (max=200) => z.string().trim().max(max);
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.').max(100);
const status = z.enum(['active','archived']);
const url = z.union([z.literal(''),z.url().refine(v=>/^https?:\/\//.test(v),'Use an http or https URL.')]);
const optionalId = z.union([uuid,z.null()]);
const base = { id: uuid.optional() };
export const schemas = {
  school: z.object({...base,name:text().min(1),slug,email_domain:z.string().trim().toLowerCase().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),city:text(),state:text(),country:text(),status}),
  category: z.object({...base,school_id:optionalId,name:text().min(1),slug,description:text(1000),icon:text(40),status,sort_order:z.number().int().min(0),is_discover_default:z.boolean().default(false),accepts_submissions:z.boolean().default(false)}),
  dimension: z.object({...base,category_id:uuid,key:slug,label:text().min(1),description:text(1000),min_value:z.literal(1),max_value:z.literal(10),sort_order:z.number().int().min(0),is_required:z.boolean(),is_active:z.boolean()}),
  entity: z.object({...base,school_id:uuid,category_id:uuid,parent_entity_id:optionalId,name:text().min(1),slug,short_description:text(250),description:text(6000),location_name:text(),address:text(500),latitude:z.number().min(-90).max(90).nullable(),longitude:z.number().min(-180).max(180).nullable(),official_url:url,source_name:text(),source_url:url,last_verified_at:z.iso.datetime().nullable(),metadata:z.record(z.string(),z.unknown()).refine(v=>JSON.stringify(v).length<=12000,'Metadata must be under 12,000 characters.'),status,is_featured:z.boolean()}),
  review: z.object({entity_id:uuid,overall_rating:z.number().min(1).max(10).multipleOf(0.5).nullable(),body:text(3000),is_anonymous:z.boolean(),values:z.array(z.object({rating_dimension_id:uuid,score:z.number().min(1).max(10).multipleOf(0.5)})).max(50)}),
  report: z.object({target_type:z.enum(['review','entity','user','forum_post','forum_comment','community_comment']),target_id:uuid,reason:z.enum(['Harassment','Privacy violation','Hate or threats','Spam','Inaccurate information','Other']),details:text(2000)}),
  question: z.object({...base,school_id:uuid,type:z.enum(['prediction','poll']),title:text(300).min(1),category:text(80).min(1),status:z.enum(['draft','open','closed','resolved','archived']),closes_at:z.iso.datetime().nullable(),event_at:z.iso.datetime().nullable(),resolved_option_id:optionalId,show_in_popup:z.boolean(),is_featured:z.boolean(),sort_order:z.number().int().min(0),options:z.array(z.object({id:uuid.optional(),label:text(80).min(1),sort_order:z.number().int().min(0)})).min(2).max(4)}),
  answer: z.object({question_id:uuid,option_id:uuid}),
};
export function validateCommand(command:Command):Command {
  const schema=({save_school:schemas.school,save_category:schemas.category,save_dimension:schemas.dimension,save_entity:schemas.entity,save_review:schemas.review,report:schemas.report,save_question:schemas.question,answer_question:schemas.answer} as Record<string,z.ZodType<Record<string,unknown>>>)[command.action];
  if(schema)return {action:command.action,data:schema.parse(command.data)};
  return command;
}
export function canContribute(db: Pick<Database,'schools'>, user: Account | null, schoolId: string) {
  const school=db.schools.find(s=>s.id===schoolId && s.status==='active');
  return !!school && !!user && user.verified && !user.suspended && user.email.split('@')[1]?.toLowerCase()===school.email_domain.toLowerCase();
}
export function publicSnapshot(db: Database, viewer: Account | null): Snapshot {
  const staff=!!viewer && !viewer.suspended && viewer.role!=='user';
  const schools=staff?db.schools:db.schools.filter(s=>s.status==='active');
  const categories=staff?db.categories:db.categories.filter(c=>c.status==='active' && (!c.school_id || schools.some(s=>s.id===c.school_id)));
  const visibleEntities=staff?db.entities:db.entities.filter(e=>e.status==='active' && schools.some(s=>s.id===e.school_id) && categories.some(c=>c.id===e.category_id));
  const entities=visibleEntities.map(entity=>{const gallery=db.entity_gallery_images.filter(image=>image.entity_id===entity.id&&image.status==='ready').sort((a,b)=>a.sort_order-b.sort_order).flatMap(image=>{const src=image.source_url||(image.storage_path?`/api/community/media/${image.storage_path}`:null);return src?[{src,alt:image.alt_text,kind:image.kind,...(image.width&&image.height?{width:image.width,height:image.height}:{})}]:[]});return gallery.length?{...entity,image_url:gallery[0].src,metadata:{...entity.metadata,gallery}}:entity;});
  const project=(r:Database['reviews'][number], internal=false): PublicReview=>{
    const {user_id,managed_identity_id,...rest}=r; const author=db.accounts.find(a=>a.id===user_id);const managed=db.managed_identities.find(a=>a.id===managed_identity_id);
    const likes=db.community_likes.filter(item=>item.target_type==='review'&&item.target_id===r.id);
    return {...rest,public_identity:managed?.name||(r.is_anonymous?'Anonymous Student':author?.nickname || 'Student'),verified:managed?false:author?.verified || false,values:db.values.filter(v=>v.review_id===r.id),like_count:likes.length,liked_by_viewer:likes.some(item=>item.user_id===viewer?.id),...(internal&&user_id?{account_id:user_id}:{}),...(internal&&managed_identity_id?{managed_identity_id}:{})};
  };
  const now=Date.now();
  const questions=(db.questions||[]).filter(q=>staff || !['draft','archived'].includes(q.status)).filter(q=>schools.some(s=>s.id===q.school_id)).map(q=>questionView(db,viewer,q.id,now,staff)).filter((q):q is QuestionView=>!!q);
  const admin=viewer?.role==='admin'&&!viewer.suspended;const managed=admin?db.managed_identities.map(identity=>({...identity,review_count:db.reviews.filter(r=>r.managed_identity_id===identity.id&&!r.deleted_at).length,post_count:db.forum_posts.filter(p=>p.managed_identity_id===identity.id&&p.status!=='deleted').length,community_entity_count:db.community_authors.filter(author=>author.managed_identity_id===identity.id).length,community_comment_count:db.community_comments.filter(comment=>comment.managed_identity_id===identity.id&&comment.status!=='deleted').length})):[];
  const communityCategoryIds=new Set(categories.filter(category=>category.accepts_submissions).map(category=>category.id));
  const summary=admin?{active_users:db.accounts.filter(a=>a.verified&&!a.suspended&&!a.is_demo_fixture).length,managed_profiles:db.managed_identities.filter(identity=>identity.status==='active').length,managed_reviews:db.reviews.filter(r=>!!r.managed_identity_id&&!r.deleted_at&&['published','hidden'].includes(r.status)).length,managed_forum_posts:db.forum_posts.filter(p=>!!p.managed_identity_id&&!p.deleted_at&&['published','hidden'].includes(p.status)).length,total_reviews:db.reviews.filter(r=>!r.deleted_at&&['published','hidden'].includes(r.status)).length,review_drafts:db.reviews.filter(r=>!r.deleted_at&&r.status==='draft').length,total_forum_posts:db.forum_posts.filter(p=>!p.deleted_at&&['published','hidden'].includes(p.status)).length,forum_drafts:db.forum_posts.filter(p=>!p.deleted_at&&p.status==='draft').length,campus_entities:db.entities.filter(e=>e.status==='active').length,open_reports:db.reports.filter(r=>r.status==='pending').length,pending_submissions:db.submissions.filter(s=>s.status==='pending').length,community_entities:db.entities.filter(e=>communityCategoryIds.has(e.category_id)&&e.status==='active').length,community_comments:db.community_comments.filter(c=>c.status!=='deleted').length,community_likes:db.community_likes.length,custom_tags:db.tags.filter(tag=>tag.kind==='custom'&&tag.status==='active').length}:null;
  const commentNode=(comment:Database['community_comments'][number]):CommunityCommentNode=>{const author=db.accounts.find(a=>a.id===comment.author_user_id);const identity=db.managed_identities.find(a=>a.id===comment.managed_identity_id);const replyTo=db.community_comments.find(item=>item.id===comment.reply_to_comment_id);const replyName=replyTo?(db.managed_identities.find(a=>a.id===replyTo.managed_identity_id)?.name||db.accounts.find(a=>a.id===replyTo.author_user_id)?.nickname||null):null;const likes=db.community_likes.filter(item=>item.target_type==='comment'&&item.target_id===comment.id);return {id:comment.id,entity_id:comment.entity_id,parent_comment_id:comment.parent_comment_id,reply_to_comment_id:comment.reply_to_comment_id,review_id:comment.review_id,author_name:identity?.name||author?.nickname||'Student',body:comment.status==='published'?comment.body:comment.status==='hidden'?'This comment was hidden by the moderation team.':'This comment was deleted by its author.',status:comment.status,created_at:comment.created_at,like_count:likes.length,liked_by_viewer:likes.some(item=>item.user_id===viewer?.id),can_delete:!!viewer&&(comment.author_user_id===viewer.id||viewer.role!=='user'),replying_to:replyName,replies:[]};};
  const publicComments=db.community_comments.filter(comment=>entities.some(entity=>entity.id===comment.entity_id)&&comment.status!=='deleted'&&(staff||comment.status==='published')).map(commentNode);
  for(const child of publicComments.filter(comment=>comment.parent_comment_id||comment.review_id)){if(commentParent(child))continue;}
  function commentParent(child:(typeof publicComments)[number]){if(child.review_id)return true;const parent=publicComments.find(item=>item.id===child.parent_comment_id);if(parent){parent.replies.push(child);return true;}return false;}
  const accounts=staff?db.accounts.map(account=>({...account,community_comment_count:db.community_comments.filter(comment=>comment.author_user_id===account.id&&comment.status!=='deleted').length,community_like_count:db.community_likes.filter(like=>like.user_id===account.id).length})):[];
  const adminEntityImages=admin?db.entity_gallery_images.filter(image=>image.status==='ready').sort((a,b)=>a.sort_order-b.sort_order).flatMap(image=>{const url=image.source_url||(image.storage_path?`/api/community/media/${image.storage_path}`:null);return url?[{id:image.id,entity_id:image.entity_id,url,sort_order:image.sort_order,alt_text:image.alt_text,kind:image.kind,width:image.width,height:image.height,uploaded:!!image.storage_path}]:[]}):[];
  return {schools,categories,entities,admin_entity_images:adminEntityImages,dimensions:db.dimensions.filter(d=>categories.some(c=>c.id===d.category_id)),reviews:db.reviews.filter(r=>!r.deleted_at && (staff || r.status==='published') && entities.some(e=>e.id===r.entity_id)).map(r=>project(r,staff)),own_reviews:db.reviews.filter(r=>!r.deleted_at && r.user_id===viewer?.id).map(r=>project(r)),own_submissions:(db.submissions||[]).filter(s=>s.account_id===viewer?.id),admin_submissions:admin?(db.submissions||[]):[],accounts,reports:staff?db.reports:[],audit:staff?db.audit:[],questions,managed_identities:managed,managed_review_drafts:admin?db.reviews.filter(r=>r.status==='draft'&&!r.deleted_at&&!!r.managed_identity_id).map(r=>project(r,true)):[],managed_forum_drafts:admin?db.forum_posts.filter(p=>p.status==='draft'&&!!p.managed_identity_id).map(p=>({...p,managed_identity_id:p.managed_identity_id!,image_count:db.forum_post_images.filter(i=>i.post_id===p.id).length})):[],admin_summary:summary,viewer,tags:db.tags.filter(tag=>staff||tag.status==='active').map(tag=>({...tag,usage_count:db.entity_tags.filter(item=>item.tag_id===tag.id).length})),entity_tags:db.entity_tags.filter(item=>entities.some(entity=>entity.id===item.entity_id)),community_authors:db.community_authors.filter(item=>entities.some(entity=>entity.id===item.entity_id)).map(item=>({entity_id:item.entity_id,public_identity:db.managed_identities.find(identity=>identity.id===item.managed_identity_id)?.name||db.accounts.find(account=>account.id===item.user_id)?.nickname||'Student',managed:!!item.managed_identity_id})),community_comments:publicComments};
}
export function questionView(db:Database,viewer:Account|null,questionId:string,now=Date.now(),staff=!!viewer&&viewer.role!=='user'&&!viewer.suspended):QuestionView|null {
  const q=(db.questions||[]).find(item=>item.id===questionId);if(!q)return null;
  const responses=(db.question_responses||[]).filter(r=>r.question_id===q.id);const own=responses.find(r=>r.user_id===viewer?.id);
  let effective:QuestionView['effective_status']=q.status;
  if(q.status==='open'&&q.closes_at&&Date.parse(q.closes_at)<=now)effective=q.type==='prediction'&&q.event_at&&Date.parse(q.event_at)<=now?'awaiting_result':'closed';
  if(q.type==='prediction'&&effective==='closed'&&q.event_at&&Date.parse(q.event_at)<=now)effective='awaiting_result';
  const resultsVisible=staff||!!own||['closed','resolved','awaiting_result'].includes(effective);
  const total=responses.length;
  return {...q,effective_status:effective,response_count:total,current_user_option_id:own?.option_id||null,results_visible:resultsVisible,can_answer:effective==='open'&&canContribute(db,viewer,q.school_id),options:(db.question_options||[]).filter(o=>o.question_id===q.id).sort((a,b)=>a.sort_order-b.sort_order).map(o=>{const count=responses.filter(r=>r.option_id===o.id).length;return {...o,response_count:resultsVisible?count:null,percentage:resultsVisible?(total?Math.round(count/total*100):0):null};})};
}
export function aggregate(snapshot: Pick<Snapshot,'reviews'|'dimensions'>, entity: Entity): Aggregate {
  const reviews=snapshot.reviews.filter(r=>r.entity_id===entity.id && r.status==='published');
  const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  const overall=reviews.flatMap(r=>r.overall_rating===null?[]:[r.overall_rating]);
  return {average:mean(overall),count:overall.length,reviewCount:reviews.length,dimensions:snapshot.dimensions.filter(d=>d.category_id===entity.category_id && d.is_active).sort((a,b)=>a.sort_order-b.sort_order).map(d=>{const values=reviews.flatMap(r=>r.values.filter(v=>v.rating_dimension_id===d.id).map(v=>v.score));return {dimension:d,average:mean(values),count:values.length};})};
}
export type DiscoverySort = 'recommended' | 'highest-rated' | 'most-rated' | 'recently-reviewed';
export function discoverySort(value?: string): DiscoverySort {
  if(value==='rating')return 'highest-rated';
  return ['recommended','highest-rated','most-rated','recently-reviewed'].includes(value||'')?value as DiscoverySort:'recommended';
}
export function sortEntitiesForDiscovery(snapshot: Pick<Snapshot,'reviews'|'dimensions'>, entities: Entity[], value?: string) {
  const sort=discoverySort(value);
  const facts=new Map(entities.map(entity=>{
    const ratings=aggregate(snapshot,entity);
    const latestReview=snapshot.reviews.filter(review=>review.entity_id===entity.id&&review.status==='published').reduce((latest,review)=>Math.max(latest,Date.parse(review.updated_at||review.created_at)),0);
    return [entity.id,{ratings,latestReview}];
  }));
  const compareName=(a:Entity,b:Entity)=>a.name.localeCompare(b.name);
  return [...entities].sort((a,b)=>{
    const left=facts.get(a.id)!;const right=facts.get(b.id)!;
    if(sort==='highest-rated')return (right.ratings.average??-1)-(left.ratings.average??-1)||right.ratings.reviewCount-left.ratings.reviewCount||compareName(a,b);
    if(sort==='most-rated')return right.ratings.reviewCount-left.ratings.reviewCount||(right.ratings.average??-1)-(left.ratings.average??-1)||compareName(a,b);
    if(sort==='recently-reviewed')return right.latestReview-left.latestReview||b.created_at.localeCompare(a.created_at)||compareName(a,b);
    return Number(b.is_featured)-Number(a.is_featured)||right.ratings.reviewCount-left.ratings.reviewCount||(right.ratings.average??-1)-(left.ratings.average??-1)||compareName(a,b);
  });
}
export function applyCommand(db:Database, user:Account|null, command:Command, now=Date.now()): string {
  if(!user || user.suspended) throw new Error('Sign in with an active account to continue.');
  const {action,data}=command; const timestamp=new Date(now).toISOString(); const newId=()=>crypto.randomUUID();
  const requireAdmin=()=>{if(user.role!=='admin')throw new Error('Administrator access required.');};
  const requireStaff=()=>{if(user.role==='user')throw new Error('Moderator access required.');};
  const contribute=(entityId:string)=>{const entity=db.entities.find(e=>e.id===entityId && e.status==='active');if(!entity || !db.categories.some(c=>c.id===entity.category_id && c.status==='active') || !canContribute(db,user,entity.school_id))throw new Error('Use a verified email from this school to contribute.');return entity;};
  const audit=(target:string)=>db.audit.push({id:newId(),actor_id:user.id,action,target_id:target,created_at:timestamp});
  const limit=(key:string,max:number)=>{db.limits=db.limits.filter(l=>l.at>now-3600000);if(db.limits.filter(l=>l.user_id===user.id && l.action===key).length>=max)throw new Error('Too many requests. Please try again in an hour.');db.limits.push({user_id:user.id,action:key,at:now});};
  if(action==='save_review'){
    const d=schemas.review.parse(data); const entity=contribute(d.entity_id); const dimensions=db.dimensions.filter(x=>x.category_id===entity.category_id && x.is_active);
    if(new Set(d.values.map(v=>v.rating_dimension_id)).size!==d.values.length)throw new Error('Each dimension may be rated only once.');
    if(d.overall_rating===null && !d.values.length)throw new Error('Add at least one rating.');
    for(const dim of dimensions)if(dim.is_required && !d.values.some(v=>v.rating_dimension_id===dim.id))throw new Error(`Please rate ${dim.label}.`);
    for(const value of d.values){const dim=dimensions.find(x=>x.id===value.rating_dimension_id);if(!dim || value.score<dim.min_value || value.score>dim.max_value)throw new Error('A rating is outside its configured range. Refresh the form and try again.');}
    limit('review',20); let review=db.reviews.find(r=>r.user_id===user.id && r.entity_id===d.entity_id);
    const anonymous=db.categories.find(category=>category.id===entity.category_id)?.accepts_submissions?false:d.is_anonymous;
    if(review)Object.assign(review,{overall_rating:d.overall_rating,body:d.body,is_anonymous:anonymous,updated_at:timestamp,deleted_at:null});
    else {review={id:newId(),entity_id:d.entity_id,user_id:user.id,overall_rating:d.overall_rating,body:d.body,is_anonymous:anonymous,status:'published',created_at:timestamp,updated_at:timestamp};db.reviews.push(review);}
    const inactive=db.values.filter(v=>v.review_id===review.id && !dimensions.some(dim=>dim.id===v.rating_dimension_id));
    db.values=db.values.filter(v=>v.review_id!==review.id).concat(inactive,d.values.map(v=>({...v,review_id:review.id})));
    return review.status==='hidden'?'Review saved. It remains hidden pending moderation.':'Your review has been saved.';
  }
  if(action==='answer_question'){
    const d=schemas.answer.parse(data);const question=db.questions.find(q=>q.id===d.question_id);if(!question)throw new Error('Question not found.');
    const view=questionView(db,user,question.id,now);if(!view?.can_answer)throw new Error(view?.effective_status==='open'?'Use a verified email from this school to answer.':'This question is closed.');
    if(!db.question_options.some(o=>o.id===d.option_id&&o.question_id===question.id))throw new Error('Choose an option from this question.');
    limit('question_response',60);let response=db.question_responses.find(r=>r.question_id===question.id&&r.user_id===user.id);
    if(response){response.option_id=d.option_id;response.updated_at=timestamp;}else db.question_responses.push({question_id:question.id,option_id:d.option_id,user_id:user.id,created_at:timestamp,updated_at:timestamp});
    return 'Response saved.';
  }
  if(action==='delete_review'){
    const id=uuid.parse(data.id); const review=db.reviews.find(r=>r.id===id && r.user_id===user.id && !r.deleted_at);if(!review)throw new Error('Review not found.');
    Object.assign(review,{deleted_at:timestamp,body:'',overall_rating:null});db.values=db.values.filter(v=>v.review_id!==id);return 'Review deleted.';
  }
  if(action==='forum_toggle_comment_like'){
    const comment=db.forum_comments.find(c=>c.id===uuid.parse(data.id)&&c.status==='published');
    const post=comment&&db.forum_posts.find(p=>p.id===comment.post_id&&p.status==='published');
    if(!comment||!post)throw new Error('Comment not found.');
    if(!canContribute(db,user,post.school_id))throw new Error('Use a verified email from this school to like comments.');
    limit('forum_comment_like',120);
    const index=db.forum_comment_likes.findIndex(like=>like.comment_id===comment.id&&like.user_id===user.id);
    if(index>=0)db.forum_comment_likes.splice(index,1);
    else db.forum_comment_likes.push({comment_id:comment.id,user_id:user.id,created_at:timestamp});
    return JSON.stringify({liked:index<0,count:db.forum_comment_likes.filter(like=>like.comment_id===comment.id).length});
  }
  if(action==='forum_toggle_like'){
    const post=db.forum_posts.find(p=>p.id===uuid.parse(data.id)&&p.status==='published');if(!post)throw new Error('Post not found.');
    if(!canContribute(db,user,post.school_id))throw new Error('Use a verified email from this school to like posts.');limit('forum_like',120);
    const index=db.forum_post_likes.findIndex(item=>item.post_id===post.id&&item.user_id===user.id);
    if(index>=0){db.forum_post_likes.splice(index,1);return 'Like removed.';}db.forum_post_likes.push({post_id:post.id,user_id:user.id,created_at:timestamp});return 'Post liked.';
  }
  if(action==='forum_comment'){
    const post=db.forum_posts.find(p=>p.id===uuid.parse(data.post_id)&&p.status==='published');if(!post)throw new Error('Post not found.');
    if(!canContribute(db,user,post.school_id))throw new Error('Use a verified email from this school to comment.');limit('forum_comment',30);
    const parentId=data.parent_comment_id?uuid.parse(data.parent_comment_id):null;const requestedTargetId=data.reply_to_comment_id?uuid.parse(data.reply_to_comment_id):parentId;
    const target=requestedTargetId?db.forum_comments.find(c=>c.id===requestedTargetId&&c.post_id===post.id&&c.status==='published'):null;
    if(requestedTargetId&&!target)throw new Error('Replies must target a published comment in the same post.');
    const rootId=target?(target.parent_comment_id||target.id):null;
    if(parentId&&rootId!==parentId&&requestedTargetId!==parentId)throw new Error('Replies must stay in the same conversation.');
    if(!parentId&&requestedTargetId)throw new Error('A reply needs an original comment.');
    const body=text(1500).min(1).parse(data.body);const id=newId();db.forum_comments.push({id,post_id:post.id,parent_comment_id:rootId,reply_to_comment_id:target?.id||null,author_user_id:user.id,managed_identity_id:null,body,status:'published',created_at:timestamp,updated_at:timestamp,deleted_at:null});return id;
  }
  if(action==='forum_delete_comment'){
    const comment=db.forum_comments.find(c=>c.id===uuid.parse(data.id));if(!comment)throw new Error('Comment not found.');if(comment.author_user_id!==user.id&&user.role==='user')throw new Error('You can delete only your own comments.');
    comment.status='deleted';comment.body='';comment.deleted_at=timestamp;comment.updated_at=timestamp;return 'Comment deleted.';
  }
  if(action==='forum_delete_post'){
    const post=db.forum_posts.find(p=>p.id===uuid.parse(data.id));if(!post)throw new Error('Post not found.');if(post.author_user_id!==user.id&&user.role==='user')throw new Error('You can delete only your own posts.');
    post.status='deleted';post.deleted_at=timestamp;post.updated_at=timestamp;return 'Post deleted.';
  }
  if(action==='community_comment'){
    const entity=contribute(uuid.parse(data.entity_id));const category=db.categories.find(item=>item.id===entity.category_id);if(!category?.accepts_submissions)throw new Error('Community conversations are available only on community listings.');
    const body=text(1500).min(1).parse(data.body);const targetReview=data.review_id?db.reviews.find(item=>item.id===uuid.parse(data.review_id)&&item.entity_id===entity.id&&item.status==='published'&&!item.deleted_at):null;let parentId:string|null=null,replyToId:string|null=null;
    if(data.review_id&&!targetReview)throw new Error('Rating not found.');
    if(data.parent_comment_id){const target=db.community_comments.find(item=>item.id===uuid.parse(data.parent_comment_id)&&item.entity_id===entity.id&&item.status!=='deleted');if(!target)throw new Error('Comment not found.');parentId=target.parent_comment_id||target.id;replyToId=target.id;}
    const managedId=data.managed_identity_id?uuid.parse(data.managed_identity_id):null;if(managedId){requireAdmin();if(!db.managed_identities.some(item=>item.id===managedId&&item.school_id===entity.school_id&&item.status==='active'))throw new Error('Choose an active contributor profile from the same school.');}
    limit('community_comment',60);const id=newId();db.community_comments.push({id,entity_id:entity.id,parent_comment_id:parentId,reply_to_comment_id:replyToId,review_id:targetReview?.id||null,author_user_id:managedId?null:user.id,managed_identity_id:managedId,body,status:'published',created_at:timestamp,updated_at:timestamp,deleted_at:null});if(managedId)audit(id);return id;
  }
  if(action==='community_toggle_like'){
    const targetType=z.enum(['review','comment']).parse(data.target_type);const targetId=uuid.parse(data.target_id);let entityId:string|null=null;
    if(targetType==='review'){const review=db.reviews.find(item=>item.id===targetId&&item.status==='published'&&!item.deleted_at);entityId=review?.entity_id||null;}else entityId=db.community_comments.find(item=>item.id===targetId&&item.status==='published')?.entity_id||null;
    if(!entityId)throw new Error('Content not found.');const entity=contribute(entityId);if(!db.categories.some(item=>item.id===entity.category_id&&item.accepts_submissions))throw new Error('Likes are available only on community listings.');limit('community_like',180);
    const index=db.community_likes.findIndex(item=>item.target_type===targetType&&item.target_id===targetId&&item.user_id===user.id);if(index>=0){db.community_likes.splice(index,1);return 'Like removed.';}db.community_likes.push({target_type:targetType,target_id:targetId,user_id:user.id,created_at:timestamp});return 'Liked.';
  }
  if(action==='community_delete_comment'){
    const comment=db.community_comments.find(item=>item.id===uuid.parse(data.id));if(!comment)throw new Error('Comment not found.');if(comment.author_user_id!==user.id&&user.role==='user')throw new Error('You can delete only your own comments.');comment.status='deleted';comment.body='';comment.deleted_at=timestamp;comment.updated_at=timestamp;db.community_likes=db.community_likes.filter(item=>!(item.target_type==='comment'&&item.target_id===comment.id));return 'Comment deleted.';
  }
  if(action==='save_profile'){const nickname=text(60).min(2).parse(data.nickname);if(/@|https?:\/\//i.test(nickname))throw new Error('Choose a nickname without an email address or URL.');user.nickname=nickname;return 'Profile updated.';}
  if(action==='report'){
    const d=schemas.report.parse(data); let entityId=d.target_id;let targetAuthorUserId:string|null=null;
    if(d.target_type==='review'){const review=db.reviews.find(r=>r.id===d.target_id && r.status==='published' && !r.deleted_at);if(!review)throw new Error('Review not found.');entityId=review.entity_id;}
    if(d.target_type==='forum_post'){const post=db.forum_posts.find(p=>p.id===d.target_id&&p.status==='published');if(!post)throw new Error('Post not found.');if(!canContribute(db,user,post.school_id))throw new Error('Use a verified email from this school to report content.');targetAuthorUserId=post.author_user_id;entityId='';}
    if(d.target_type==='forum_comment'){const comment=db.forum_comments.find(c=>c.id===d.target_id&&c.status==='published');const post=db.forum_posts.find(p=>p.id===comment?.post_id&&p.status==='published');if(!comment||!post)throw new Error('Comment not found.');if(!canContribute(db,user,post.school_id))throw new Error('Use a verified email from this school to report content.');targetAuthorUserId=comment.author_user_id;entityId='';}
    if(d.target_type==='community_comment'){const comment=db.community_comments.find(c=>c.id===d.target_id&&c.status==='published');if(!comment)throw new Error('Comment not found.');entityId=comment.entity_id;targetAuthorUserId=comment.author_user_id;}
    if(d.target_type==='user')throw new Error('Report a review to flag its author for moderator review.');
    if(entityId)contribute(entityId);limit('report',10);
    if(db.reports.some(r=>r.reporter_user_id===user.id && r.target_id===d.target_id && r.status==='pending'))throw new Error('You already have an open report for this content.');
    db.reports.push({...d,id:newId(),reporter_user_id:user.id,target_author_user_id:targetAuthorUserId,status:'pending',reviewed_by:null,reviewed_at:null,created_at:timestamp});return 'Report sent to the moderation team.';
  }
  if(action==='moderate_review'){requireStaff();const r=db.reviews.find(r=>r.id===data.id && !r.deleted_at);if(!r)throw new Error('Review not found.');r.status=z.enum(['hidden','published']).parse(data.status);audit(r.id);return 'Review visibility updated.';}
  if(action==='moderate_community_entity'){requireStaff();const entity=db.entities.find(item=>item.id===data.id&&db.categories.some(category=>category.id===item.category_id&&category.accepts_submissions));if(!entity)throw new Error('Community listing not found.');entity.status=z.enum(['active','archived']).parse(data.status);audit(entity.id);return 'Community listing visibility updated.';}
  if(action==='moderate_forum_post'){requireStaff();const post=db.forum_posts.find(p=>p.id===data.id&&p.status!=='deleted');if(!post)throw new Error('Post not found.');post.status=z.enum(['hidden','published']).parse(data.status);post.updated_at=timestamp;audit(post.id);return 'Post visibility updated.';}
  if(action==='moderate_forum_comment'){requireStaff();const comment=db.forum_comments.find(c=>c.id===data.id&&c.status!=='deleted');if(!comment)throw new Error('Comment not found.');comment.status=z.enum(['hidden','published']).parse(data.status);comment.updated_at=timestamp;audit(comment.id);return 'Comment visibility updated.';}
  if(action==='moderate_community_comment'){requireStaff();const comment=db.community_comments.find(c=>c.id===data.id&&c.status!=='deleted');if(!comment)throw new Error('Comment not found.');comment.status=z.enum(['hidden','published']).parse(data.status);comment.updated_at=timestamp;audit(comment.id);return 'Comment visibility updated.';}
  if(action==='resolve_report'){requireStaff();const r=db.reports.find(r=>r.id===data.id);if(!r)throw new Error('Report not found.');r.status='resolved';r.reviewed_by=user.id;r.reviewed_at=timestamp;audit(r.id);return 'Report resolved.';}
  if(action==='update_user'){
    requireStaff();const a=db.accounts.find(a=>a.id===data.id);if(!a)throw new Error('Account not found.');
    if(a.id===user.id)throw new Error('You cannot change your own role or suspension.');
    if(user.role!=='admin' && (a.role!=='user' || (data.role && data.role!=='user')))throw new Error('Only admins can manage staff roles.');
    const role=z.enum(['user','moderator','admin']).parse(data.role);const suspended=z.boolean().parse(data.suspended);
    if(a.role==='admin' && (role!=='admin'||suspended) && db.accounts.filter(x=>x.role==='admin'&&!x.suspended).length<=1)throw new Error('Keep at least one active administrator.');
    a.role=role;a.suspended=suspended;audit(a.id);return 'Account updated.';
  }
  requireAdmin();
  if(action==='archive_tag'){const tag=db.tags.find(item=>item.id===data.id&&item.kind==='custom');if(!tag)throw new Error('Only custom tags can be archived.');tag.status='archived';audit(tag.id);return 'Custom tag archived.';}
  if(action==='merge_tag'){const source=db.tags.find(item=>item.id===data.source_id&&item.kind==='custom');const target=db.tags.find(item=>item.id===data.target_id&&item.kind==='custom');if(!source||!target||source.school_id!==target.school_id||source.id===target.id)throw new Error('Choose two different custom tags from the same school.');for(const link of db.entity_tags.filter(item=>item.tag_id===source.id)){if(!db.entity_tags.some(item=>item.entity_id===link.entity_id&&item.tag_id===target.id))link.tag_id=target.id;}db.entity_tags=db.entity_tags.filter((item,index,array)=>item.tag_id!==source.id&&array.findIndex(other=>other.entity_id===item.entity_id&&other.tag_id===item.tag_id)===index);source.status='archived';audit(source.id);return 'Custom tags merged.';}
  if(action==='archive_managed_review'){const review=db.reviews.find(item=>item.id===data.id&&item.managed_identity_id&&!item.deleted_at);if(!review)throw new Error('Managed review not found.');review.deleted_at=timestamp;review.updated_at=timestamp;audit(review.id);return 'Managed review archived.';}
  if(action==='save_managed_identity'){
    const d=z.object({id:uuid.optional(),school_id:uuid,name:text(60).min(2),status}).parse(data);if(!db.schools.some(s=>s.id===d.school_id))throw new Error('School not found.');if(db.managed_identities.some(item=>item.school_id===d.school_id&&item.name.toLowerCase()===d.name.toLowerCase()&&item.id!==d.id))throw new Error('That contributor username already exists for this school.');const old=db.managed_identities.find(item=>item.id===d.id);if(d.id&&!old)throw new Error('Contributor profile not found.');const record={id:d.id||newId(),school_id:d.school_id,name:d.name,status:d.status,seeded:old?.seeded||false,created_by:old?.created_by||user.id,created_at:old?.created_at||timestamp,updated_at:timestamp,review_count:0,post_count:0};if(old)Object.assign(old,record);else db.managed_identities.push(record);audit(record.id);return d.status==='archived'?'Contributor profile archived.':'Contributor profile saved.';
  }
  if(action==='save_managed_review'){
    const d=z.object({id:uuid.optional(),managed_identity_id:uuid,entity_id:uuid,overall_rating:z.number().min(1).max(10).multipleOf(.5).nullable(),body:text(3000),publish:z.boolean(),values:schemas.review.shape.values}).parse(data);const identity=db.managed_identities.find(item=>item.id===d.managed_identity_id);const entity=db.entities.find(item=>item.id===d.entity_id);if(!identity||identity.status!=='active')throw new Error('Choose an active contributor profile.');if(!entity||entity.school_id!==identity.school_id)throw new Error('The contributor and entity must belong to the same school.');const dimensions=db.dimensions.filter(item=>item.category_id===entity.category_id&&item.is_active);if(d.publish){if(d.overall_rating===null&&!d.values.length)throw new Error('Add at least one rating.');for(const dim of dimensions)if(dim.is_required&&!d.values.some(value=>value.rating_dimension_id===dim.id))throw new Error(`Please rate ${dim.label}.`);}for(const value of d.values){const dim=dimensions.find(item=>item.id===value.rating_dimension_id);if(!dim||value.score<dim.min_value||value.score>dim.max_value)throw new Error('A rating is outside its configured range.');}let review=db.reviews.find(item=>item.managed_identity_id===identity.id&&item.entity_id===entity.id&&!item.deleted_at);if(review)Object.assign(review,{overall_rating:d.overall_rating,body:d.body,status:d.publish?'published':'draft',updated_at:timestamp});else{review={id:newId(),entity_id:entity.id,user_id:null,managed_identity_id:identity.id,overall_rating:d.overall_rating,body:d.body,is_anonymous:false,status:d.publish?'published':'draft',created_at:timestamp,updated_at:timestamp};db.reviews.push(review);}db.values=db.values.filter(value=>value.review_id!==review.id).concat(d.values.map(value=>({...value,review_id:review!.id})));audit(review.id);return d.publish?'Managed review published.':'Managed review draft saved.';
  }
  if(action==='save_school'){
    const d=schemas.school.parse(data);if(db.schools.some(s=>s.slug===d.slug && s.id!==d.id))throw new Error('That school slug already exists.');
    const old=db.schools.find(s=>s.id===d.id);if(d.id&&!old)throw new Error('School not found.');
    const record={...d,id:d.id||newId()};if(old)Object.assign(old,record);else db.schools.push(record);audit(record.id);return 'School saved.';
  }
  if(action==='save_category'){
    const d=schemas.category.parse(data);if(d.school_id && !db.schools.some(s=>s.id===d.school_id))throw new Error('School not found.');
    if(db.categories.some(c=>c.slug===d.slug && c.id!==d.id && (c.school_id===d.school_id || !c.school_id || !d.school_id)))throw new Error('That category slug conflicts with a global or school category. Choose a different slug.');
    if(d.id && d.school_id && db.entities.some(e=>e.category_id===d.id && e.school_id!==d.school_id))throw new Error('This category is used by another school.');
    const old=db.categories.find(c=>c.id===d.id);if(d.id&&!old)throw new Error('Category not found.');const record={...d,id:d.id||newId()};if(d.is_discover_default)for(const category of db.categories)if(category.school_id===d.school_id)category.is_discover_default=false;if(old)Object.assign(old,record);else db.categories.push(record);audit(record.id);return 'Category saved.';
  }
  if(action==='save_dimension'){
    const d=schemas.dimension.parse({...data,min_value:1,max_value:10});if(!db.categories.some(c=>c.id===d.category_id))throw new Error('Category not found.');
    if(db.dimensions.some(x=>x.category_id===d.category_id && x.key===d.key && x.id!==d.id))throw new Error('That dimension key already exists.');
    const old=db.dimensions.find(x=>x.id===d.id);if(d.id&&!old)throw new Error('Dimension not found.');
    if(old && db.values.some(v=>v.rating_dimension_id===old.id) && (old.min_value!==d.min_value || old.max_value!==d.max_value || old.category_id!==d.category_id))throw new Error('This dimension has ratings. Disable it and create a new dimension to change its scale or category.');
    const record={...d,id:d.id||newId()};if(old)Object.assign(old,record);else db.dimensions.push(record);audit(record.id);return 'Rating dimension saved.';
  }
  if(action==='save_entity'){
    const d=schemas.entity.parse(data);const category=db.categories.find(c=>c.id===d.category_id);
    if(!db.schools.some(s=>s.id===d.school_id)||!category || (category.school_id && category.school_id!==d.school_id))throw new Error('Choose a category available at this school.');
    if(db.entities.some(e=>e.slug===d.slug && e.id!==d.id))throw new Error('That entity slug already exists.');
    const old=db.entities.find(e=>e.id===d.id);if(d.id&&!old)throw new Error('Entity not found.');
    if(old && db.reviews.some(r=>r.entity_id===old.id) && (old.category_id!==d.category_id || old.school_id!==d.school_id))throw new Error('An entity with reviews cannot change category or school.');
    if(d.id && db.entities.some(e=>e.parent_entity_id===d.id && e.school_id!==d.school_id))throw new Error('Child entities must belong to the same school.');
    let parent=d.parent_entity_id;const visited=new Set<string>(d.id?[d.id]:[]);
    while(parent){if(visited.has(parent))throw new Error('Parent relationships cannot contain a cycle.');visited.add(parent);const p=db.entities.find(e=>e.id===parent);if(!p||p.school_id!==d.school_id)throw new Error('Parent must be in the same school.');parent=p.parent_entity_id;}
    const record={...d,id:d.id||newId(),created_at:old?.created_at||timestamp};if(old)Object.assign(old,record);else db.entities.push(record);audit(record.id);return 'Entity saved.';
  }
  if(action==='save_question'){
    const d=schemas.question.parse(data);const old=db.questions.find(q=>q.id===d.id);if(d.id&&!old)throw new Error('Question not found.');
    if(!db.schools.some(s=>s.id===d.school_id))throw new Error('School not found.');
    const labels=d.options.map(o=>o.label.toLowerCase());if(new Set(labels).size!==labels.length)throw new Error('Question options must be unique.');
    if(d.type==='prediction'){
      if(!d.closes_at||!d.event_at)throw new Error('Predictions need a closing time and event time.');
      if(Date.parse(d.closes_at)>Date.parse(d.event_at))throw new Error('Closing time must be before or at the event time.');
      if(!old&&Date.parse(d.closes_at)<=now)throw new Error('Prediction closing time must be in the future.');
      if(d.status==='resolved'&&Date.parse(d.event_at)>now)throw new Error('A prediction can be resolved only after its event time.');
      if(d.status==='resolved'&&!d.resolved_option_id)throw new Error('Choose the resolved result before resolving this prediction.');
      if(d.status!=='resolved'&&d.resolved_option_id)throw new Error('A result can be set only when the prediction is resolved.');
    } else if(d.event_at||d.resolved_option_id||d.status==='resolved')throw new Error('Student Stats questions do not use event results.');
    const hasResponses=!!old&&db.question_responses.some(r=>r.question_id===old.id);
    if(old&&hasResponses&&(old.school_id!==d.school_id||old.type!==d.type||old.title!==d.title))throw new Error('School, type and title are locked after responses arrive.');
    if(old&&['closed','resolved','archived'].includes(old.status)&&d.status==='open')throw new Error('Closed questions cannot be reopened.');
    const questionId=d.id||newId();
    const optionIds=d.options.map(o=>o.id||newId());
    if(hasResponses){const existing=db.question_options.filter(o=>o.question_id===questionId);if(existing.length!==d.options.length||d.options.some((o,i)=>o.id!==existing.sort((a,b)=>a.sort_order-b.sort_order)[i]?.id||o.label!==existing.sort((a,b)=>a.sort_order-b.sort_order)[i]?.label))throw new Error('Options are locked after responses arrive.');}
    const resolved=d.resolved_option_id;if(resolved&&!optionIds.includes(resolved))throw new Error('The resolved option must belong to this question.');
    const record={id:questionId,school_id:d.school_id,type:d.type,title:d.title,category:d.category,status:d.status,closes_at:d.closes_at,event_at:d.event_at,resolved_option_id:resolved,show_in_popup:d.show_in_popup,is_featured:d.is_featured,sort_order:d.sort_order,created_by:old?.created_by||user.id,created_at:old?.created_at||timestamp,updated_at:timestamp};
    if(old)Object.assign(old,record);else db.questions.push(record);
    if(!hasResponses){db.question_options=db.question_options.filter(o=>o.question_id!==questionId).concat(d.options.map((o,i)=>({id:optionIds[i],question_id:questionId,label:o.label,sort_order:o.sort_order})));}
    audit(questionId);return 'Question saved.';
  }
  throw new Error('Unknown action.');
}
