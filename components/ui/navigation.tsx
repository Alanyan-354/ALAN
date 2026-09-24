'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Compass, MessagesSquare, ShieldCheck, UserRound } from 'lucide-react';
import { withSchool } from '@/lib/utils';

export function Navigation({school, staff, signedIn, mobile = false}: {school?: string; staff: boolean; signedIn: boolean; mobile?: boolean}) {
  const pathname = usePathname();
  const items = [
    {href:'/forum', label:'Forum', icon:MessagesSquare, active:pathname.startsWith('/forum')},
    {href:'/discover', label:'Discover', icon:Compass, active:pathname === '/' || ['/discover','/search','/entity','/category','/submit'].some(prefix=>pathname.startsWith(prefix))},
    {href:'/pulse/predictions', label:'Campus Pulse', icon:Activity, active:pathname.startsWith('/pulse')},
    ...(mobile ? [{href:signedIn?'/profile':'/login', label:'Account', icon:UserRound, active:pathname==='/profile'||pathname==='/login'}] : []),
    ...(staff ? [{href:'/admin',label:'Admin',icon:ShieldCheck,active:pathname.startsWith('/admin')}] : []),
  ];
  return <nav className={mobile?'mobile-navigation':'desktop-nav'} aria-label={mobile?'Mobile navigation':'Main navigation'}>
    {items.map(({href,label,icon:Icon,active})=><Link key={href} href={withSchool(href,school)} aria-current={active?'page':undefined}><Icon size={18} aria-hidden="true"/><span>{label}</span></Link>)}
  </nav>;
}
