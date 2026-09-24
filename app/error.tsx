'use client';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({reset}:{reset:()=>void}) {
  return <main className="configuration-screen" aria-labelledby="error-title">
    <span className="empty-icon"><WifiOff size={26} aria-hidden="true"/></span>
    <h1 id="error-title">Something interrupted your visit.</h1>
    <p>We couldn’t load this page. Please try again.</p>
    <Button onClick={reset}><RefreshCw size={16} aria-hidden="true"/>Try again</Button>
  </main>;
}
