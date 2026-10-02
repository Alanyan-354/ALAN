import { dataMode } from '@/lib/config';
import { demoEntityImage } from '@/lib/demo-store';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{path:string[]}>}){if(dataMode()!=='demo')return new Response(null,{status:404});const parts=(await params).path;const submission=parts.length===2&&parts.every(part=>/^[0-9a-f-]+(?:\.webp)?$/i.test(part));const official=parts.length===3&&parts[0]==='official'&&parts.slice(1).every(part=>/^[0-9a-f-]+(?:\.webp)?$/i.test(part));if(!submission&&!official)return new Response(null,{status:404});const image=await demoEntityImage(parts.join('/'));return image?new Response(new Uint8Array(image),{headers:{'content-type':'image/webp','cache-control':'private, max-age=3600'}}):new Response(null,{status:404});}
