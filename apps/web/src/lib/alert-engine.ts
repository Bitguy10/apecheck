import type { SupabaseClient } from '@supabase/supabase-js';
import { createSolanaRpc } from '@apecheck/api-clients';
import {
  runScan,
  detectAlerts,
  snapshotBaseline,
  DEV_DUMP_THRESHOLD_PERCENT,
  shortenAddress,
  type ScanResult,
  type WatchBaseline,
  type DetectedAlert,
} from '@apecheck/core';
import { scanConfig } from './env';
import { createSupabaseScanCache } from './scan-cache';
import { sendPush, type PushMessage } from './push';
import { sendTelegramMessage, escapeHtml } from './telegram';

/**
 * Generalized alert engine, shared by the Vercel Cron route
 * (apps/web/src/app/api/internal/check-dumps → runAlertCheck) and the standalone
 * cron/dev-wallet-watch.ts. Uses the service-role client (bypasses RLS).
 *
 * Per run:
 *   1. Scan each UNIQUE watched token once (forceRefresh) and reuse across rows.
 *   2. First time we see a row, snapshot a baseline and skip (nothing to compare to yet).
 *   3. Run the pure detectAlerts(baseline, scan) — LP pull / authority re-enable /
 *      price drop / whale sell — plus the on-chain dev-wallet dump check.
 *   4. Per-type dedupe against the latest alert row, insert, and deliver
 *      via push + Telegram.
 */
export interface AlertCheckResult {
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
  alert_enabled: boolean;
}

type Rpc = ReturnType<typeof createSolanaRpc>;

export async function runAlertCheck(
  admin: SupabaseClient,
  rpcUrl: string,
  nowMs: number,
): Promise<AlertCheckResult> {
  const rpc = createSolanaRpc(rpcUrl);
  const cache = createSupabaseScanCache(admin, nowMs);
  const result: AlertCheckResult = { checked: 0, scanned: 0, alertsTriggered: 0, errors: 0 };

  const { data: rows, error } = await admin
    .from('watchlist')
    .select(
      'id, user_id, token_address, dev_wallet_address, initial_dev_balance, baseline, alert_enabled',
    )
    .eq('alert_enabled', true);

  if (error || !rows) return result;

  // Scan each unique token once; many users may watch the same token.
  const scans = new Map<string, ScanResult | null>();
  for (const token of [...new Set(rows.map((r) => r.token_address))]) {
    try {
      scans.set(token, await runScan(token, { config: scanConfig(), cache, forceRefresh: true, nowMs }));
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

      // No baseline yet (fresh row, or added directly from mobile): capture it now
      // and compare on the next run. Don't alert this round.
      if (!row.baseline) {
        await seedBaseline(admin, rpc, row, scan, nowMs);
        continue;
      }

      const detected = detectAlerts(row.baseline, scan);

      // Dev-wallet dump is an on-chain balance check, not derivable from the scan.
      const devDump = await detectDevDump(rpc, row);
      if (devDump) detected.push(devDump);

      for (const alert of detected) {
        if (await fireIfNew(admin, row, alert)) result.alertsTriggered++;
      }
    } catch {
      result.errors++;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

/** Snapshot the extended baseline + seed the legacy dev-balance reference. */
async function seedBaseline(
  admin: SupabaseClient,
  rpc: Rpc,
  row: WatchRow,
  scan: ScanResult,
  nowMs: number,
): Promise<void> {
  const patch: Record<string, unknown> = { baseline: snapshotBaseline(scan, nowMs) };

  // Seed dev wallet + balance if we don't have them (needed for dev_dump).
  const dev = row.dev_wallet_address ?? scan.devWallet.address;
  if (dev && !(Number(row.initial_dev_balance) > 0)) {
    const bal = await rpc.getOwnerTokenBalance(dev, row.token_address).catch(() => null);
    if (bal != null) {
      patch.dev_wallet_address = dev;
      patch.initial_dev_balance = bal;
    }
  }

  await admin.from('watchlist').update(patch).eq('id', row.id);
}

/** On-chain dev-wallet dump check, shaped as a DetectedAlert for uniform dedupe. */
async function detectDevDump(rpc: Rpc, row: WatchRow): Promise<DetectedAlert | null> {
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
    // One dev wallet can only sell so much; dedupe on remaining balance.
    dedupeValue: Math.round(current),
    dedupeMode: 'lower-is-worse',
  };
}

/** Dedupe per (watchlist, type), insert the alert, and deliver it. Returns true if fired. */
async function fireIfNew(
  admin: SupabaseClient,
  row: WatchRow,
  alert: DetectedAlert,
): Promise<boolean> {
  const { data: recent } = await admin
    .from('alerts')
    .select('id, dedupe_value')
    .eq('watchlist_id', row.id)
    .eq('alert_type', alert.type)
    .order('triggered_at', { ascending: false })
    .limit(1);
  const prior = recent?.[0];

  if (alert.dedupeMode === 'once') {
    if (prior) return false; // fire this type at most once per watch
  } else if (prior && prior.dedupe_value != null && alert.dedupeValue >= Number(prior.dedupe_value)) {
    return false; // not worse than the last alert of this type
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
  // Keep the legacy dev-dump columns populated so the existing alerts UI works.
  if (alert.type === 'dev_dump') {
    insertRow.dev_wallet_address = alert.detail.devWalletAddress ?? null;
    insertRow.balance_before = alert.detail.balanceBefore ?? null;
    insertRow.balance_after = alert.detail.balanceAfter ?? null;
    insertRow.percent_dropped = alert.detail.percentDropped ?? null;
  }

  const { data: inserted } = await admin.from('alerts').insert(insertRow).select('id').single();

  const notified = await deliver(admin, row.user_id, alert);
  if (inserted && notified) {
    await admin.from('alerts').update({ notified: true }).eq('id', inserted.id);
  }
  return true;
}

/** Deliver an alert to every push device + linked Telegram chat the user has. */
async function deliver(
  admin: SupabaseClient,
  userId: string,
  alert: DetectedAlert,
): Promise<boolean> {
  let delivered = false;

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token, platform')
    .eq('user_id', userId);
  if (tokens && tokens.length) {
    const message: PushMessage = {
      title: alert.title,
      body: alert.body,
      data: { type: alert.type, ...alert.detail },
    };
    await sendPush(
      tokens.map((t) => ({ token: t.token, platform: t.platform as 'ios' | 'android' | 'web' })),
      message,
    );
    delivered = true;
  }

  const { data: chats } = await admin
    .from('telegram_chats')
    .select('chat_id')
    .eq('user_id', userId)
    .eq('linked', true);
  if (chats && chats.length) {
    const text = `<b>${escapeHtml(alert.title)}</b>\n${escapeHtml(alert.body)}`;
    await Promise.all(chats.map((c) => sendTelegramMessage(c.chat_id, text)));
    delivered = true;
  }

  return delivered;
}
