import { cookies } from 'next/headers';
import { beginForumPost } from '@/lib/repository';
import { dataMode } from '@/lib/config';
import { supabase } from '@/lib/supabase';
export const runtime='nodejs';
export async function POST(request:Request){
  const origin=request.headers.get('origin'),host=request.headers.get('x-forwarded-host')||request.headers.get('host');if(origin&&host&&new URL(origin).host!==host)return Response.json({ok:false,message:'Invalid request origin.'},{status:403});
  try{if(dataMode()==='supabase'){const {data:{user}}=await (await supabase()).auth.getUser();if(!user)return Response.json({ok:false,message:'Sign in with your school email to create a post.'},{status:401});}else if(!(await cookies()).get('rateduke-demo-user'))return Response.json({ok:false,message:'Sign in with your school email to create a post.'},{status:401});const result=await beginForumPost(await request.json());return Response.json({ok:true,...result});}catch(error){return Response.json({ok:false,message:error instanceof Error?error.message:'Unable to start this post.'},{status:400});}
}
