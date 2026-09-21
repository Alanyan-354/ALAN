import { cookies } from 'next/headers';
import { dataMode } from '@/lib/config';
import { demoForumImage } from '@/lib/demo-store';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{postId:string;imageId:string}>}){if(dataMode()!=='demo')return new Response('Not found',{status:404});const {postId,imageId}=await params;const data=await demoForumImage((await cookies()).get('rateduke-demo-user')?.value||null,postId,imageId);if(!data)return new Response('Not found',{status:404});return new Response(new Uint8Array(data),{headers:{'content-type':'image/webp','cache-control':'private, max-age=3600'}});}
