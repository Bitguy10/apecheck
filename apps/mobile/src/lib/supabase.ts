import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

/**
 * Supabase client for mobile. Session persists in AsyncStorage and auto-refreshes.
 * User-scoped data (watchlist, alerts, push tokens) is read/written directly here
 * under RLS — the anon key is safe to ship; RLS enforces per-user access.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
