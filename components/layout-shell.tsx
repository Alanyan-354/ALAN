import Link from 'next/link';
import { ArrowUpRight, GraduationCap, ShieldCheck, LogOut } from 'lucide-react';
import type { Snapshot } from '@/lib/types';
import { brand } from '@/lib/config';
import { withSchool } from '@/lib/utils';
import { Button } from './ui/button';
import { signOut } from '@/app/actions';
import { Navigation } from './ui/navigation';
import { PulsePopup } from './pulse-popup';
export function Shell({snapshot,school,mode: _mode,children}:{snapshot:Snapshot;school?:string;mode:string;children:React.ReactNode}){
 const viewer=snapshot.viewer;const admin=!!viewer&&viewer.role==='admin'&&!viewer.suspended;const schoolId=snapshot.schools.find(s=>s.slug===school)?.id;return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><div className="header-inner"><Link href={withSchool('/',school)} className="brand"><span className="brand-icon"><GraduationCap size={24}/></span>{brand.name}<span className="beta">BETA</span></Link><Navigation school={school} staff={admin} signedIn={!!viewer}/><div className="header-actions">{viewer?<><Link className="profile-link" href={withSchool('/profile',school)}><span className="avatar small">{viewer.nickname.charAt(0)}</span><span>Account</span></Link><form action={signOut}><Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out"><LogOut size={18}/></Button></form></>:<Button asChild><Link href={withSchool('/login',school)}>Sign in <ArrowUpRight size={16}/></Link></Button>}</div></div></header>
 <Navigation mobile school={school} staff={admin} signedIn={!!viewer}/><main id="main">{children}</main><PulsePopup questions={snapshot.questions.filter(q=>q.school_id===schoolId)}/><footer className="site-footer"><div><Link className="footer-brand" href="/">{brand.name}</Link><span>Rate everything on campus. Discover what students think.</span></div><div><ShieldCheck size={16}/>Verified students. Honest perspectives.<Link href="/guidelines">Community guidelines</Link></div></footer>

 </>;
}
