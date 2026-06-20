import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use only inside Edge Functions for privileged DB operations.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * User-scoped Supabase client — respects RLS, verifies caller identity.
 * Pass the raw Authorization header value (e.g. "Bearer eyJ...").
 */
export function userClient(authorizationHeader: string): SupabaseClient {
  const url     = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY not set');
  return createClient(url, anonKey, {
    global:  { headers: { Authorization: authorizationHeader } },
    auth:    { persistSession: false, autoRefreshToken: false },
  });
}
