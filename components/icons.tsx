import { BookOpen, Utensils, House, Sparkles, Building2, Compass, GraduationCap, type LucideProps } from 'lucide-react';
const icons:Record<string,React.ComponentType<LucideProps>>={book:BookOpen,utensils:Utensils,home:House,sparkles:Sparkles,building:Building2,compass:Compass,graduation:GraduationCap};
export function CategoryIcon({name,...props}:LucideProps&{name?:string}){const Icon=icons[name||'']||Compass;return <Icon strokeWidth={1.75} {...props}/>;}
