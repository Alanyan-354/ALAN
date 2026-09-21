import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function supabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Supabase is not configured. Add the project URL and publishable key to your environment.');
  const store=await cookies();
  return createServerClient(url,key,{
    auth:{experimental:{appendPkceFlowIdToRedirects:true}},
    cookies:{getAll(){return store.getAll();},setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options));}catch{/* Server Component: proxy refreshes cookies. */}}}
  });
}
