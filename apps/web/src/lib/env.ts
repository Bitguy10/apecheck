import type { ScanEngineConfig } from '@apecheck/core';

/** Read a required server env var, throwing a clear error if missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  solanaRpcUrl: () =>
    process.env.SOLANA_RPC_URL ||
    (process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com'),
  birdeyeApiKey: () => optional('BIRDEYE_API_KEY'),
  solanaTrackerApiKey: () => optional('SOLANA_TRACKER_API_KEY'),
  rugcheckJwt: () => optional('RUGCHECK_JWT'),
  cronSecret: () => optional('CRON_SECRET'),
  onesignalAppId: () => optional('ONESIGNAL_APP_ID'),
  onesignalRestKey: () => optional('ONESIGNAL_REST_API_KEY'),
  telegramBotToken: () => optional('TELEGRAM_BOT_TOKEN'),
  telegramWebhookSecret: () => optional('TELEGRAM_WEBHOOK_SECRET'),
  telegramBotUsername: () => optional('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME'),
  appUrl: () => {
    const explicit = process.env.NEXT_PUBLIC_APP_URL;
    if (explicit) return explicit;
    // On Vercel these are injected at runtime (not NEXT_PUBLIC_, so never inlined
    // to a stale build-time value). Prefer the stable production domain, then the
    // per-deployment URL — so bot links resolve to the live host even when
    // NEXT_PUBLIC_APP_URL wasn't set at build time (otherwise they'd read
    // "localhost:3000" in every Telegram message).
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (vercelHost) return `https://${vercelHost}`;
    return 'http://localhost:3000';
  },
};

/** Build the scan-engine config from server env. */
export function scanConfig(): ScanEngineConfig {
  return {
    rpcUrl: env.solanaRpcUrl(),
    birdeyeApiKey: env.birdeyeApiKey(),
    rugcheckJwt: env.rugcheckJwt(),
  };
}
