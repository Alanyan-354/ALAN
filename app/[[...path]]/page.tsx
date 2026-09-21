import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSnapshot,searchEntityIds,getForumFeed,getForumPost,getForumComments } from '@/lib/repository';
import { dataMode } from '@/lib/config';
import { Shell } from '@/components/layout-shell';
import { Home,Browse,Empty } from '@/components/discovery';
import { EntityPage } from '@/components/entity-page';
import { AccountPage } from '@/components/account-page';
import { AdminPage } from '@/components/admin-page';
import { PulsePage } from '@/components/pulse-page';
import { SubmissionPage } from '@/components/submission-page';
import { ForumFeed } from '@/components/forum-feed';
import { ForumPostPage } from '@/components/forum-post-page';
import { ForumNewPage } from '@/components/forum-new-page';
import type { ForumSort } from '@/lib/types';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{path?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {path=[]}=await params;const raw=await searchParams;const query=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,Array.isArray(v)?v[0]:v]));
 let snapshot,mode;try{mode=dataMode();snapshot=await getSnapshot();}catch{return <div className="configuration-screen"><h1>Campus guide is not connected yet</h1><p>The server could not load campus data. Check the Supabase environment settings and database migrations, then try again.</p><p>No demo identities are available in production.</p><Link href="/">Try again</Link></div>;}
 let school=snapshot.schools.find(s=>s.slug===query.school&&s.status==='active')||(!query.school?snapshot.schools.find(s=>s.status==='active'):undefined);
 const entity=path[0]==='entity'?snapshot.entities.find(e=>e.slug===path[1]&&e.status==='active'):undefined;if(entity)school=snapshot.schools.find(s=>s.id===entity.school_id);
 let content;
 if(path.length===0)content=<Home snapshot={snapshot} school={school}/>;
 else if(['discover','search'].includes(path[0])&&path.length===1)content=<Browse snapshot={snapshot} school={school} query={query} ids={await searchEntityIds(query.q||'',school?.id||null)} searchMode={path[0]==='search'}/>;
 else if(path[0]==='category'&&path.length===2){if(!snapshot.categories.some(c=>c.slug===path[1]&&c.status==='active'&&(!c.school_id||c.school_id===school?.id)))notFound();content=<Browse snapshot={snapshot} school={school} query={query} categorySlug={path[1]} ids={await searchEntityIds(query.q||'',school?.id||null)}/>;}
 else if(path[0]==='entity'&&path.length===2){if(!entity)notFound();content=<EntityPage snapshot={snapshot} entity={entity} school={school} query={query}/>;}
 else if(path[0]==='pulse'&&path.length<=2){const pulseMode=path[1]==='student-stats'?'poll':path[1]===undefined||path[1]==='predictions'?'prediction':null;if(!pulseMode)notFound();content=<PulsePage snapshot={snapshot} school={school} mode={pulseMode} questionId={query.question}/>;}
 else if(path[0]==='forum'&&path.length===1){const sort:ForumSort=query.sort==='latest'?'latest':'hot';content=<ForumFeed snapshot={snapshot} school={school} sort={sort} page={school?await getForumFeed(school.id,sort,Number(query.page||1),20):{items:[],page:1,page_size:20,has_more:false}}/>;}
 else if(path[0]==='forum'&&path[1]==='new'&&path.length===2){if(!school)notFound();content=<ForumNewPage snapshot={snapshot} school={school}/>;}
 else if(path[0]==='forum'&&path[1]==='post'&&path.length===3){const post=await getForumPost(path[2]);if(!post)notFound();school=snapshot.schools.find(item=>item.id===post.school_id);if(!school)notFound();content=<ForumPostPage post={post} school={school} comments={await getForumComments(post.id,null,Number(query.comments||1),20)}/>;}
 else if(['login','profile'].includes(path[0])&&path.length===1)content=<AccountPage snapshot={snapshot} mode={mode} page={path[0]} query={query}/>;
 else if(path[0]==='submit'&&path.length===1)content=<SubmissionPage snapshot={snapshot} school={school} edit={query.edit}/>;
 else if(path[0]==='admin'&&path.length<=2)content=<AdminPage snapshot={snapshot} section={path[1]||'overview'} query={query}/>;
 else if(path[0]==='guidelines'&&path.length===1)content=<div className="page-container prose-page"><h1>A campus guide built on trust.</h1><p>Share your own experience. Be specific, fair and helpful.</p><h2>Keep the focus on campus resources</h2><p>Rate places and resources, never individual students or professors. Do not post names, email addresses, student IDs or other private information.</p><h2>Respect the people around you</h2><p>Harassment, threats, hate speech, explicit sexual or violent content, spam and targeted personal attacks are not allowed.</p><h2>One experience, one review</h2><p>Update your existing review when your experience changes. Do not create extra accounts or coordinate misleading ratings.</p><h2>Speak up when something is wrong</h2><p>Use Report on a place or review. Moderators can hide content and suspend accounts that violate these guidelines.</p><h2>Verified, with privacy</h2><p>Your school email is private. You can post as Anonymous Student; the platform and authorized moderators can still associate contributions with your account.</p></div>;
 else notFound();
 if(query.school&&!school&&path.length===0)content=<div className="page-container"><Empty title="Campus not found" body="This school may have been archived."><Link href="/">Choose another campus</Link></Empty></div>;
 return <Shell snapshot={snapshot} school={school?.slug} mode={mode}>{content}</Shell>;
}
