import Link from 'next/link';
import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Sparkles } from 'lucide-react';
import type { QuestionType, QuestionView, School, Snapshot } from '@/lib/types';
import { withSchool } from '@/lib/utils';
import { Empty } from './discovery';
import { QuickChoiceCard } from './quick-choice-card';

export function PulsePage({snapshot,school,mode,questionId}:{snapshot:Snapshot;school?:School;mode:QuestionType;questionId?:string}){
  const questions=snapshot.questions.filter(q=>q.school_id===school?.id&&q.type===mode&&!['draft','archived'].includes(q.status)).sort((a,b)=>a.sort_order-b.sort_order||a.created_at.localeCompare(b.created_at));
  const active=questions.find(q=>q.id===questionId)||questions.find(q=>q.can_answer&&!q.current_user_option_id)||questions.find(q=>q.effective_status==='open')||questions[0];
  const activeIndex=active?questions.findIndex(q=>q.id===active.id):-1;const ordered=active?[...questions.slice(activeIndex+1),...questions.slice(0,activeIndex)]:[];
  const next=ordered.find(q=>q.can_answer&&!q.current_user_option_id)||ordered[0];
  const base=mode==='prediction'?'/pulse/predictions':'/pulse/student-stats';
  return <div className="page-container pulse-page"><header className="pulse-heading"><div><h1>Campus Pulse</h1><p>{mode==='prediction'?'What students think will happen next.':'A living snapshot of student preferences and campus life.'}</p></div>{school&&<span>{school.name}</span>}</header>
    <nav className="pulse-tabs" aria-label="Campus Pulse modes"><Link aria-current={mode==='prediction'?'page':undefined} className={mode==='prediction'?'active':''} href={withSchool('/pulse/predictions',school?.slug)}>Predictions</Link><Link aria-current={mode==='poll'?'page':undefined} className={mode==='poll'?'active':''} href={withSchool('/pulse/student-stats',school?.slug)}>Student Stats</Link></nav>
    {!school?<Empty title="Choose a campus to see its pulse" body="Select a campus from Discover, then return here."/>:!active?<Empty title={mode==='prediction'?'No predictions yet':'No Student Stats questions yet'} body="Campus staff can add the first question from the management workspace.">{snapshot.viewer?.role==='admin'&&<Link href="/admin/questions">Create a question</Link>}</Empty>:<>
      <section className="pulse-focus"><div className="pulse-intro"><span>{mode==='prediction'?<CalendarClock size={22}/>:<Sparkles size={22}/>}</span><div><h2>{mode==='prediction'?'Make your call':'One tap. A clearer campus picture.'}</h2><p>{active.can_answer?'Your first choice stays uninfluenced. Results appear as soon as you answer.':snapshot.viewer?'Browse the current campus response below.':'Sign in with a verified school email to take part.'}</p></div></div><QuickChoiceCard key={active.id} initialQuestion={active} nextHref={next?withSchool(`${base}?question=${next.id}`,school.slug):undefined}/></section>
      {mode==='prediction'?<ResolvedPredictions questions={questions} school={school}/>:<StatsDashboard questions={questions}/>} 
    </>}
  </div>;
}

function ResolvedPredictions({questions,school}:{questions:QuestionView[];school:School}){const resolved=questions.filter(q=>q.effective_status==='resolved').slice(0,6);return <section className="pulse-results-section"><div className="section-heading"><div><h2>Recently resolved</h2><p>See what campus expected and what actually happened.</p></div></div>{resolved.length?<div className="resolved-list">{resolved.map(q=>{const result=q.options.find(o=>o.id===q.resolved_option_id);return <Link key={q.id} href={withSchool(`/pulse/predictions?question=${q.id}`,school.slug)}><span><CheckCircle2 size={18}/>{q.category}</span><strong>{q.title}</strong><small>Result: {result?.label||'Pending'} · {q.response_count} responses</small><ArrowRight size={18}/></Link>})}</div>:<Empty title="Results will land here" body="Resolved predictions will stay available for everyone to review."/>}</section>}

function StatsDashboard({questions}:{questions:QuestionView[]}){
  const featured=questions.filter(q=>q.is_featured&&q.results_visible&&(q.effective_status==='closed'||!!q.current_user_option_id));
  return <section className="pulse-results-section"><div className="section-heading"><div><h2>Student Stats snapshot</h2><p>Aggregates from verified responses. Sample size is shown on every result.</p></div><BarChart3 size={22}/></div>{featured.length?<div className="stats-grid">{featured.map(q=>{const max=Math.max(...q.options.map(o=>o.response_count||0));const leaders=q.options.filter(o=>(o.response_count||0)===max);return <article key={q.id} className="stat-story"><span>{q.category}</span><strong>{q.response_count?`${leaders.map(o=>o.label).join(' + ')} · ${leaders[0]?.percentage||0}%`:'No responses yet'}</strong><p>{q.title}</p><small>{q.response_count} verified {q.response_count===1?'response':'responses'}{leaders.length>1&&q.response_count?' · Tie':''}</small></article>})}</div>:<Empty title="The snapshot is still forming" body="Featured, closed Student Stats questions will appear here once responses are available."/>}</section>;
}
