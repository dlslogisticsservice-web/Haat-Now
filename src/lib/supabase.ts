import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') || '';

export const MISSING_SUPABASE_VARS: string[] = [
  ...(!supabaseUrl ? ['VITE_SUPABASE_URL'] : []),
  ...(!supabaseAnonKey ? ['VITE_SUPABASE_ANON_KEY'] : []),
];

// Sandbox/demo runs 100% client-side. We must NEVER hit the network here — otherwise every
// query is denied (403/401) and realtime websockets fail, since no demo row/session exists in
// the live project. This recursive no-op stub makes any Supabase call resolve to empty data and
// any channel a no-op: zero HTTP, zero websockets, zero backend errors. Per-service sandbox
// branches still serve real localStorage data; this is the platform-wide safety net for any
// ungated path. The real client (and RLS) are used only outside sandbox.
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

function makeSandboxClient(): SupabaseClient {
  const RESOLVED = { data: [], error: null, count: 0, status: 200, statusText: 'OK' };
  // One recursive Proxy: callable, awaitable, and every property IS the same stub — so any
  // chain works (supabase.from(...).select()..., supabase.auth.onAuthStateChange(cb).data.subscription,
  // supabase.channel(...).on(...).subscribe()) with no network and no throws.
  const stub: any = new Proxy(function () {} as any, {
    get(_t, prop) {
      if (prop === 'then') return (onF: any, onR?: any) => Promise.resolve(RESOLVED).then(onF, onR);
      if (prop === 'catch') return (onR: any) => Promise.resolve(RESOLVED).catch(onR);
      if (prop === 'finally') return (cb: any) => Promise.resolve(RESOLVED).finally(cb);
      if (typeof prop === 'symbol') return undefined;   // avoid iterator/toPrimitive loops
      return stub;                                       // builders, .auth, .data, .subscription, …
    },
    apply() { return stub; },                            // from()/rpc()/channel()/on()/subscribe()/unsubscribe()
  });
  return stub as SupabaseClient;
}

export const supabase: SupabaseClient = SANDBOX
  ? makeSandboxClient()
  : MISSING_SUPABASE_VARS.length === 0
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (null as unknown as SupabaseClient);
