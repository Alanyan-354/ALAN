import { Compass } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({title,body,children}:{title:string;body?:string;children?:ReactNode}) {
  return <div className="empty"><span className="empty-icon"><Compass size={26} aria-hidden="true"/></span><h3>{title}</h3>{body&&<p>{body}</p>}{children}</div>;
}
