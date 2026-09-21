import Link from 'next/link';
import { ArrowLeft,Images } from 'lucide-react';
import type { School,Snapshot } from '@/lib/types';
import { withSchool } from '@/lib/utils';
import { ForumComposer } from './forum-composer';
import { Empty } from './discovery';
import { Button } from './ui/button';
export function ForumNewPage({snapshot,school}:{snapshot:Snapshot;school:School}){const viewer=snapshot.viewer;const allowed=!!viewer&&viewer.verified&&!viewer.suspended&&viewer.email.toLowerCase().endsWith(`@${school.email_domain.toLowerCase()}`);if(!allowed)return <div className="page-container forum-new-empty"><Empty title={viewer?'Verify your campus email':'Sign in to create a post'} body={`Posting is available to active, verified ${school.name} accounts.`}><Button asChild><Link href={withSchool(viewer?'/profile':'/login',school.slug)}>{viewer?'Open account':'Sign in'}</Link></Button></Empty></div>;return <div className="page-container forum-new"><Link className="forum-back" href={withSchool('/forum',school.slug)}><ArrowLeft size={16}/>Back to forum</Link><header><span><Images size={26}/></span><div><h1>Create a campus post</h1><p>Lead with one useful observation and a clear set of photos. You can add up to nine.</p></div></header><ForumComposer schoolId={school.id} schoolSlug={school.slug}/></div>;}
