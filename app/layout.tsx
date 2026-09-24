import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import './globals.css';
import './forum.css';
import './design-system.css';
import { brand } from '@/lib/config';
export const metadata:Metadata={title:{default:`${brand.name} — Discover campus ratings`,template:`%s | ${brand.name}`},description:'Rate everything on campus and discover what verified students actually think.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;}
