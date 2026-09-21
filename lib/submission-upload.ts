import 'server-only';
import sharp from 'sharp';
import { beginEntitySubmission, cancelEntitySubmission, finalizeEntitySubmission } from './repository';
import { supabase } from './supabase';

const MAX_INPUT_BYTES=5*1024*1024;
const allowed=new Set(['image/jpeg','image/png','image/webp']);

export async function handleSubmissionUpload(request:Request,id?:string){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({ok:false,message:'Invalid request origin.'},{status:403});
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>MAX_INPUT_BYTES+256_000)return Response.json({ok:false,message:'The image must be 5 MB or smaller.'},{status:413});
  const client=await supabase();const {data:{user}}=await client.auth.getUser();
  if(!user)return Response.json({ok:false,message:'Sign in with your school email to submit a campus find.'},{status:401});
  const form=await request.formData();const image=form.get('image');
  if(!(image instanceof File)||!image.size)return Response.json({ok:false,message:'Choose one image to continue.'},{status:400});
  if(image.size>MAX_INPUT_BYTES||!allowed.has(image.type))return Response.json({ok:false,message:'Upload one JPEG, PNG, or WebP image no larger than 5 MB.'},{status:400});
  let normalized:Buffer;
  try{
    const input=Buffer.from(await image.arrayBuffer());const metadata=await sharp(input,{failOn:'warning'}).metadata();
    if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format))throw new Error('Unsupported image data.');
    normalized=await sharp(input,{failOn:'warning'}).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
  }catch{return Response.json({ok:false,message:'The selected file is not a valid JPEG, PNG, or WebP image.'},{status:400});}
  let draft:{id:string;path:string}|null=null;
  try{
    draft=await beginEntitySubmission({
      ...(id?{id}:{}),school_id:String(form.get('school_id')||''),name:String(form.get('name')||''),
      location_name:String(form.get('location_name')||''),description:String(form.get('description')||''),
      initial_overall_rating:Number(form.get('initial_overall_rating')),initial_review_body:String(form.get('initial_review_body')||''),
      is_anonymous:form.get('is_anonymous')==='on'
    });
    await client.storage.from('entity-images').remove([draft.path]);
    const {error:uploadError}=await client.storage.from('entity-images').upload(draft.path,normalized,{contentType:'image/webp',cacheControl:'3600',upsert:false});
    if(uploadError)throw new Error('The image could not be uploaded. Please try again.');
    const message=await finalizeEntitySubmission(draft.id);
    return Response.json({ok:true,message,id:draft.id});
  }catch(error){
    if(draft){await client.storage.from('entity-images').remove([draft.path]);await cancelEntitySubmission(draft.id);}
    return Response.json({ok:false,message:error instanceof Error?error.message:'Unable to submit this campus find.'},{status:400});
  }
}
