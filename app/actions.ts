'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { dataMode } from '@/lib/config';
import { answerQuestion, execute, getSnapshot } from '@/lib/repository';
import type { QuestionView } from '@/lib/types';
import { resetDemo } from '@/lib/demo-store';
import { demoIdentities } from '@/supabase/seed/demo';
import { supabase } from '@/lib/supabase';
import { otpFailure, signInFailure } from '@/lib/auth';
export interface FormState { ok: boolean; message: string; retryAfterSeconds?: number }
const numbers=['overall_rating','min_value','max_value','sort_order','latitude','longitude'];
const nullable=['school_id','parent_entity_id','overall_rating','latitude','longitude','last_verified_at','closes_at','event_at','resolved_option_id'];
export async function submitAction(_previous:FormState,form:FormData):Promise<FormState>{
  try{
    const action=String(form.get('_action'));const data:Record<string,unknown>=JSON.parse(String(form.get('_base')||'{}'));
    for(const [key,value] of form.entries())if(!key.startsWith('_')&&!key.startsWith('rating:')){
      const str=String(value);data[key]=nullable.includes(key)&&!str?null:numbers.includes(key)?Number(str):str;
    }
    if(!data.id)delete data.id;
    if(action==='save_review'){data.is_anonymous=form.has('is_anonymous');data.values=Array.from(form.entries()).filter(([key,value])=>key.startsWith('rating:')&&value!=='').map(([key,value])=>({rating_dimension_id:key.slice(7),score:Number(value)}));}
    if(action==='save_category'){data.is_discover_default=form.has('is_discover_default');data.accepts_submissions=form.has('accepts_submissions');}
    if(action==='save_dimension'){data.is_active=form.has('is_active');data.is_required=form.has('is_required');data.min_value=1;data.max_value=10;}
    if(action==='save_entity'){data.is_featured=form.has('is_featured');try{data.metadata=JSON.parse(String(form.get('metadata')||'{}'));}catch{throw new Error('Metadata must be a valid JSON object.');}if(data.last_verified_at)data.last_verified_at=new Date(String(data.last_verified_at)).toISOString();}
    if(action==='save_question'){
      data.show_in_popup=form.has('show_in_popup');data.is_featured=form.has('is_featured');
      data.options=[0,1,2,3].map(i=>({id:String(form.get(`option_id_${i}`)||'')||undefined,label:String(form.get(`option_${i}`)||'').trim(),sort_order:i})).filter(option=>option.label);
      for(const key of ['closes_at','event_at'])if(data[key])data[key]=new Date(`${String(data[key])}Z`).toISOString();
    }
    if(action==='update_user')data.suspended=form.has('suspended');
    if(action==='demo_identity'){
      if(dataMode()!=='demo')throw new Error('Demo identities are unavailable.');
      const identity=String(data.identity);const store=await cookies();
      if(identity==='guest')store.delete('rateduke-demo-user');else{const id=demoIdentities[identity as keyof typeof demoIdentities];if(!id)throw new Error('Invalid demo identity.');store.set('rateduke-demo-user',id,{httpOnly:true,sameSite:'strict',path:'/'});}
      revalidatePath('/','layout');return {ok:true,message:'Demo identity updated.'};
    }
    if(action==='demo_reset'){
      if(dataMode()!=='demo')throw new Error('Demo tools are unavailable.');
      await resetDemo((await cookies()).get('rateduke-demo-user')?.value||null,data.mode==='empty');revalidatePath('/','layout');return {ok:true,message:data.mode==='empty'?'Campus data cleared. Start by adding a school.':'Example data restored.'};
    }
    if(action==='magic_link'){
      if(dataMode()==='demo')throw new Error('Email delivery is unavailable in the local demo. Choose a demo identity below.');
      const email=String(data.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
      const domain=email.slice(email.lastIndexOf('@')+1);const snapshot=await getSnapshot();
      if(!snapshot.schools.some(s=>s.status==='active'&&s.email_domain.toLowerCase()===domain))throw new Error('Use an email address from a supported school.');
      const origin=process.env.NEXT_PUBLIC_SITE_URL;if(!origin)throw new Error('The login callback URL has not been configured.');
      let callback:string;try{callback=new URL('/auth/callback',origin).toString();}catch{throw new Error('The login callback URL is invalid.');}
      const {error}=await (await supabase()).auth.signInWithOtp({email,options:{emailRedirectTo:callback,shouldCreateUser:true}});
      if(error)return {ok:false,...signInFailure(error)};
      return {ok:true,message:'Check your inbox. Use the newest sign-in link within one hour.',retryAfterSeconds:60};
    }
    if(action==='verify_otp'){
      if(dataMode()==='demo')throw new Error('Email verification is unavailable in the local demo.');
      const email=String(data.email||'').trim().toLowerCase();const token=String(data.token||'').replace(/\s/g,'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter the email address that received the code.');
      if(!/^\d{6}$/.test(token))throw new Error('Enter the six-digit code from the newest email.');
      const {error}=await (await supabase()).auth.verifyOtp({email,token,type:'email'});
      if(error)return {ok:false,message:otpFailure(error)};
      revalidatePath('/','layout');return {ok:true,message:'Signed in successfully. Open your account to continue.'};
    }
    const message=await execute({action,data});revalidatePath('/','layout');return {ok:true,message};
  }catch(e){return {ok:false,message:e instanceof ZodError?e.issues.map(i=>`${i.path.join('.') || 'Input'}: ${i.message}`).join(' '):e instanceof Error?e.message:'Something went wrong. Please try again.'};}
}
export interface QuestionActionState {ok:boolean;message:string;question?:QuestionView}
export async function answerQuestionAction(questionId:string,optionId:string):Promise<QuestionActionState>{
  try{const question=await answerQuestion(questionId,optionId);return {ok:true,message:'Response saved.',question};}
  catch(e){return {ok:false,message:e instanceof Error?e.message:'Unable to save your response. Please try again.'};}
}
export async function signOut(){if(dataMode()==='demo')(await cookies()).delete('rateduke-demo-user');else await(await supabase()).auth.signOut();revalidatePath('/','layout');redirect('/');}
const forumActions=new Set(['forum_toggle_like','forum_comment','forum_delete_comment','forum_delete_post','moderate_forum_post','moderate_forum_comment','report']);
export async function forumAction(action:string,data:Record<string,unknown>):Promise<FormState>{try{if(!forumActions.has(action))throw new Error('Unsupported forum action.');const message=await execute({action,data});revalidatePath('/forum','layout');return {ok:true,message};}catch(error){return {ok:false,message:error instanceof ZodError?error.issues.map(issue=>issue.message).join(' '):error instanceof Error?error.message:'Unable to update the forum.'};}}
