import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callbackFailureCode } from '@/lib/auth';
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');const token=url.searchParams.get('token_hash');const flowId=url.searchParams.get('sb_flow_id');const providerError=url.searchParams.get('error');const client=await supabase();
  if(providerError)return NextResponse.redirect(new URL('/login?error=denied',url.origin));
  if(code){const {error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);if(!error)return NextResponse.redirect(new URL('/profile',url.origin));return NextResponse.redirect(new URL(`/login?error=${callbackFailureCode(error)}`,url.origin));}
  if(token){const {error}=await client.auth.verifyOtp({token_hash:token,type:'email'});if(!error)return NextResponse.redirect(new URL('/profile',url.origin));return NextResponse.redirect(new URL(`/login?error=${callbackFailureCode(error)}`,url.origin));}
  return NextResponse.redirect(new URL('/login?error=invalid',url.origin));
}
