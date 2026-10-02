import sharp from 'sharp';
import { beginEntityGalleryUpload, cancelEntityGalleryUpload, saveEntityGallery, saveEntityGalleryImage } from '@/lib/repository';

export const runtime='nodejs';
const MAX_BYTES=5*1024*1024;
const allowed=new Set(['image/jpeg','image/png','image/webp']);
function sameOrigin(request:Request){const origin=request.headers.get('origin'),host=request.headers.get('x-forwarded-host')||request.headers.get('host');return !origin||!host||new URL(origin).host===host;}

export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({ok:false,message:'Invalid request origin.'},{status:403});
  if(Number(request.headers.get('content-length')||0)>12*MAX_BYTES+512_000)return Response.json({ok:false,message:'Each image must be 5 MB or smaller.'},{status:413});
  const form=await request.formData();const entityId=String(form.get('entity_id')||'');const files=form.getAll('images').filter((item):item is File=>item instanceof File&&item.size>0);
  if(!files.length||files.length>12)return Response.json({ok:false,message:'Choose between 1 and 12 images.'},{status:400});
  if(files.some(file=>file.size>MAX_BYTES||!allowed.has(file.type)))return Response.json({ok:false,message:'Upload JPEG, PNG, or WebP images no larger than 5 MB each.'},{status:400});
  let slots:{id:string;path:string;index:number}[]=[];
  try{
    const images=await Promise.all(files.map(async file=>{const input=Buffer.from(await file.arrayBuffer());const meta=await sharp(input,{failOn:'warning'}).metadata();if(!meta.format||!['jpeg','png','webp'].includes(meta.format))throw new Error('Invalid image.');const result=await sharp(input,{failOn:'warning'}).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:4}).toBuffer({resolveWithObject:true});return {buffer:result.data,width:result.info.width,height:result.info.height};}));
    slots=await beginEntityGalleryUpload(entityId,images.length);
    for(const slot of slots){const image=images[slot.index];await saveEntityGalleryImage(slot.id,slot.path,image.buffer,image.width,image.height);}
    return Response.json({ok:true,message:`${images.length} ${images.length===1?'image':'images'} added.`});
  }catch(error){if(slots.length)await cancelEntityGalleryUpload(slots.map(slot=>slot.id)).catch(()=>undefined);return Response.json({ok:false,message:error instanceof Error?error.message:'Unable to upload these images.'},{status:400});}
}

export async function PATCH(request:Request){
  if(!sameOrigin(request))return Response.json({ok:false,message:'Invalid request origin.'},{status:403});
  try{const body=await request.json() as {entity_id?:unknown;items?:unknown};if(typeof body.entity_id!=='string'||!Array.isArray(body.items))throw new Error('Invalid gallery.');const items=body.items.map(item=>{const value=item as Record<string,unknown>;if(typeof value.id!=='string'||typeof value.alt_text!=='string'||!['photo','graphic'].includes(String(value.kind)))throw new Error('Invalid gallery item.');return {id:value.id,alt_text:value.alt_text,kind:value.kind as 'photo'|'graphic'};});await saveEntityGallery(body.entity_id,items);return Response.json({ok:true,message:'Official gallery saved.'});}
  catch(error){return Response.json({ok:false,message:error instanceof Error?error.message:'Unable to save the gallery.'},{status:400});}
}
