/**
 * ApeCheck — standalone watchlist alert watcher.
 *
 * PORTABLE alternative to the Vercel Cron route
 * (apps/web/src/app/api/internal/check-dumps → runAlertCheck). The logic here
 * mirrors apps/web/src/lib/alert-engine.ts, but depends ONLY on the shared
 * workspace packages (@apecheck/api-clients, @apecheck/core) + supabase-js, so
 * it can run anywhere Node runs: GitHub Actions, Railway, a Raspberry Pi, or a
 * plain unix crontab. Server-only — it uses the Supabase SERVICE ROLE key.
 *
 * Detects: dev-wallet dump (on-chain) + LP pull / authority re-enable /
 * price drop / whale sell (pure detectAlerts against a watch-time baseline).
 * Delivers via Expo/OneSignal push + Telegram.
 *
 * Run once (default; ideal for scheduled cron / CI):
 *   tsx cron/dev-wallet-watch.ts
 * Run as a resident loop:
 *   tsx cron/dev-wallet-watch.ts --watch        (or set WATCH_INTERVAL_MS)
 *
 * Required env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL),
 *   SUPABASE_SERVICE_ROLE_KEY, and one of SOLANA_RPC_URL / HELIUS_API_KEY.
 * Optional: BIRDEYE_API_KEY, RUGCHECK_JWT (scan enrichment),
 *   ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY (web push),
 *   TELEGRAM_BOT_TOKEN (Telegram delivery).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSolanaRpc } from '@apecheck/api-clients';
import {
  runScan,
  detectAlerts,
  snapshotBaseline,
  DEV_DUMP_THRESHOLD_PERCENT,
  SCAN_CACHE_TTL_SECONDS,
  shortenAddress,
  type ScanEngineConfig,
  type ScanCache,
  type ScanResult,
  type WatchBaseline,
  type DetectedAlert,
} from '@apecheck/core';

// ── Env ──────────────────────────────────────────────────────
function required(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing required env var (one of): ${names.join(', ')}`);
}

const SUPABASE_URL = required('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com');
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const SCAN_CONFIG: ScanEngineConfig = {
  rpcUrl: RPC_URL,
  birdeyeApiKey: process.env.BIRDEYE_API_KEY || undefined,
  rugcheckJwt: process.env.RUGCHECK_JWT || undefined,
};

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rpc = createSolanaRpc(RPC_URL);

// ── Scan cache (mirrors apps/web/src/lib/scan-cache.ts) ──────
function scanCache(nowMs: number): ScanCache {
  return {
    async get(tokenAddress) {
      const { data } = await admin.from('scans').select('*').eq('token_address', tokenAddress).maybeSingle();
      if (!data || !data.raw_data) return null;
      if (data.expires_at && new Date(data.expires_at).getTime() < nowMs) return null;
      return { ...(data.raw_data as ScanResult), cached: true };
    },
    async set(result) {
      await admin.from('scans').upsert(
        {
          token_address: result.tokenAddress,
          risk_score: result.riskScore,
          potential_score: result.potentialScore,
          dev_wallet_address: result.devWallet.address,
          dev_wallet_percent: result.devWallet.percentHeld,
          holder_count: result.holders.count,
          top_holder_percent: result.holders.topHolderPercent,
          liquidity_usd: result.liquidity.usd,
          lp_locked: result.liquidity.locked,
          mint_authority_active: result.authorities.mintActive,
          freeze_authority_active: result.authorities.freezeActive,
          token_age_hours: Math.round(result.ageHours),
          raw_data: result,
          scanned_at: result.scannedAt,
          expires_at: new Date(nowMs + SCAN_CACHE_TTL_SECONDS * 1000).toISOString(),
        },
        { onConflict: 'token_address' },
      );
    },
  };
}

// ── Delivery: push (Expo + OneSignal) + Telegram ─────────────
interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
type Platform = 'ios' | 'android' | 'web';

async function sendExpoPush(tokens: string[], message: PushMessage): Promise<void> {
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    priority: 'high',
  }));
  for (let i = 0; i < messages.length; i += 100) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    } catch {
      /* best-effort */
    }
  }
}

async function sendWebPush(tokens: string[], message: PushMessage): Promise<void> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) return;
  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_REST_API_KEY}` },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: tokens,
        headings: { en: message.title },
        contents: { en: message.body },
        data: message.data ?? {},
      }),
    });
  } catch {
    /* best-effort */
  }
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch {
    /* best-effort */
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function deliver(userId: string, alert: DetectedAlert): Promise<boolean> {
  let delivered = false;

  const { data: tokens } = await admin.from('push_tokens').select('token, platform').eq('user_id', userId);
  if (tokens && tokens.length) {
    const expo = tokens.filter((t) => t.platform !== 'web').map((t) => t.token);
    const web = tokens.filter((t) => (t.platform as Platform) === 'web').map((t) => t.token);
    const message: PushMessage = { title: alert.title, body: alert.body, data: { type: alert.type, ...alert.detail } };
    await Promise.all([
      expo.length ? sendExpoPush(expo, message) : Promise.resolve(),
      web.length ? sendWebPush(web, message) : Promise.resolve(),
    ]);
    delivered = true;
  }

  const { data: chats } = await admin
    .from('telegram_chats')
    .select('chat_id')
    .eq('user_id', userId)
    .eq('linked', true);
  if (chats && chats.length) {
    const text = `<b>${escapeHtml(alert.title)}</b>\n${escapeHtml(alert.body)}`;
    await Promise.all(chats.map((c) => sendTelegram(c.chat_id, text)));
    delivered = true;
  }

  return delivered;
}

// ── Alert check ──────────────────────────────────────────────
interface AlertCheckResult {
  checked: number;
  scanned: number;
  alertsTriggered: number;
  errors: number;
}

interface WatchRow {
  id: string;
  user_id: string;
  token_address: string;
  dev_wallet_address: string | null;
  initial_dev_balance: number | null;
  baseline: WatchBaseline | null;
}

async function detectDevDump(row: WatchRow): Promise<DetectedAlert | null> {
  const dev = row.dev_wallet_address;
  const initial = Number(row.initial_dev_balance);
  if (!dev || !(initial > 0)) return null;
  const current = await rpc.getOwnerTokenBalance(dev, row.token_address).catch(() => null);
  if (current == null) return null;
  const percentDropped = ((initial - current) / initial) * 100;
  if (percentDropped < DEV_DUMP_THRESHOLD_PERCENT) return null;
  return {
    type: 'dev_dump',
    title: '🚨 Dev wallet dump detected',
    body: `Dev sold ~${Math.round(percentDropped)}% of holdings for ${shortenAddress(row.token_address)}. Check ApeCheck now.`,
    detail: {
      devWalletAddress: dev,
      balanceBefore: initial,
      balanceAfter: current,
      percentDropped: Math.round(percentDropped * 10) / 10,
    },
    dedupeValue: Math.round(current),
    dedupeMode: 'lower-is-worse',
  };
}

async function fireIfNew(row: WatchRow, alert: DetectedAlert): Promise<boolean> {
  const { data: recent } = await admin
    .from('alerts')
    .select('id, dedupe_value')
    .eq('watchlist_id', row.id)
    .eq('alert_type', alert.type)
    .order('triggered_at', { ascending: false })
    .limit(1);
  const prior = recent?.[0];

  if (alert.dedupeMode === 'once') {
    if (prior) return false;
  } else if (prior && prior.dedupe_value != null && alert.dedupeValue >= Number(prior.dedupe_value)) {
    return false;
  }

  const insertRow: Record<string, unknown> = {
    watchlist_id: row.id,
    token_address: row.token_address,
    alert_type: alert.type,
    title: alert.title,
    body: alert.body,
    detail: alert.detail,
    dedupe_value: alert.dedupeValue,
    notified: false,
  };
  if (alert.type === 'dev_dump') {
    insertRow.dev_wallet_address = alert.detail.devWalletAddress ?? null;
    insertRow.balance_before = alert.detail.balanceBefore ?? null;
    insertRow.balance_after = alert.detail.balanceAfter ?? null;
    insertRow.percent_dropped = alert.detail.percentDropped ?? null;
  }

  const { data: inserted } = await admin.from('alerts').insert(insertRow).select('id').single();
  const notified = await deliver(row.user_id, alert);
  if (inserted && notified) await admin.from('alerts').update({ notified: true }).eq('id', inserted.id);
  return true;
}

async function runAlertCheck(nowMs: number): Promise<AlertCheckResult> {
  const cache = scanCache(nowMs);
  const result: AlertCheckResult = { checked: 0, scanned: 0, alertsTriggered: 0, errors: 0 };

  const { data: rows, error } = await admin
    .from('watchlist')
    .select('id, user_id, token_address, dev_wallet_address, initial_dev_balance, baseline')
    .eq('alert_enabled', true);
  if (error || !rows) return result;

  const scans = new Map<string, ScanResult | null>();
  for (const token of [...new Set(rows.map((r) => r.token_address))]) {
    try {
      scans.set(token, await runScan(token, { config: SCAN_CONFIG, cache, forceRefresh: true, nowMs }));
      result.scanned++;
    } catch {
      scans.set(token, null);
      result.errors++;
    }
  }

  for (const row of rows as WatchRow[]) {
    result.checked++;
    try {
      const scan = scans.get(row.token_address) ?? null;
      if (!scan) continue;

      if (!row.baseline) {
        const patch: Record<string, unknown> = { baseline: snapshotBaseline(scan, nowMs) };
        const dev = row.dev_wallet_address ?? scan.devWallet.address;
        if (dev && !(Number(row.initial_dev_balance) > 0)) {
          const bal = await rpc.getOwnerTokenBalance(dev, row.token_address).catch(() => null);
          if (bal != null) {
            patch.dev_wallet_address = dev;
            patch.initial_dev_balance = bal;
          }
        }
        await admin.from('watchlist').update(patch).eq('id', row.id);
        continue;
      }

      const detected = detectAlerts(row.baseline, scan);
      const devDump = await detectDevDump(row);
      if (devDump) detected.push(devDump);

      for (const alert of detected) {
        if (await fireIfNew(row, alert)) result.alertsTriggered++;
      }
    } catch {
      result.errors++;
    }
  }

  return result;
}

// ── Entry point ──────────────────────────────────────────────
async function runOnce(): Promise<void> {
  const startedAt = new Date().toISOString();
  const r = await runAlertCheck(Date.now());
  console.log(
    `[watch] ${startedAt} — checked=${r.checked} scanned=${r.scanned} alerts=${r.alertsTriggered} errors=${r.errors}`,
  );
}

async function main(): Promise<void> {
  const watch = process.argv.includes('--watch') || !!process.env.WATCH_INTERVAL_MS;
  const intervalMs = Number(process.env.WATCH_INTERVAL_MS) || 15 * 60 * 1000;

  console.log(
    `[watch] rpc=${RPC_URL.replace(/api-key=[^&]+/, 'api-key=***')} devDumpThreshold=${DEV_DUMP_THRESHOLD_PERCENT}% telegram=${TELEGRAM_BOT_TOKEN ? 'on' : 'off'}`,
  );

  if (!watch) {
    await runOnce();
    return;
  }

  console.log(`[watch] watch mode — every ${Math.round(intervalMs / 1000)}s`);
  await runOnce();
  setInterval(() => {
    runOnce().catch((e) => console.error('[watch] run failed:', e));
  }, intervalMs);
}

main().catch((e) => {
  console.error('[watch] fatal:', e);
  process.exit(1);
});
