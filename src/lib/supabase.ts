import { createClient } from '@supabase/supabase-js';

// These are injected by Vite at build time from environment variables.
// In local dev: create a .env.local file (see README).
// On GitHub Pages: set these as GitHub Secrets — they get passed to the
// build step in the Actions workflow and baked in at compile time.
//
// IMPORTANT: Only the ANON key goes here — never the service_role key.
// The anon key is safe to expose; RLS policies protect your data.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[TG Admin] Missing Supabase env vars.\n' +
    'Local dev: create src/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'GitHub Pages: add these as repository Secrets.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'tg_admin_session',
  },
});
