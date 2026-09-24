import { Search, ArrowRight } from 'lucide-react';
import { Button } from './button';

/** Shared GET search: preserves server-rendered navigation and campus scope. */
export function SearchField({ school, defaultValue = '', label = 'Search campus ratings', placeholder = 'Search names, places, or locations', required = false }: { school?: string; defaultValue?: string; label?: string; placeholder?: string; required?: boolean }) {
  return <form action="/search" className="campus-search" role="search">
    <Search size={20} aria-hidden="true" />
    <label className="sr-only" htmlFor="campus-search">{label}</label>
    <input id="campus-search" type="search" name="q" defaultValue={defaultValue} placeholder={placeholder} required={required} />
    <input type="hidden" name="school" value={school || ''} />
    <Button type="submit">Search <ArrowRight size={16} aria-hidden="true" /></Button>
  </form>;
}
