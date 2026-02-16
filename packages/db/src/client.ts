import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
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
