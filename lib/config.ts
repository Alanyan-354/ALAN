export const brand = { name: 'RATEDUKE', title: 'Rate everything on campus.', description: 'Discover what verified students actually think.' };
export function dataMode(): 'demo' | 'supabase' {
  const mode = process.env.DATA_MODE || 'supabase';
  if (mode !== 'demo' && mode !== 'supabase') throw new Error('Invalid DATA_MODE. Choose demo or supabase.');
  if (mode === 'demo' && process.env.NODE_ENV === 'production') throw new Error('Demo mode is disabled in production. Configure Supabase before starting the production server.');
  return mode;
}
