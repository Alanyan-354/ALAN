import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const email=process.argv[2];
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
  console.error('Usage: npm run bootstrap-admin -- verified-admin@your-school.edu');process.exit(1);
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key){console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in your local environment. Never put the secret in a NEXT_PUBLIC variable.');process.exit(1);}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {error}=await client.rpc('bootstrap_admin',{p_email:email});
if(error){console.error(`Administrator initialization failed: ${error.message}`);process.exit(1);}
console.log('The verified account is now the first administrator. Remove SUPABASE_SECRET_KEY from your local environment after setup.');
