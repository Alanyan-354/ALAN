import { NextResponse } from 'next/server';
import { dataMode } from '@/lib/config';
import { demoIdentities } from '@/supabase/seed/demo';

export async function GET(request:Request){
  const url=new URL(request.url),identity=url.searchParams.get('identity');
  if(dataMode()!=='demo'||(identity!=='duke'&&identity!=='admin'))return new NextResponse(null,{status:303,headers:{Location:'/login?error=invalid'}});
  const response=new NextResponse(null,{status:303,headers:{Location:identity==='admin'?'/admin':'/discover?school=duke-university'}});
  response.cookies.set('rateduke-demo-user',demoIdentities[identity],{httpOnly:true,sameSite:'strict',path:'/'});
  return response;
}
