import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,demoIdentities,upgradeDemo} from '../supabase/seed/demo';
import {applyCommand} from '../lib/domain';
import {getForumCommentsFromDb} from '../lib/forum-domain';
import {relativeTime} from '../lib/relative-time';

test('relative comment timestamps use minutes, hours and days, including boundaries',()=>{
 const now=Date.parse('2026-10-15T12:00:00Z');
 const ago=(seconds:number)=>relativeTime(new Date(now-seconds*1000).toISOString(),now);
 assert.equal(ago(0),'just now');assert.equal(ago(-60),'just now');assert.equal(ago(59),'just now');
 assert.equal(ago(60),'1m ago');assert.equal(ago(3599),'59m ago');assert.equal(ago(3600),'1h ago');
 assert.equal(ago(86400),'1d ago');assert.equal(ago(259200),'3d ago');assert.equal(relativeTime('bad',now),'Unknown time');
});
test('root and reply likes persist, toggle, and expose only counts and viewer state',()=>{
 const db=createSeed(),viewer=db.accounts.find(a=>a.id===demoIdentities.duke)!;
 const root=db.forum_comments.find(c=>c.parent_comment_id===null)!;
 const reply=db.forum_comments.find(c=>c.parent_comment_id===root.id)!;
 for(const comment of [root,reply]){
   const toggle=()=>JSON.parse(applyCommand(db,viewer,{action:'forum_toggle_comment_like',data:{id:comment.id}}));
   assert.deepEqual(toggle(),{liked:true,count:1});
   const page=getForumCommentsFromDb(db,viewer,comment.post_id,comment.parent_comment_id);
   const node=page.items.find(item=>item.id===comment.id)!;
   assert.equal(node.like_count,1);assert.equal(node.liked_by_viewer,true);
   assert(!JSON.stringify(page).includes(viewer.id));assert(!JSON.stringify(page).includes(viewer.email));
   assert.equal(getForumCommentsFromDb(db,null,comment.post_id,comment.parent_comment_id).items.find(c=>c.id===comment.id)?.liked_by_viewer,false);
   assert.deepEqual(toggle(),{liked:false,count:0});
 }
 const legacy={...db};delete (legacy as Partial<typeof db>).forum_comment_likes;
 assert.deepEqual(upgradeDemo(legacy).forum_comment_likes,[]);
});
test('comment likes reject guests, other schools, inactive accounts and unavailable content',()=>{
 const db=createSeed(),viewer=db.accounts.find(a=>a.id===demoIdentities.duke)!,comment=db.forum_comments[0];
 const command={action:'forum_toggle_comment_like',data:{id:comment.id}};
 assert.throws(()=>applyCommand(db,null,command));
 assert.throws(()=>applyCommand(db,db.accounts.find(a=>a.id===demoIdentities.outsider)!,command),/verified email/);
 assert.throws(()=>applyCommand(db,{...viewer,verified:false},command),/verified email/);
 assert.throws(()=>applyCommand(db,{...viewer,suspended:true},command));
 for(const status of ['hidden','deleted'] as const){comment.status=status;assert.throws(()=>applyCommand(db,viewer,command),/Comment not found/);}
 comment.status='published';db.forum_posts.find(p=>p.id===comment.post_id)!.status='hidden';
 assert.throws(()=>applyCommand(db,viewer,command),/Comment not found/);assert.equal(db.forum_comment_likes.length,0);
});
