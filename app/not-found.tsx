import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <main className="configuration-screen" aria-labelledby="not-found-title">
    <span className="empty-icon"><Compass size={26} aria-hidden="true"/></span>
    <h1 id="not-found-title">This place isn’t on the map.</h1>
    <p>It may have moved or is no longer available.</p>
    <Button asChild><Link href="/"><ArrowLeft size={16} aria-hidden="true"/>Back to campus</Link></Button>
  </main>;
}
