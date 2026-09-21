'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import type { QuestionView } from '@/lib/types';
import { QuickChoiceCard } from './quick-choice-card';

const DAY=86400000;const allowed=['/','/discover','/search','/category/','/entity/'];
export function PulsePopup({questions}:{questions:QuestionView[]}){
  const pathname=usePathname();const eligible=questions.filter(q=>q.show_in_popup&&q.can_answer&&!q.current_user_option_id);const [index,setIndex]=useState(0);const [open,setOpen]=useState(false);const dialog=useRef<HTMLElement>(null);
  useEffect(()=>{if(!eligible.length||!allowed.some(prefix=>prefix==='/'?pathname===prefix:pathname.startsWith(prefix)))return;const now=Date.now();const last=Number(localStorage.getItem('rateduke-pulse-last')||0);const snooze=Number(localStorage.getItem('rateduke-pulse-snooze')||0);if(sessionStorage.getItem('rateduke-pulse-seen')||now-last<DAY||now<snooze)return;const timer=window.setTimeout(()=>{setOpen(true);localStorage.setItem('rateduke-pulse-last',String(Date.now()));sessionStorage.setItem('rateduke-pulse-seen','1');},10000);return()=>window.clearTimeout(timer);},[pathname,eligible.length]);
  useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('button')?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape')dismiss();if(event.key==='Tab'&&dialog.current){const focusable=[...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);previous?.focus();};},[open]);
  const dismiss=()=>{setOpen(false);localStorage.setItem('rateduke-pulse-snooze',String(Date.now()+7*DAY));};if(!open||!eligible[index])return null;
  return <div className="pulse-popup-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)dismiss()}}><aside ref={dialog} className="pulse-popup" role="dialog" aria-modal="true" aria-label="Quick campus question"><button className="popup-close" onClick={dismiss} aria-label="Dismiss quick question"><X size={19}/></button><p className="popup-note">A quick question from Campus Pulse</p><QuickChoiceCard key={eligible[index].id} initialQuestion={eligible[index]} compact onNext={index<eligible.length-1?()=>setIndex(i=>i+1):undefined}/></aside></div>;
}
