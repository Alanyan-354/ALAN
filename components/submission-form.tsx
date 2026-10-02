'use client';
import { useEffect,useState } from 'react';
import { Camera,ChevronLeft,ChevronRight,Star,Upload,X } from 'lucide-react';
import type { EntitySubmission,ManagedIdentity,School,Tag } from '@/lib/types';
import { Button } from './ui/button';
import { ScoreSlider } from './score-slider';

export function SubmissionForm({school,submission,tags,nickname,managedIdentities=[]}:{school:School;submission?:EntitySubmission;tags:Tag[];nickname:string;managedIdentities?:ManagedIdentity[]}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [files,setFiles]=useState<File[]>([]);const [previews,setPreviews]=useState<string[]>([]);
 useEffect(()=>{const next=files.map(file=>URL.createObjectURL(file));setPreviews(next);return()=>next.forEach(url=>URL.revokeObjectURL(url));},[files]);
 const move=(index:number,direction:-1|1)=>setFiles(current=>{const target=index+direction;if(target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;});
 const cover=(index:number)=>setFiles(current=>[current[index],...current.filter((_,itemIndex)=>itemIndex!==index)]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{if(files.length<1||files.length>5)throw new Error('Choose between one and five images.');const body=new FormData(event.currentTarget);body.delete('images');files.forEach(file=>body.append('images',file,file.name));const response=await fetch(submission?`/api/submissions/${submission.id}`:'/api/submissions',{method:submission?'PUT':'POST',body});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'Unable to publish this campus find.');window.location.assign(`/discover?school=${encodeURIComponent(school.slug)}&category=community&sort=latest`);}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to submit this campus find.');setBusy(false);}
 }
 return <form className="submission-form white-panel" onSubmit={submit} encType="multipart/form-data">
  <input type="hidden" name="school_id" value={school.id}/>
  <div className="submission-form-heading"><span><Camera size={24}/></span><div><h2>{submission?'Improve your submission':'Share a campus find'}</h2><p>Publishing as <strong>{nickname}</strong>. Your listing and first rating go live after the images finish uploading.</p></div></div>
  {submission?.rejection_reason&&<div className="submission-feedback" role="note"><strong>Admin feedback</strong><p>{submission.rejection_reason}</p></div>}
  <div className="form-grid">
   <label>Name<input name="name" defaultValue={submission?.name||''} minLength={2} maxLength={200} required placeholder="Third-floor drinking fountain"/></label>
   <label>Campus location<input name="location_name" defaultValue={submission?.location_name||''} minLength={2} maxLength={200} required placeholder="Wilson House, third floor"/></label>
   <label className="span-all">What should students know?<textarea name="description" defaultValue={submission?.description||''} minLength={10} maxLength={3000} rows={5} required placeholder="Describe what it is, where to find it, and why it matters."/></label>
   <label>Official tag<select name="primary_tag_id" defaultValue={submission?.primary_tag_id||''} required><option value="" disabled>Choose one official tag</option>{tags.filter(tag=>tag.kind==='official'&&tag.status==='active').map(tag=><option key={tag.id} value={tag.id}>#{tag.slug} — {tag.description}</option>)}</select></label>
   <fieldset className="span-all community-custom-tags"><legend>Custom tags <span className="optional">Optional · up to 5</span></legend><div>{[0,1,2,3,4].map(index=><input key={index} name="custom_tags" defaultValue={tags.find(tag=>tag.id===submission?.custom_tag_ids?.[index])?.slug||''} maxLength={30} placeholder={index===0?'quiet-study':''}/>)}</div><span className="field-help">Use short tags. Spaces are converted to hyphens and duplicates are merged.</span></fieldset>
   <ScoreSlider label="First rating" name="initial_overall_rating" defaultValue={submission?.initial_overall_rating} required/>
   <label className="span-all">Photos<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required={files.length===0} onChange={event=>{const next=Array.from(event.currentTarget.files||[]);if(next.length>5){setMessage('Choose no more than five images.');setFiles(next.slice(0,5));}else{setMessage('');setFiles(next);}}}/><span className="field-help">Choose 1–5 JPEG, PNG, or WebP images, up to 5 MB each. Reorder them below; the first image is the cover.</span></label>
   {files.length>0&&<div className="span-all community-image-order" aria-label="Photo order">{files.map((file,index)=><figure key={`${file.name}-${file.lastModified}-${index}`}><img src={previews[index]} alt={`Preview ${index+1}`}/><figcaption><strong>{index===0?'Cover':`Photo ${index+1}`}</strong><span>{file.name}</span></figcaption><div><button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label={`Move ${file.name} earlier`}><ChevronLeft size={15}/></button>{index>0&&<button type="button" onClick={()=>cover(index)} aria-label={`Make ${file.name} the cover`}><Star size={15}/></button>}<button type="button" onClick={()=>move(index,1)} disabled={index===files.length-1} aria-label={`Move ${file.name} later`}><ChevronRight size={15}/></button><button type="button" onClick={()=>setFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))} aria-label={`Remove ${file.name}`}><X size={15}/></button></div></figure>)}</div>}
   <label className="span-all">Your note <span className="optional">Optional</span><textarea name="initial_review_body" defaultValue={submission?.initial_review_body||''} maxLength={3000} rows={3} placeholder="Add context to your score."/></label>
   {managedIdentities.length>0&&<label>Publish for contributor <select name="managed_identity_id" defaultValue=""><option value="">My administrator nickname</option>{managedIdentities.map(identity=><option key={identity.id} value={identity.id}>{identity.name}</option>)}</select></label>}
  </div>
  {message&&<p className="form-message failure" role="alert">{message}</p>}
  <Button type="submit" disabled={busy}>{busy?'Uploading and publishing…':submission?'Publish update':'Publish now'}<Upload size={16}/></Button>
  <p className="privacy-note">Your school email is never displayed publicly. Community listings, ratings and comments always show a nickname.</p>
 </form>;
}
