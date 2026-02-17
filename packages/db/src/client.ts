import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Persist singleton across HMR in dev mode to prevent connection leaks
const globalForSupabase = globalThis as unknown as { _supabaseAdmin?: SupabaseClient };

export function getSupabaseAdmin(): SupabaseClient {
  if (!globalForSupabase._supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    globalForSupabase._supabaseAdmin = createClient(url, key);
  }
  return globalForSupabase._supabaseAdmin;
}

export function getSupabaseClient(supabaseAccessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, anonKey, {
    global: {
      headers: supabaseAccessToken
        ? { Authorization: `Bearer ${supabaseAccessToken}` }
        : {},
    },
  });
}
