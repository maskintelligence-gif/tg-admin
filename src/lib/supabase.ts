import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpcpporrmoxgaxnxejol.supabase.co';

// ⚠️  SERVICE ROLE KEY — bypasses all RLS
// Get from: Supabase Dashboard → Project Settings → API → service_role
// KEEP THIS ON YOUR DEVICE ONLY — never share this key
const SERVICE_ROLE_KEY = 'sb_publishable_4KkjQTEG-pKRaO95dwsgpA_eL1TBJPD';

export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Admin PIN — change this to your own 4-6 digit PIN
export const ADMIN_PIN = '1234';
