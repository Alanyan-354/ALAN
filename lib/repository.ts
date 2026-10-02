import { cache } from 'react';
import { cookies } from 'next/headers';
import { dataMode } from './config';
import { demoSnapshot, demoCommand, demoAnswer,demoForumFeed,demoForumPost,demoForumComments,demoBeginForumPost,demoFinalizeForumPost,demoCancelForumPost,demoBeginEntitySubmission,demoSaveEntitySubmissionImage,demoFinalizeEntitySubmission,demoCancelEntitySubmission,demoBeginEntityGalleryUpload,demoSaveEntityGalleryImage,demoCancelEntityGalleryUpload,demoSaveEntityGallery } from './demo-store';
import { supabase } from './supabase';
import type { AdminEntityImage, Command, CommunityAuthor, CommunityCommentNode, EntitySubmission, EntityTag, ForumCommentNode, ForumPage, ForumPostCard, ForumPostDetail, ForumSort, QuestionView, Snapshot, Tag } from './types';
import { validateCommand } from './domain';
type RawImageRecord={image_path?:string|null};
type RawSnapshot=Omit<Snapshot,'entities'|'own_submissions'|'admin_submissions'>&{
  entities:(Snapshot['entities'][number]&RawImageRecord)[];
  own_submissions:(EntitySubmission&RawImageRecord)[];
  admin_submissions:(EntitySubmission&RawImageRecord)[];
};
type CommunityData={tags:Tag[];entity_tags:EntityTag[];community_authors:CommunityAuthor[];community_comments:CommunityCommentNode[];review_likes:{review_id:string;like_count:number;liked_by_viewer:boolean}[];entity_images:{entity_id:string;storage_path:string;sort_order:number;width:number;height:number}[];admin_user_counts:{user_id:string;community_comment_count:number;community_like_count:number}[];managed_counts:{managed_identity_id:string;community_entity_count:number;community_comment_count:number}[];admin_summary:{community_entities:number;community_comments:number;community_likes:number;custom_tags:number}|null};
type GalleryData={images:(Omit<AdminEntityImage,'url'|'uploaded'>&{storage_path:string|null;source_url:string|null;status:'pending'|'ready';uploaded:boolean})[]};
async function hydrateImages(client:Awaited<ReturnType<typeof supabase>>,raw:RawSnapshot):Promise<Snapshot>{
  const records=[...raw.entities,...raw.own_submissions,...raw.admin_submissions];
  const paths=[...new Set(records.flatMap(record=>record.image_path?[record.image_path]:[]))];
  const urls=new Map<string,string>();
  if(paths.length){const {data}=await client.storage.from('entity-images').createSignedUrls(paths,3600);for(const item of data||[])if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl);}
  const clean=<T extends RawImageRecord>(record:T)=>{const {image_path,...safe}=record;return {...safe,image_url:image_path?urls.get(image_path)||null:null};};
  return {...raw,entities:raw.entities.map(clean),own_submissions:raw.own_submissions.map(clean),admin_submissions:raw.admin_submissions.map(clean)} as Snapshot;
}
export const getSnapshot=cache(async():Promise<Snapshot>=>{
  if(dataMode()==='demo')return demoSnapshot((await cookies()).get('rateduke-demo-user')?.value||null);
  const client=await supabase();const [appResult,communityResult,galleryResult]=await Promise.all([client.rpc('get_app_data'),client.rpc('get_community_data'),client.rpc('get_entity_gallery_data')]);if(appResult.error||communityResult.error||galleryResult.error)throw new Error('Unable to load campus data. Check the connection and database migrations.');const community=communityResult.data as CommunityData;const gallery=galleryResult.data as GalleryData;const raw=appResult.data as RawSnapshot;const reviewLikes=new Map(community.review_likes.map(item=>[item.review_id,item]));raw.reviews=raw.reviews.map(review=>({...review,...reviewLikes.get(review.id)}));raw.own_reviews=raw.own_reviews.map(review=>({...review,...reviewLikes.get(review.id)}));const accountCounts=new Map(community.admin_user_counts.map(item=>[item.user_id,item]));raw.accounts=raw.accounts.map(account=>({...account,...accountCounts.get(account.id)}));const managedCounts=new Map(community.managed_counts.map(item=>[item.managed_identity_id,item]));raw.managed_identities=raw.managed_identities.map(identity=>({...identity,...managedCounts.get(identity.id)}));raw.tags=community.tags;raw.entity_tags=community.entity_tags;raw.community_authors=community.community_authors;raw.community_comments=community.community_comments;if(raw.admin_summary&&community.admin_summary)Object.assign(raw.admin_summary,community.admin_summary);const allPaths=[...gallery.images.flatMap(image=>image.storage_path?[image.storage_path]:[]),...community.entity_images.map(image=>image.storage_path)];const paths=[...new Set(allPaths)];const urls=new Map<string,string>();if(paths.length){const {data}=await client.storage.from('entity-images').createSignedUrls(paths,3600);for(const item of data||[])if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl);}for(const entity of raw.entities){const images=gallery.images.filter(image=>image.entity_id===entity.id&&image.status==='ready').sort((a,b)=>a.sort_order-b.sort_order).flatMap(image=>{const src=image.source_url||(image.storage_path?urls.get(image.storage_path):null);return src?[{src,alt:image.alt_text,kind:image.kind,...(image.width&&image.height?{width:image.width,height:image.height}:{})}]:[]});if(images.length){entity.metadata={...entity.metadata,gallery:images};entity.image_url=images[0].src;}}raw.admin_entity_images=gallery.images.filter(image=>image.status==='ready').flatMap(image=>{const url=image.source_url||(image.storage_path?urls.get(image.storage_path):null);return url?[{id:image.id,entity_id:image.entity_id,url,sort_order:image.sort_order,alt_text:image.alt_text,kind:image.kind,width:image.width,height:image.height,uploaded:image.uploaded}]:[]});return hydrateImages(client,raw);
});
export async function execute(command:Command){
  command=validateCommand(command);
  if(dataMode()==='demo')return demoCommand((await cookies()).get('rateduke-demo-user')?.value||null,command);
  const client=await supabase();const {data,error}=await client.rpc('app_command',{p_action:command.action,p_data:command.data});if(error)throw new Error(error.message);return String(data);
}
export async function answerQuestion(questionId:string,optionId:string):Promise<QuestionView>{
  if(dataMode()==='demo')return demoAnswer((await cookies()).get('rateduke-demo-user')?.value||null,questionId,optionId);
  const client=await supabase();const {data,error}=await client.rpc('answer_question',{p_question:questionId,p_option:optionId});if(error)throw new Error(error.message);return data as QuestionView;
}
export async function searchEntityIds(query:string,school:string|null):Promise<string[]|null>{
  if(dataMode()==='demo'||!query.trim())return null;
  const {data,error}=await (await supabase()).rpc('search_entities',{p_query:query,p_school:school});if(error)throw new Error('Search is temporarily unavailable. Please try again.');return (data as {id:string}[]).map(x=>x.id);
}
export async function beginEntitySubmission(data:Record<string,unknown>){
  if(dataMode()==='demo')return demoBeginEntitySubmission((await cookies()).get('rateduke-demo-user')?.value||null,data);
  const client=await supabase();const {data:result,error}=await client.rpc('begin_entity_submission',{p_data:data});if(error)throw new Error(error.message);return result as {id:string;images:{index:number;path:string}[]};
}
export async function saveEntitySubmissionImage(id:string,path:string,buffer:Buffer,width:number,height:number){if(dataMode()==='demo')return demoSaveEntitySubmissionImage((await cookies()).get('rateduke-demo-user')?.value||null,id,path,buffer);const client=await supabase();const {error:uploadError}=await client.storage.from('entity-images').upload(path,buffer,{contentType:'image/webp',cacheControl:'3600',upsert:false});if(uploadError)throw new Error('The images could not be uploaded. Please try again.');const {error}=await client.rpc('mark_entity_submission_image_ready',{p_id:id,p_path:path,p_width:width,p_height:height});if(error)throw new Error(error.message);}
export async function finalizeEntitySubmission(id:string){
  if(dataMode()==='demo')return demoFinalizeEntitySubmission((await cookies()).get('rateduke-demo-user')?.value||null,id);
  const client=await supabase();const {data,error}=await client.rpc('finalize_entity_submission',{p_id:id});if(error)throw new Error(error.message);return String(data);
}
export async function cancelEntitySubmission(id:string){
  if(dataMode()==='demo')return demoCancelEntitySubmission((await cookies()).get('rateduke-demo-user')?.value||null,id);const client=await supabase();await client.rpc('cancel_entity_submission',{p_id:id});
}
export async function beginEntityGalleryUpload(entityId:string,count:number){if(dataMode()==='demo')return demoBeginEntityGalleryUpload(await demoUser(),entityId,count);const {data,error}=await (await supabase()).rpc('begin_entity_gallery_upload',{p_entity:entityId,p_count:count});if(error)throw new Error(error.message);return data as {id:string;path:string;index:number}[];}
export async function saveEntityGalleryImage(id:string,path:string,buffer:Buffer,width:number,height:number){if(dataMode()==='demo')return demoSaveEntityGalleryImage(await demoUser(),id,buffer,width,height);const client=await supabase();const {error:uploadError}=await client.storage.from('entity-images').upload(path,buffer,{contentType:'image/webp',cacheControl:'3600',upsert:false});if(uploadError)throw new Error('The image could not be uploaded. Please try again.');const {error}=await client.rpc('mark_entity_gallery_image_ready',{p_id:id,p_width:width,p_height:height});if(error)throw new Error(error.message);}
export async function cancelEntityGalleryUpload(ids:string[]){if(dataMode()==='demo')return demoCancelEntityGalleryUpload(await demoUser(),ids);const client=await supabase();const {data,error}=await client.rpc('cancel_entity_gallery_upload',{p_ids:ids});if(error)throw new Error(error.message);const paths=(data||[]) as string[];if(paths.length)await client.storage.from('entity-images').remove(paths);}
export async function saveEntityGallery(entityId:string,items:{id:string;alt_text:string;kind:'photo'|'graphic'}[]){if(dataMode()==='demo')return demoSaveEntityGallery(await demoUser(),entityId,items);const client=await supabase();const {data,error}=await client.rpc('save_entity_gallery',{p_entity:entityId,p_items:items});if(error)throw new Error(error.message);const paths=(data||[]) as string[];if(paths.length){const {error:removeError}=await client.storage.from('entity-images').remove(paths);if(removeError)throw new Error(`The gallery was saved, but an old upload could not be removed: ${removeError.message}`);}}
type RawForumImage={id:string;storage_path?:string|null;bundled_path?:string|null;url?:string;width:number;height:number;sort_order:number};
type RawForumCard=Omit<ForumPostCard,'cover'>&{cover:RawForumImage};
type RawForumDetail=Omit<ForumPostDetail,'cover'|'images'>&{cover:RawForumImage;images:RawForumImage[]};
async function hydrateForumImages<T extends RawForumCard|RawForumDetail>(client:Awaited<ReturnType<typeof supabase>>,record:T):Promise<T extends RawForumDetail?ForumPostDetail:ForumPostCard>{
  const images:RawForumImage[]='images' in record?record.images:[record.cover];const paths=[...new Set(images.flatMap(image=>image.storage_path?[image.storage_path]:[]))];const urls=new Map<string,string>();
  if(paths.length){const {data}=await client.storage.from('forum-images').createSignedUrls(paths,3600);for(const item of data||[])if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl);}
  const clean=(image:RawForumImage)=>({id:image.id,url:image.bundled_path||image.url||(image.storage_path?urls.get(image.storage_path):null)||'',width:image.width,height:image.height,sort_order:image.sort_order});
  return ({...record,cover:clean(record.cover),...('images' in record?{images:record.images.map(clean)}:{})} as unknown) as T extends RawForumDetail?ForumPostDetail:ForumPostCard;
}
const demoUser=async()=>(await cookies()).get('rateduke-demo-user')?.value||null;
export async function getForumFeed(schoolId:string,sort:ForumSort='hot',page=1,pageSize=20):Promise<ForumPage<ForumPostCard>>{
  if(dataMode()==='demo')return demoForumFeed(await demoUser(),schoolId,sort,page,pageSize);
  const client=await supabase();const {data,error}=await client.rpc('get_forum_feed',{p_school:schoolId,p_sort:sort,p_page:page,p_limit:pageSize});if(error)throw new Error(error.message);const raw=data as ForumPage<RawForumCard>;return {...raw,items:await Promise.all(raw.items.map(item=>hydrateForumImages(client,item)))};
}
export async function getForumPost(id:string):Promise<ForumPostDetail|null>{
  if(dataMode()==='demo')return demoForumPost(await demoUser(),id);
  const client=await supabase();const {data,error}=await client.rpc('get_forum_post',{p_id:id});if(error)throw new Error(error.message);return data?hydrateForumImages(client,data as RawForumDetail):null;
}
export async function getForumComments(postId:string,parentId:string|null,page=1,pageSize=parentId?10:20):Promise<ForumPage<ForumCommentNode>>{
  if(dataMode()==='demo')return demoForumComments(await demoUser(),postId,parentId,page,pageSize);
  const {data,error}=await (await supabase()).rpc('get_forum_comments',{p_post:postId,p_parent:parentId,p_page:page,p_limit:pageSize});if(error)throw new Error(error.message);return data as ForumPage<ForumCommentNode>;
}
export async function beginForumPost(input:unknown):Promise<{id:string;images:{id:string;index:number;path?:string}[]}>{
  if(dataMode()==='demo')return demoBeginForumPost(await demoUser(),input);
  const {data,error}=await (await supabase()).rpc('begin_forum_post',{p_data:input});if(error)throw new Error(error.message);return data as {id:string;images:{id:string;index:number;path:string}[]};
}
export async function markForumImageReady(id:string,width:number,height:number){if(dataMode()==='demo')return;const {error}=await (await supabase()).rpc('mark_forum_image_ready',{p_id:id,p_width:width,p_height:height});if(error)throw new Error(error.message);}
export async function finalizeForumPost(id:string){if(dataMode()==='demo')return demoFinalizeForumPost(await demoUser(),id);const {data,error}=await (await supabase()).rpc('finalize_forum_post',{p_id:id});if(error)throw new Error(error.message);return String(data);}
export async function cancelForumPost(id:string){if(dataMode()==='demo')return demoCancelForumPost(await demoUser(),id);const client=await supabase();const {data:paths,error:pathError}=await client.rpc('get_forum_draft_paths',{p_id:id});if(pathError)throw new Error(pathError.message);if((paths as string[])?.length){const {error:removeError}=await client.storage.from('forum-images').remove(paths as string[]);if(removeError)throw new Error(`Unable to clean up the draft images: ${removeError.message}`);}const {error}=await client.rpc('cancel_forum_post',{p_id:id});if(error)throw new Error(error.message);}
