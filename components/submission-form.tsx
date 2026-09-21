'use client';
import { useState } from 'react';
import { Camera,Upload } from 'lucide-react';
import type { EntitySubmission,School } from '@/lib/types';
import { Button } from './ui/button';
import { ScoreSlider } from './score-slider';

export function SubmissionForm({school,submission}:{school:School;submission?:EntitySubmission}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{const body=new FormData(event.currentTarget);const response=await fetch(submission?`/api/submissions/${submission.id}`:'/api/submissions',{method:submission?'PUT':'POST',body});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'Unable to submit this campus find.');window.location.assign(`/profile?school=${encodeURIComponent(school.slug)}&submission=sent`);}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to submit this campus find.');setBusy(false);}
 }
 return <form className="submission-form white-panel" onSubmit={submit} encType="multipart/form-data">
  <input type="hidden" name="school_id" value={school.id}/>
  <div className="submission-form-heading"><span><Camera size={24}/></span><div><h2>{submission?'Improve your submission':'Share a campus find'}</h2><p>Help other students notice the useful, surprising, and overlooked parts of campus.</p></div></div>
  {submission?.rejection_reason&&<div className="submission-feedback" role="note"><strong>Admin feedback</strong><p>{submission.rejection_reason}</p></div>}
  <div className="form-grid">
   <label>Name<input name="name" defaultValue={submission?.name||''} minLength={2} maxLength={200} required placeholder="Third-floor drinking fountain"/></label>
   <label>Campus location<input name="location_name" defaultValue={submission?.location_name||''} minLength={2} maxLength={200} required placeholder="Wilson House, third floor"/></label>
   <label className="span-all">What should students know?<textarea name="description" defaultValue={submission?.description||''} minLength={10} maxLength={3000} rows={5} required placeholder="Describe what it is, where to find it, and why it matters."/></label>
   <ScoreSlider label="First rating" name="initial_overall_rating" defaultValue={submission?.initial_overall_rating} required/>
   <label>One photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required/><span className="field-help">JPEG, PNG, or WebP. Maximum 5 MB. A new photo is required when resubmitting.</span></label>
   <label className="span-all">Your note <span className="optional">Optional</span><textarea name="initial_review_body" defaultValue={submission?.initial_review_body||''} maxLength={3000} rows={3} placeholder="Add context to your score."/></label>
   <label className="checkbox-label span-all"><input name="is_anonymous" type="checkbox" defaultChecked={submission?.is_anonymous??true}/>Publish my first rating as Anonymous Student</label>
  </div>
  {message&&<p className="form-message failure" role="alert">{message}</p>}
  <Button type="submit" disabled={busy}>{busy?'Uploading and submitting…':submission?'Resubmit for review':'Send for review'}<Upload size={16}/></Button>
  <p className="privacy-note">Your submission stays private until an administrator approves it. Your school email is never displayed publicly.</p>
 </form>;
}
