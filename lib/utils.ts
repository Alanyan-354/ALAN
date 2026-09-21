import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function dateLabel(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)); }
export function safeUrl(url: string) { try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } }
export function withSchool(path: string, school?: string) { return school ? `${path}${path.includes('?') ? '&' : '?'}school=${encodeURIComponent(school)}` : path; }
export function scoreOptions(){return Array.from({length:19},(_,index)=>1+index*.5);}
export function scoreLabel(value:number|null){return value===null?'Not rated':`${value.toFixed(1)} / 10`;}
