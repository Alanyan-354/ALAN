'use client';
import { createContext,useContext,useEffect,useOptimistic,useRef,useState,useTransition } from 'react';
import { CornerUpRight,Flag,Heart,LoaderCircle,MessageCircle,Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { forumAction } from '@/app/actions';
import type { ForumCommentNode,ForumPage } from '@/lib/types';
import { relativeTime } from '@/lib/relative-time';

const SignedInContext=createContext(false);
export function ForumAuthBoundary({signedIn,children}:{signedIn:boolean;children:React.ReactNode}) {
  return <SignedInContext.Provider value={signedIn}>{children}</SignedInContext.Provider>;
}
function AccessPrompt() {
  const signedIn=useContext(SignedInContext);
  return <p className="forum-action-note" role="status">{signedIn
    ?<>Your account needs an active, verified membership at this school to like or comment. <a href="/profile">View account</a></>
    :<>Please sign in before liking or commenting. <a href="/login">Sign in</a></>}</p>;
}
export function ForumLike({postId,count,liked,canInteract}:{postId:string;count:number;liked:boolean;canInteract:boolean}){const [state,setOptimistic]=useOptimistic({liked,count},current=>({liked:!current.liked,count:current.count+(current.liked?-1:1)}));const [pending,start]=useTransition();const [message,setMessage]=useState('');const toggle=()=>{if(!canInteract){setMessage('access');return;}start(async()=>{setMessage('');setOptimistic(null);const result=await forumAction('forum_toggle_like',{id:postId});if(!result.ok)setMessage(result.message);});};return <div><button className={`forum-like ${state.liked?'active':''}`} type="button" disabled={pending} onClick={toggle}><Heart size={19} fill={state.liked?'currentColor':'none'}/>{state.liked?'Liked':'Like'} <span>{state.count}</span></button>{!canInteract&&<AccessPrompt/>}{message&&message!=='access'&&<p className="forum-inline-error" role="alert">{message}</p>}</div>;}
function ReportControl({type,id,canInteract}:{type:'forum_post'|'forum_comment';id:string;canInteract:boolean}){const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[pending,start]=useTransition();if(!canInteract)return null;return <div className="forum-report"><button type="button" onClick={()=>setOpen(value=>!value)}><Flag size={14}/>Report</button>{open&&<form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);start(async()=>{const result=await forumAction('report',{target_type:type,target_id:id,reason:String(data.get('reason')),details:String(data.get('details')||'')});setMessage(result.message);if(result.ok)setOpen(false);});}}><label>Reason<select name="reason" defaultValue="Spam"><option>Harassment</option><option>Privacy violation</option><option>Hate or threats</option><option>Spam</option><option>Inaccurate information</option><option>Other</option></select></label><label>Details<textarea name="details" maxLength={2000} rows={3}/></label><button className="button button-secondary" disabled={pending}>{pending?'Sending…':'Send report'}</button></form>}{message&&<p className={message.includes('sent')?'forum-success':'forum-inline-error'}>{message}</p>}</div>;}
function CommentComposer({postId,parentId,replyToId,replyToName,onDone,compact=false}:{postId:string;parentId:string|null;replyToId:string|null;replyToName?:string|null;onDone?:()=>void;compact?:boolean}){const [pending,start]=useTransition(),[message,setMessage]=useState('');const input=useRef<HTMLTextAreaElement>(null);useEffect(()=>{if(compact)input.current?.focus();},[compact]);return <form className={`forum-comment-form ${compact?'compact':''}`} onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const body=String(new FormData(form).get('body')||'');start(async()=>{const result=await forumAction('forum_comment',{post_id:postId,parent_comment_id:parentId,reply_to_comment_id:replyToId,body});setMessage(result.ok?'':result.message);if(result.ok){form.reset();onDone?.();}});}}><label><span className="sr-only">{parentId?'Write a reply':'Write a comment'}</span><textarea ref={input} name="body" minLength={1} maxLength={1500} rows={compact?2:3} required placeholder={parentId?'Write a helpful reply…':'Add to the conversation…'}/></label>{replyToName&&<span className="forum-reply-context"><CornerUpRight size={14}/>Replying to <strong>{replyToName}</strong></span>}<button className="button button-primary" disabled={pending}>{pending?<LoaderCircle className="spin" size={16}/>:<MessageCircle size={16}/>} {parentId?'Reply':'Comment'}</button>{message&&<p className="forum-inline-error" role="alert">{message}</p>}</form>;}

function CommentTime({date}:{date:string}) {
  // The first render is identical on server and client; then keep elapsed time current.
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),60000);return ()=>clearInterval(timer);},[]);
  return <time dateTime={date} title={date}>{now===null?'…':relativeTime(date,now)}</time>;
}
function CommentHeart({node,canInteract}:{node:ForumCommentNode;canInteract:boolean}) {
  const [saved,setSaved]=useState({liked:node.liked_by_viewer,count:node.like_count});
  const [state,toggle]=useOptimistic(saved,current=>({liked:!current.liked,count:current.count+(current.liked?-1:1)}));
  const [pending,start]=useTransition(),[error,setError]=useState('');
  useEffect(()=>setSaved({liked:node.liked_by_viewer,count:node.like_count}),[node.liked_by_viewer,node.like_count]);
  return <div className="forum-comment-heart-wrap">
    <button type="button" className={`forum-comment-heart ${state.liked?'active':''}`}
      aria-label={`${state.liked?'Unlike':'Like'} comment by ${node.author_name}`} aria-pressed={state.liked}
      title={canInteract?'Like this comment':'Sign in with a verified school email to like comments'}
      disabled={pending} onClick={()=>{if(!canInteract){setError('access');return;}start(async()=>{
        setError('');toggle(null);
        try {
          const result=await forumAction('forum_toggle_comment_like',{id:node.id});
          if(!result.ok){setError(result.message);return;}
          setSaved(JSON.parse(result.message) as {liked:boolean;count:number});
        } catch {setError('Unable to update your like. Please try again.');}
      });}}>
      <Heart size={19} fill={state.liked?'currentColor':'none'}/><span>{state.count}</span>
    </button>
    {error==='access'?<AccessPrompt/>:error&&<p className="forum-inline-error" role="alert">{error}</p>}
  </div>;
}
function CommentContent({node,rootId,rootAuthor,canInteract,onReplyAdded}:{node:ForumCommentNode;rootId:string;rootAuthor?:string;canInteract:boolean;onReplyAdded:()=>void}) {
  const [replying,setReplying]=useState(false),[status,setStatus]=useState(node.status),[body,setBody]=useState(node.body);
  const [error,setError]=useState(''),[deleting,startDelete]=useTransition();
  useEffect(()=>{setStatus(node.status);setBody(node.body);},[node.status,node.body]);
  return <div className="forum-comment-main">
    <div className="forum-comment-row">
      <div className="forum-comment-content">
        <header><span className="avatar small">{node.author_name.charAt(0)}</span><strong>{node.author_name}</strong></header>
        {rootAuthor&&<p className="forum-replying"><CornerUpRight size={13}/>Replying to <strong>{node.replying_to||rootAuthor}</strong></p>}
        <p className={status!=='published'?'forum-tombstone':''}>{body}</p>
        <div className="forum-comment-actions">
          <CommentTime date={node.created_at}/>
          {status==='published'&&(canInteract
            ?<button type="button" aria-expanded={replying} onClick={()=>setReplying(value=>!value)}>{replying?'Cancel':'Reply'}</button>
            :<button type="button" className="forum-quick-reply" onClick={()=>setError('access')}>Reply</button>)}
          {node.can_delete&&status!=='deleted'&&<button type="button" disabled={deleting} onClick={()=>startDelete(async()=>{
            setError('');
            try{const result=await forumAction('forum_delete_comment',{id:node.id});if(result.ok){setStatus('deleted');setBody('This comment was deleted by its author.');setReplying(false);}else setError(result.message);}
            catch{setError('Unable to delete your comment. Please try again.');}
          })}><Trash2 size={14}/>Delete</button>}
          <ReportControl type="forum_comment" id={node.id} canInteract={canInteract&&status==='published'}/>
        </div>
      </div>
      {status==='published'&&<CommentHeart node={node} canInteract={canInteract}/>}
    </div>
    {error==='access'?<AccessPrompt/>:error&&<p className="forum-inline-error" role="alert">{error}</p>}
    {canInteract&&replying&&status==='published'&&<CommentComposer postId={node.post_id} parentId={rootId} replyToId={node.id} replyToName={node.author_name} compact onDone={()=>{setReplying(false);onReplyAdded();}}/>}
  </div>;
}
function Comment({node,canInteract}:{node:ForumCommentNode;canInteract:boolean}) {
  const [replies,setReplies]=useState<ForumCommentNode[]>(node.replies||[]),[loaded,setLoaded]=useState(!!node.replies);
  const [expanded,setExpanded]=useState(false),[loading,setLoading]=useState(false),[more,setMore]=useState(node.reply_count>(node.replies?.length||0)),[page,setPage]=useState(1),[error,setError]=useState('');
  const load=async(reset=false)=>{
    setLoading(true);setError('');const next=reset?1:page;
    try{
      const response=await fetch(`/api/forum/comments?post=${node.post_id}&parent=${node.id}&page=${next}&limit=10`);
      if(!response.ok)throw new Error('Unable to load replies.');
      const result=await response.json() as ForumPage<ForumCommentNode>;
      if(!Array.isArray(result.items))throw new Error('Unable to load replies.');
      setReplies(current=>reset?result.items:[...current,...result.items.filter(item=>!current.some(existing=>existing.id===item.id))]);
      setMore(result.has_more);setPage(next+1);setLoaded(true);
    }catch{setError('Unable to load replies. Please try again.');}
    finally{setLoading(false);}
  };
  const onReplyAdded=()=>{setExpanded(true);void load(true);};
  return <article className="forum-comment">
    <CommentContent node={node} rootId={node.id} canInteract={canInteract} onReplyAdded={onReplyAdded}/>
    {(node.reply_count>0||replies.length>0)&&<button className="forum-replies-toggle" type="button" aria-expanded={expanded} disabled={loading} onClick={()=>{
      setExpanded(!expanded);if(!expanded&&!loaded)void load(true);
    }}>{loading?'Loading…':expanded?'Hide replies':`View all ${node.reply_count} ${node.reply_count===1?'reply':'replies'}`}</button>}
    {expanded&&<div className="forum-replies">
      {replies.map(reply=><article className="forum-comment forum-comment-reply" key={reply.id}>
        <CommentContent node={reply} rootId={node.id} rootAuthor={node.author_name} canInteract={canInteract} onReplyAdded={onReplyAdded}/>
      </article>)}
      {error?<p className="forum-inline-error" role="alert">{error} <button type="button" onClick={()=>void load(!loaded)} disabled={loading}>Retry</button></p>
        :more&&<button className="forum-load-more" type="button" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Load more replies'}</button>}
    </div>}
  </article>;
}
export function ForumConversation({postId,initial,canInteract}:{postId:string;initial:ForumPage<ForumCommentNode>;canInteract:boolean}){const router=useRouter();return <section className="forum-conversation"><div className="forum-conversation-heading"><h2>Conversation</h2><span>{initial.items.reduce((count,item)=>count+1+item.reply_count,0)}+ comments</span></div>{canInteract?<CommentComposer postId={postId} parentId={null} replyToId={null} onDone={()=>router.refresh()}/>:<div className="forum-locked"><AccessPrompt/></div>}<div className="forum-comment-list">{initial.items.map(node=><Comment key={node.id} node={node} canInteract={canInteract}/>)}</div>{initial.has_more&&<a className="button button-secondary" href={`?comments=${initial.page+1}#conversation`}>Load more conversations</a>}</section>;}
export function ForumPostTools({postId,canInteract,canDelete}:{postId:string;canInteract:boolean;canDelete:boolean}){const router=useRouter();return <div className="forum-post-tools"><ReportControl type="forum_post" id={postId} canInteract={canInteract}/>{canDelete&&<button type="button" onClick={()=>void forumAction('forum_delete_post',{id:postId}).then(result=>{if(result.ok)router.push('/forum');})}><Trash2 size={14}/>Delete post</button>}</div>;}
