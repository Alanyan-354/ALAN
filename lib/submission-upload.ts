import 'server-only';
import sharp from 'sharp';
import { beginEntitySubmission, cancelEntitySubmission, finalizeEntitySubmission, getSnapshot, saveEntitySubmissionImage } from './repository';
import { supabase } from './supabase';
import { dataMode } from './config';

const MAX_INPUT_BYTES=5*1024*1024;
const MAX_TOTAL_BYTES=25*1024*1024;
const allowed=new Set(['image/jpeg','image/png','image/webp']);

export async function handleSubmissionUpload(request:Request,id?:string){
  const origin=request.headers.get('origin'),host=request.headers.get('x-forwarded-host')||request.headers.get('host');
  if(origin&&host&&new URL(origin).host!==host)return Response.json({ok:false,message:'Invalid request origin.'},{status:403});
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>MAX_TOTAL_BYTES+512_000)return Response.json({ok:false,message:'Upload up to five images, each 5 MB or smaller.'},{status:413});
  const demo=dataMode()==='demo';const client=demo?null:await supabase();const viewer=demo?(await getSnapshot()).viewer:null;const user=demo?viewer:(await client!.auth.getUser()).data.user;
  if(!user)return Response.json({ok:false,message:'Sign in with your school email to submit a campus find.'},{status:401});
  const form=await request.formData();const images=form.getAll('images').filter((item):item is File=>item instanceof File&&item.size>0);if(!images.length){const legacy=form.get('image');if(legacy instanceof File&&legacy.size)images.push(legacy);}
  if(images.length<1||images.length>5)return Response.json({ok:false,message:'Choose between one and five images.'},{status:400});
  if(images.some(image=>image.size>MAX_INPUT_BYTES||!allowed.has(image.type)))return Response.json({ok:false,message:'Upload JPEG, PNG, or WebP images no larger than 5 MB each.'},{status:400});
  let normalized:{buffer:Buffer;width:number;height:number}[];
  try{normalized=await Promise.all(images.map(async image=>{const input=Buffer.from(await image.arrayBuffer());const metadata=await sharp(input,{failOn:'warning'}).metadata();if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format))throw new Error('Unsupported image data.');const result=await sharp(input,{failOn:'warning'}).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer({resolveWithObject:true});return {buffer:result.data,width:result.info.width,height:result.info.height};}));}
  catch{return Response.json({ok:false,message:'Every selected file must be a valid JPEG, PNG, or WebP image.'},{status:400});}
  let draft:{id:string;images:{index:number;path:string}[]}|null=null;const uploaded:string[]=[];
  try{
    draft=await beginEntitySubmission({
      ...(id?{id}:{}),school_id:String(form.get('school_id')||''),name:String(form.get('name')||''),
      location_name:String(form.get('location_name')||''),description:String(form.get('description')||''),
      initial_overall_rating:Number(form.get('initial_overall_rating')),initial_review_body:String(form.get('initial_review_body')||''),
      primary_tag_id:String(form.get('primary_tag_id')||''),custom_tags:form.getAll('custom_tags').map(String).filter(Boolean),image_count:normalized.length,
      managed_identity_id:String(form.get('managed_identity_id')||'')||undefined
    });
    for(const slot of draft.images){const image=normalized[slot.index];await saveEntitySubmissionImage(draft.id,slot.path,image.buffer,image.width,image.height);uploaded.push(slot.path);}
    const entityId=await finalizeEntitySubmission(draft.id);
    return Response.json({ok:true,message:'Community listing published.',id:draft.id,entity_id:entityId});
  }catch(error){
    if(draft){if(client&&uploaded.length)await client.storage.from('entity-images').remove(uploaded);await cancelEntitySubmission(draft.id);}
    return Response.json({ok:false,message:error instanceof Error?error.message:'Unable to submit this campus find.'},{status:400});
  }
}
