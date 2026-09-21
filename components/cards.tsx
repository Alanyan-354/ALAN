import Link from 'next/link';
import { ArrowUpRight, MapPin, BadgeCheck, Flag } from 'lucide-react';
import { aggregate } from '@/lib/domain';
import type { Entity, PublicReview, Snapshot } from '@/lib/types';
import { dateLabel,scoreLabel,withSchool } from '@/lib/utils';
import { CategoryIcon } from './icons';
export function ScoreDisplay({value,size='compact',meter=true}:{value:number|null;size?:'compact'|'large';meter?:boolean}){return <span className={`score-display score-${size}`} aria-label={scoreLabel(value)}><span className="score-number">{value===null?'—':value.toFixed(1)}{value!==null&&<small>/10</small>}</span>{meter&&<span className="score-meter" aria-hidden="true">{Array.from({length:10},(_,index)=>{const fill=value===null?0:Math.max(0,Math.min(1,value-index));return <i key={index} style={{'--fill':`${fill*100}%`} as React.CSSProperties}/>;})}</span>}</span>;}
export function EntityCard({entity,snapshot,school}:{entity:Entity;snapshot:Snapshot;school?:string}){const category=snapshot.categories.find(c=>c.id===entity.category_id);const a=aggregate(snapshot,entity);return <Link className="entity-card" href={withSchool(`/entity/${entity.slug}`,school)}>
  <div className={`entity-art tone-${(category?.sort_order||0)%4}${entity.image_url?' has-photo':''}`}>{entity.image_url?<img src={entity.image_url} alt={`${entity.name} at ${entity.location_name||'campus'}`}/>:<><CategoryIcon name={category?.icon} size={38}/><span>{category?.name}</span></>}<span className="entity-category-chip">{category?.name}</span><ArrowUpRight size={20} className="card-arrow"/></div>
  <div className="entity-card-body"><div className="location"><MapPin size={13}/>{entity.location_name||'On campus'}</div><h3>{entity.name}</h3><p>{entity.short_description||entity.description}</p><div className="card-bottom"><ScoreDisplay value={a.average}/><span className="rating-count">{a.reviewCount} {a.reviewCount===1?'rating':'ratings'}</span><span className="card-detail">View ratings <ArrowUpRight size={15}/></span></div></div>
  </Link>;}
export function ReviewCard({review,snapshot,showEntity=false,school,report=true}:{review:PublicReview;snapshot:Snapshot;showEntity?:boolean;school?:string;report?:boolean}){const entity=snapshot.entities.find(e=>e.id===review.entity_id);return <article className="review-card"><div className="review-top"><span className="avatar">{review.public_identity==='Anonymous Student'?'S':review.public_identity.charAt(0)}</span><div><strong>{review.public_identity}</strong>{review.verified&&<span className="verified"><BadgeCheck size={13}/>Verified Student</span>}</div><time dateTime={review.created_at}>{dateLabel(review.created_at)}</time></div>
  {showEntity&&entity&&<Link className="review-entity" href={withSchool(`/entity/${entity.slug}`,school)}>{entity.name}<ArrowUpRight size={14}/></Link>}
  <div className="review-rating"><ScoreDisplay value={review.overall_rating}/>{review.status==='hidden'&&<span className="status-pill">Hidden</span>}</div>
  {review.body?<p className="review-body">{review.body}</p>:<p className="muted">Rating only</p>}
  <div className="dimension-chips">{review.values.map(v=>{const d=snapshot.dimensions.find(d=>d.id===v.rating_dimension_id);return d?<span key={d.id}>{d.label} <b>{v.score.toFixed(1)}/10</b>{!d.is_active?' · retired':''}</span>:null;})}</div>
  {report&&entity&&<Link className="report-link" href={withSchool(`/entity/${entity.slug}?report=${review.id}`,school)}><Flag size={13}/>Report</Link>}
  </article>;}
