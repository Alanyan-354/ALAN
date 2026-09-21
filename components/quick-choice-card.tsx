'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowRight, CalendarClock, Check, LoaderCircle, Trophy } from 'lucide-react';
import { answerQuestionAction } from '@/app/actions';
import type { QuestionView } from '@/lib/types';
import { Button } from './ui/button';

export function QuickChoiceCard({initialQuestion,nextHref,compact=false,onNext}:{initialQuestion:QuestionView;nextHref?:string;compact?:boolean;onNext?:()=>void}){
  const [question,setQuestion]=useState(initialQuestion);const [pending,startTransition]=useTransition();const [message,setMessage]=useState('');
  const choose=(optionId:string)=>startTransition(async()=>{setMessage('');const result=await answerQuestionAction(question.id,optionId);if(result.ok&&result.question)setQuestion(result.question);else setMessage(result.message);});
  const reveal=question.results_visible;const isOpen=question.effective_status==='open';
  return <article className={`quick-choice ${compact?'quick-choice-compact':''}`} data-question-id={question.id}>
    <div className="quick-choice-top"><div><span className="pulse-type">{question.type==='prediction'?'Prediction':'Student Stats'}</span><span className="pulse-category">{question.category}</span></div><span className={`pulse-status status-${question.effective_status}`}>{question.effective_status.replace('_',' ')}</span></div>
    <h2>{question.title}</h2>
    <div className="question-meta"><span><strong>{question.response_count}</strong> {question.response_count===1?'response':'responses'}</span>{question.closes_at&&<span><CalendarClock size={15}/>Closes {new Date(question.closes_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}{question.event_at&&<span>Event {new Date(question.event_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}</div>
    <div className="choice-grid" aria-label="Answer options">{question.options.map((option,index)=>{
      const selected=question.current_user_option_id===option.id;const result=question.resolved_option_id===option.id;
      return <button key={option.id} type="button" className={`choice-option ${selected?'is-selected':''} ${result?'is-result':''}`} disabled={pending||!question.can_answer} onClick={()=>choose(option.id)} aria-pressed={selected}>
        <span className="choice-index">{String.fromCharCode(65+index)}</span><span className="choice-copy"><strong>{option.label}</strong>{reveal&&<span className="choice-track" aria-hidden="true"><i style={{width:`${option.percentage||0}%`}}/></span>}</span>
        {reveal?<span className="choice-result"><strong>{option.percentage}%</strong><small>{option.response_count} {option.response_count===1?'student':'students'}</small></span>:<ArrowRight className="choice-arrow" size={19}/>} 
        {(selected||result)&&<span className="choice-badges">{selected&&<small><Check size={13}/>Your choice</small>}{result&&<small><Trophy size={13}/>Result</small>}</span>}
      </button>})}</div>
    {pending&&<p className="choice-message" role="status"><LoaderCircle className="spin" size={16}/>Saving your choice…</p>}
    {message&&<p className="choice-message failure" role="alert">{message}</p>}
    <div className="choice-footer" aria-live="polite"><p>{reveal?`${question.response_count} verified ${question.response_count===1?'student has':'students have'} responded.`:isOpen?'Choose first to reveal the campus response.':'Results are not available yet.'}</p>{nextHref?<Button variant="outline" asChild><Link href={nextHref}>Next question <ArrowRight size={16}/></Link></Button>:onNext?<Button variant="outline" onClick={onNext}>Next question <ArrowRight size={16}/></Button>:null}</div>
  </article>;
}
