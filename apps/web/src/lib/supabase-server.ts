import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from './env';

/**
 * Server-side Supabase client bound to the request's auth cookie.
 * Use in API routes / server components to act AS the logged-in user (RLS applies).
 */
export function getServerSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // set() from a Server Component is a no-op; middleware handles refresh.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          /* no-op */
        }
      },
    },
  });
}

/**
 * Service-role client — BYPASSES RLS. Server-only. Used for:
 *  - the global `scans` cache (writes)
 *  - the cron dump-detector (reads all watchlists, inserts alerts)
 * NEVER expose this key or client to the browser.
 */
let _admin: SupabaseClient | null = null;
export function getAdminSupabase(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** Get the authenticated user id, or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
