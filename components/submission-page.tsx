import Link from 'next/link';
import { Camera,ShieldCheck } from 'lucide-react';
import type { School,Snapshot } from '@/lib/types';
import { canContribute } from '@/lib/domain';
import { withSchool } from '@/lib/utils';
import { SubmissionForm } from './submission-form';
import { Empty } from './discovery';
import { Button } from './ui/button';

export function SubmissionPage({snapshot,school,edit}:{snapshot:Snapshot;school?:School;edit?:string}){
 const submission=edit?snapshot.own_submissions.find(item=>item.id===edit):undefined;
 if(!school)return <div className="page-container submit-page"><Empty title="Choose a campus first" body="Community submissions belong to a specific campus guide."><Button asChild><Link href="/discover">Open Discover</Link></Button></Empty></div>;
 if(edit&&!submission)return <div className="page-container submit-page"><Empty title="Submission unavailable" body="It may belong to another account or no longer be editable."><Button asChild><Link href="/profile">Back to your account</Link></Button></Empty></div>;
 if(submission&&submission.status!=='rejected')return <div className="page-container submit-page"><Empty title="This submission is not editable" body="Only submissions returned with feedback can be changed and resubmitted."><Button asChild><Link href="/profile">View submission status</Link></Button></Empty></div>;
 if(!canContribute(snapshot,snapshot.viewer,school.id))return <div className="page-container submit-page"><Empty title="Verify your school email to contribute" body={`Sign in with an active @${school.email_domain} account before submitting a campus find.`}><Button asChild><Link href={withSchool('/login',school.slug)}>Sign in</Link></Button></Empty></div>;
 return <div className="page-container submit-page"><div className="submit-intro"><span><Camera size={30}/></span><div><h1>{submission?'Make it ready for campus':'What have you noticed?'}</h1><p>Share one specific campus detail. Clear locations and honest photos make submissions easier to approve and more useful to other students.</p><div><ShieldCheck size={16}/>Reviewed before publication · identity stays private</div></div></div><SubmissionForm school={school} submission={submission}/></div>;
}
