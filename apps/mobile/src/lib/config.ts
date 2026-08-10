import Constants from 'expo-constants';

/**
 * Public runtime config. Only PUBLIC values live here — no secret API keys ever
 * ship in the mobile bundle. All third-party data calls go through the web API.
 *
 * Set these via EAS env / app config `extra`, or a local `.env` with EXPO_PUBLIC_*.
 */
function fromExtra(key: string): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  return extra[key];
}

export const config = {
  /** Base URL of the deployed ApeCheck web app (hosts the scan API). */
  apiUrl:
    process.env.EXPO_PUBLIC_API_URL ||
    fromExtra('apiUrl') ||
    'https://apecheck.vercel.app',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || fromExtra('supabaseUrl') || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fromExtra('supabaseAnonKey') || '',
  easProjectId: fromExtra('eas')?.['projectId' as any],
};
