'use client';
import { useState } from 'react';
import { Share2,Check } from 'lucide-react';
import { Button } from './ui/button';
export function ShareButton(){const [message,setMessage]=useState('');return <><Button variant="outline" onClick={async()=>{try{const url=new URL(window.location.href);url.searchParams.delete('report');url.searchParams.delete('page');url.hash='';await navigator.clipboard.writeText(url.href);setMessage('Link copied');}catch{setMessage('Copy the address from your browser to share.');}}}>{message==='Link copied'?<Check size={17}/>:<Share2 size={17}/>}Share</Button>{message&&<span className="share-message" role="status">{message}</span>}</>;}
