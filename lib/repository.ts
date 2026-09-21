import { cache } from 'react';
import { cookies } from 'next/headers';
import { dataMode } from './config';
import { demoSnapshot, demoCommand, demoAnswer,demoForumFeed,demoForumPost,demoForumComments,demoBeginForumPost,demoFinalizeForumPost,demoCancelForumPost } from './demo-store';
import { supabase } from './supabase';
import type { Command, EntitySubmission, ForumCommentNode, ForumPage, ForumPostCard, ForumPostDetail, ForumSort, QuestionView, Snapshot } from './types';
import { validateCommand } from './domain';
type RawImageRecord={image_path?:string|null};
type RawSnapshot=Omit<Snapshot,'entities'|'own_submissions'|'admin_submissions'>&{
  entities:(Snapshot['entities'][number]&RawImageRecord)[];
  own_submissions:(EntitySubmission&RawImageRecord)[];
  admin_submissions:(EntitySubmission&RawImageRecord)[];
};
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
  const client=await supabase();const {data,error}=await client.rpc('get_app_data');if(error)throw new Error('Unable to load campus data. Check the connection and database migrations.');return hydrateImages(client,data as RawSnapshot);
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
  if(dataMode()==='demo')throw new Error('Community uploads require a Supabase-connected environment.');
  const client=await supabase();const {data:result,error}=await client.rpc('begin_entity_submission',{p_data:data});if(error)throw new Error(error.message);return result as {id:string;path:string};
}
export async function finalizeEntitySubmission(id:string){
  const client=await supabase();const {data,error}=await client.rpc('finalize_entity_submission',{p_id:id});if(error)throw new Error(error.message);return String(data);
}
export async function cancelEntitySubmission(id:string){
  if(dataMode()==='demo')return;const client=await supabase();await client.rpc('cancel_entity_submission',{p_id:id});
}
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
