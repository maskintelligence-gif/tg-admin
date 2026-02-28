import { createClient } from '@supabase/supabase-js';

// ✅ Anon key — safe to hardcode, designed to be public
// Security comes from Supabase Auth + RLS policies, not from hiding this key
export const supabase = createClient(
  'https://lpcpporrmoxgaxnxejol.supabase.co',
  'sb_publishable_4KkjQTEG-pKRaO95dwsgpA_eL1TBJPD',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'tg_admin_session',
    },
  }
);
