import 'server-only';
import sharp from 'sharp';
import { dataMode } from './config';
import { demoSaveForumImage } from './demo-store';
import { markForumImageReady } from './repository';
import { supabase } from './supabase';

export const FORUM_IMAGE_MAX_BYTES=5*1024*1024;
const accepted=new Set(['image/jpeg','image/png','image/webp']);
export async function normalizeForumImage(file:File){
  if(!file.size||file.size>FORUM_IMAGE_MAX_BYTES||!accepted.has(file.type))throw new Error('Upload a JPEG, PNG, or WebP image no larger than 5 MB.');
  try{const input=Buffer.from(await file.arrayBuffer());const metadata=await sharp(input,{failOn:'warning'}).metadata();if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format))throw new Error();const output=await sharp(input,{failOn:'warning'}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:4}).toBuffer();const result=await sharp(output).metadata();return {buffer:output,width:result.width||1,height:result.height||1};}catch{throw new Error('The selected file is not a valid JPEG, PNG, or WebP image.');}
}
export async function uploadForumImage(userId:string|null,postId:string,imageId:string,file:File){
  const normalized=await normalizeForumImage(file);
  if(dataMode()==='demo'){await demoSaveForumImage(userId,postId,imageId,normalized.buffer,normalized.width,normalized.height);return;}
  const client=await supabase();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in with your school email to upload images.');
  const storagePath=`${user.id}/${postId}/${imageId}.webp`;const {error}=await client.storage.from('forum-images').upload(storagePath,normalized.buffer,{contentType:'image/webp',cacheControl:'31536000',upsert:false});if(error)throw new Error('The image could not be uploaded. Please try again.');
  try{await markForumImageReady(imageId,normalized.width,normalized.height);}catch(error){await client.storage.from('forum-images').remove([storagePath]);throw error;}
}
