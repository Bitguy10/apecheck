'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Browser Supabase client (anon key only — safe to expose). */
export function getBrowserSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _client;
}
