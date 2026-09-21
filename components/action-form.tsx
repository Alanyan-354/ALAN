'use client';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { submitAction } from '@/app/actions';
import { Button } from './ui/button';
import { CheckCircle2, LoaderCircle, AlertCircle } from 'lucide-react';
export function ActionForm({action,base={},children,label='Save changes',className='',danger=false,confirm}:{action:string;base?:Record<string,unknown>;children?:ReactNode;label?:string;className?:string;danger?:boolean;confirm?:string}){
  const [state,formAction,pending]=useActionState(submitAction,{ok:false,message:''});
  const [cooldown,setCooldown]=useState(0);
  useEffect(()=>{if(state.retryAfterSeconds)setCooldown(state.retryAfterSeconds);},[state.retryAfterSeconds,state.message]);
  useEffect(()=>{if(cooldown<=0)return;const timer=window.setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearTimeout(timer);},[cooldown]);
  const cooling=action==='magic_link'&&cooldown>0;
  return <form action={formAction} className={`action-form ${className}`} onSubmit={event=>{if(confirm&&!window.confirm(confirm))event.preventDefault();}}>
    <input type="hidden" name="_action" value={action}/><input type="hidden" name="_base" value={JSON.stringify(base)}/>
    {children}<Button type="submit" variant={danger?'destructive':'default'} disabled={pending||cooling}>{pending?<><LoaderCircle size={16} className="spin"/>{action==='magic_link'?'Sending…':'Saving…'}</>:cooling?`Send another link in ${cooldown}s`:label}</Button>
    {state.message&&<p className={`form-message ${state.ok?'success':'failure'}`} role={state.ok?'status':'alert'}>{state.ok?<CheckCircle2 size={17}/>:<AlertCircle size={17}/>}<span>{state.message}</span></p>}
  </form>;
}
