import {
  runScan,
  ScanError,
  isValidSolanaAddress,
  normalizeAddress,
  snapshotBaseline,
  shortenAddress,
  timeAgo,
  type ScanResult,
} from '@apecheck/core';
import { createSolanaRpc } from '@apecheck/api-clients';
import { getAdminSupabase } from './supabase-server';
import { createSupabaseScanCache, rowToScanResult } from './scan-cache';
import { scanConfig, env } from './env';
import { sendTelegramMessage, sendChatAction, escapeHtml } from './telegram';
import {
  fmtScanCard,
  fmtHeader,
  fmtMarket,
  fmtLiquidity,
  fmtAuthorities,
  fmtDev,
  fmtHolders,
  fmtHoneypot,
  fmtLinks,
  chartUrl,
  tradesUrl,
  bubbleUrl,
  RISK_DISCLAIMER,
} from './telegram-format';

/**
 * Telegram bot command router. Called by the webhook route (production) and,
 * in local dev, by the long-poll relay (cron/telegram-poll.ts) which forwards
 * updates to that same route. The sender is identified by chat_id → the
 * telegram_chats binding (service-role client; there is no auth cookie here).
 */
export interface TgUpdate {
  message?: {
    text?: string;
    chat?: { id: number; username?: string; first_name?: string };
    from?: { username?: string };
  };
}

/** Entry point: handle a single Telegram update. Never throws. */
export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || '').trim();
  if (!chatId || !text) return;

  const chatIdStr = String(chatId);
  const username = msg?.chat?.username || msg?.from?.username || null;
  const { cmd, arg } = parseCommand(text);

  try {
    switch (cmd) {
      case 'start':
        return await onStart(chatIdStr, arg, username);
      case 'help':
      case '':
        return await onHelp(chatIdStr);
      case 'scan':
      case 'risk':
      case 'market':
      case 'liquidity':
      case 'authorities':
      case 'dev':
      case 'holders':
      case 'honeypot':
      case 'chart':
      case 'trades':
      case 'bubblemap':
        return await onScanCommand(chatIdStr, cmd, arg);
      case 'watch':
        return await onWatch(chatIdStr, arg);
      case 'unwatch':
        return await onUnwatch(chatIdStr, arg);
      case 'watchlist':
        return await onWatchlist(chatIdStr);
      case 'alerts':
        return await onAlerts(chatIdStr);
      default:
        return await onHelp(chatIdStr);
    }
  } catch (err) {
    console.error('[tg-bot] handler error', cmd, err);
    await sendTelegramMessage(chatIdStr, '⚠️ Something broke handling that. Try again in a moment.');
  }
}

// ── parsing / shared lookups ─────────────────────────────────
function parseCommand(text: string): { cmd: string; arg: string } {
  if (!text.startsWith('/')) return { cmd: '', arg: text };
  const [head, ...rest] = text.slice(1).split(/\s+/);
  const cmd = head.split('@')[0].toLowerCase(); // strip /cmd@botname in groups
  return { cmd, arg: rest.join(' ').trim() };
}

/** user_id bound to this chat (linked), or null. */
async function getLinkedUserId(chatId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('telegram_chats')
    .select('user_id')
    .eq('chat_id', chatId)
    .eq('linked', true)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * Resolve the token an info command should act on: the explicit arg if valid,
 * else the sender's most recently scanned token (if their chat is linked).
 */
async function resolveAddress(arg: string, userId: string | null): Promise<string | null> {
  if (arg && isValidSolanaAddress(arg)) return normalizeAddress(arg);
  if (!userId) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('scan_history')
    .select('token_address')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.token_address ?? null;
}

/** Cache-first scan (same path as POST /api/scan). */
async function scanToken(address: string): Promise<ScanResult> {
  const nowMs = Date.now();
  const admin = getAdminSupabase();
  const cache = createSupabaseScanCache(admin, nowMs);
  return runScan(address, { config: scanConfig(), cache, nowMs });
}

// ── /start + /help ───────────────────────────────────────────
async function onStart(chatId: string, code: string, username: string | null): Promise<void> {
  if (!code) {
    await sendTelegramMessage(
      chatId,
      'Welcome to <b>ApeCheck</b> 🦍\n\n' +
        'Send a token address or use <code>/scan &lt;address&gt;</code> to get a full rug-risk report.\n\n' +
        'To get <b>alerts</b> when a watched token rugs, open the app → Alerts → “Connect Telegram”, or use <code>/help</code>.',
    );
    return;
  }
  await bindChat(code, chatId, username);
}

async function onHelp(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '🦍 <b>ApeCheck bot</b>\n\n' +
      '<b>Scan a token</b> (paste any Solana address after the command):\n' +
      '/scan · /risk · /market · /liquidity · /authorities · /dev · /holders · /honeypot\n' +
      '/chart · /trades · /bubblemap — live links\n\n' +
      '<b>Alerts</b> (connect your account first):\n' +
      '/watch &lt;address&gt; · /unwatch &lt;address&gt; · /watchlist · /alerts\n\n' +
      'Connect your account in the app → Alerts → “Connect Telegram”, then you’ll get a /start link.\n\n' +
      RISK_DISCLAIMER,
  );
}

// ── scan-family (info) commands ──────────────────────────────
async function onScanCommand(chatId: string, cmd: string, arg: string): Promise<void> {
  const userId = await getLinkedUserId(chatId);
  const address = await resolveAddress(arg, userId);
  if (!address) {
    await sendTelegramMessage(
      chatId,
      `Send a token address, e.g. <code>/${cmd} So11111111111111111111111111111111111111112</code>`,
    );
    return;
  }

  // Immediate feedback — a cold scan can take 20-50s, so never leave the user staring.
  await sendChatAction(chatId, 'typing');
  await sendTelegramMessage(chatId, `🔍 Scanning <code>${shortenAddress(address, 6, 6)}</code>… (up to ~30s on a cold token)`);

  let scan: ScanResult;
  try {
    scan = await scanToken(address);
  } catch (err) {
    await sendTelegramMessage(chatId, scanErrorText(err));
    return;
  }

  await sendTelegramMessage(chatId, renderSection(cmd, scan));
}

function renderSection(cmd: string, scan: ScanResult): string {
  const appUrl = env.appUrl();
  switch (cmd) {
    case 'scan':
      return fmtScanCard(scan, appUrl);
    case 'risk':
      return `${fmtHeader(scan)}\n\n${fmtRiskBreakdown(scan)}\n\n${RISK_DISCLAIMER}`;
    case 'market':
      return `${fmtHeader(scan)}\n\n${fmtMarket(scan)}`;
    case 'liquidity':
      return `${fmtHeader(scan)}\n\n${fmtLiquidity(scan)}`;
    case 'authorities':
      return `${fmtHeader(scan)}\n\n${fmtAuthorities(scan)}`;
    case 'dev':
      return `${fmtHeader(scan)}\n\n${fmtDev(scan)}`;
    case 'holders':
      return `${fmtHeader(scan)}\n\n${fmtHolders(scan)}`;
    case 'honeypot':
      return `${fmtHeader(scan)}\n\n${fmtHoneypot(scan)}`;
    case 'chart': {
      const u = chartUrl(scan);
      return u ? `📈 <b>Live chart</b>\n<a href="${u}">${escapeHtml(scan.meta.symbol || 'chart')} on GeckoTerminal</a>` : 'No chart pair found for this token.';
    }
    case 'trades': {
      const u = tradesUrl(scan);
      return u ? `💱 <b>Live trades</b>\n<a href="${u}">${escapeHtml(scan.meta.symbol || 'trades')} feed</a>` : 'No trades pair found for this token.';
    }
    case 'bubblemap':
      return `🫧 <b>Bubble map</b>\n<a href="${bubbleUrl(scan)}">Holder connectivity on Bubblemaps</a>`;
    default:
      return fmtScanCard(scan, appUrl);
  }
}

function fmtRiskBreakdown(scan: ScanResult): string {
  const flags = scan.riskBreakdown
    .filter((b) => b.status === 'fail' || b.status === 'warn')
    .slice(0, 6)
    .map((b) => `${b.status === 'fail' ? '🔴' : '🟡'} ${escapeHtml(b.label)} — ${escapeHtml(b.detail)}`);
  if (!flags.length) return '🟢 No major risk flags in the top checks.';
  return `<b>Top risk flags</b>\n${flags.join('\n')}`;
}

function scanErrorText(err: unknown): string {
  if (err instanceof ScanError) {
    switch (err.code) {
      case 'INVALID_ADDRESS':
        return '⚠️ That doesn’t look like a valid Solana token address.';
      case 'NOT_FOUND':
        return '🔍 Couldn’t find that token. Is it live on a Solana DEX yet?';
      case 'RATE_LIMITED':
        return '⏳ Rate limited — give it a few seconds and try again.';
      default:
        return '⚠️ A data source hiccuped. Try again in a moment.';
    }
  }
  return '⚠️ Scan failed. Try again in a moment.';
}

// ── watchlist-scoped commands (require a linked account) ─────
const CONNECT_HINT =
  '🔗 Connect your ApeCheck account first: open the app → <b>Alerts</b> → “Connect Telegram”, tap the link, then try again.';

async function onWatch(chatId: string, arg: string): Promise<void> {
  const userId = await getLinkedUserId(chatId);
  if (!userId) return void (await sendTelegramMessage(chatId, CONNECT_HINT));

  const address = await resolveAddress(arg, userId);
  if (!address) {
    await sendTelegramMessage(chatId, 'Which token? <code>/watch &lt;address&gt;</code>');
    return;
  }

  const admin = getAdminSupabase();
  const { devAddress, devBalance, baseline } = await captureBaseline(address);

  const { error } = await admin.from('watchlist').insert({
    user_id: userId,
    token_address: address,
    dev_wallet_address: devAddress,
    initial_dev_balance: devBalance,
    baseline,
    alert_enabled: true,
  });

  if (error) {
    if (error.code === '23505') {
      await sendTelegramMessage(chatId, `Already watching <code>${shortenAddress(address, 6, 6)}</code>. Use /watchlist to see all.`);
      return;
    }
    await sendTelegramMessage(chatId, '⚠️ Couldn’t add that to your watchlist. Try again.');
    return;
  }

  await sendTelegramMessage(
    chatId,
    `✅ Watching <code>${shortenAddress(address, 6, 6)}</code>. I’ll alert you here on a dev dump, LP pull, authority flip, price crash or whale sell.`,
  );
}

async function onUnwatch(chatId: string, arg: string): Promise<void> {
  const userId = await getLinkedUserId(chatId);
  if (!userId) return void (await sendTelegramMessage(chatId, CONNECT_HINT));

  const address = arg && isValidSolanaAddress(arg) ? normalizeAddress(arg) : null;
  if (!address) {
    await sendTelegramMessage(chatId, 'Which token? <code>/unwatch &lt;address&gt;</code>');
    return;
  }

  const admin = getAdminSupabase();
  const { data } = await admin
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('token_address', address)
    .select('id');

  await sendTelegramMessage(
    chatId,
    data && data.length
      ? `🗑️ Removed <code>${shortenAddress(address, 6, 6)}</code> from your watchlist.`
      : 'That token wasn’t on your watchlist.',
  );
}

async function onWatchlist(chatId: string): Promise<void> {
  const userId = await getLinkedUserId(chatId);
  if (!userId) return void (await sendTelegramMessage(chatId, CONNECT_HINT));

  const admin = getAdminSupabase();
  const { data: rows } = await admin
    .from('watchlist')
    .select('token_address')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!rows || !rows.length) {
    await sendTelegramMessage(chatId, 'Your watchlist is empty. Add one with <code>/watch &lt;address&gt;</code>.');
    return;
  }

  const addrs = rows.map((r) => r.token_address);
  const { data: metas } = await admin
    .from('scans')
    .select('token_address, risk_score, raw_data')
    .in('token_address', addrs);
  const metaByAddr = new Map((metas || []).map((m) => [m.token_address, m]));

  const lines = rows.slice(0, 25).map((r) => {
    const m = metaByAddr.get(r.token_address) as { risk_score?: number; raw_data?: { meta?: { symbol?: string } } } | undefined;
    const sym = m?.raw_data?.meta?.symbol ? `$${escapeHtml(m.raw_data.meta.symbol)}` : shortenAddress(r.token_address, 4, 4);
    const risk = m?.risk_score != null ? ` · risk ${m.risk_score}/100` : '';
    return `• ${sym}${risk}\n  <code>${r.token_address}</code>`;
  });

  await sendTelegramMessage(chatId, `👀 <b>Your watchlist</b> (${rows.length})\n\n${lines.join('\n')}`);
}

async function onAlerts(chatId: string): Promise<void> {
  const userId = await getLinkedUserId(chatId);
  if (!userId) return void (await sendTelegramMessage(chatId, CONNECT_HINT));

  const admin = getAdminSupabase();
  const { data: wl } = await admin.from('watchlist').select('id').eq('user_id', userId);
  const ids = (wl || []).map((w) => w.id);
  if (!ids.length) {
    await sendTelegramMessage(chatId, 'No alerts yet — add tokens with <code>/watch &lt;address&gt;</code>.');
    return;
  }

  const { data: alerts } = await admin
    .from('alerts')
    .select('token_address, title, body, triggered_at')
    .in('watchlist_id', ids)
    .order('triggered_at', { ascending: false })
    .limit(10);

  if (!alerts || !alerts.length) {
    await sendTelegramMessage(chatId, '🔕 No alerts fired yet. Quiet is good.');
    return;
  }

  const now = Date.now();
  const lines = alerts.map(
    (a) => `${escapeHtml(a.title || 'Alert')} — <i>${timeAgo(a.triggered_at, now)}</i>\n${escapeHtml(a.body || '')}`,
  );
  await sendTelegramMessage(chatId, `🔔 <b>Recent alerts</b>\n\n${lines.join('\n\n')}`);
}

// ── /start link binding (deep-link code → chat) ──────────────
async function bindChat(code: string, chatId: string, username: string | null): Promise<void> {
  const admin = getAdminSupabase();

  const { data: pending } = await admin
    .from('telegram_chats')
    .select('id, user_id')
    .eq('link_code', code)
    .eq('linked', false)
    .maybeSingle();

  if (!pending) {
    await sendTelegramMessage(
      chatId,
      '⚠️ That link is invalid or already used. Grab a fresh one in ApeCheck → Alerts → “Connect Telegram”.',
    );
    return;
  }

  // Detach any prior binding of this chat (re-link / chat moved to a new account).
  await admin.from('telegram_chats').delete().eq('chat_id', chatId).neq('id', pending.id);

  const { error } = await admin
    .from('telegram_chats')
    .update({ chat_id: chatId, username, linked: true, link_code: null })
    .eq('id', pending.id);

  if (error) {
    await sendTelegramMessage(chatId, '⚠️ Couldn’t link this chat. Please try again from the app.');
    return;
  }

  await sendTelegramMessage(
    chatId,
    '✅ <b>Linked!</b> You’ll now get ApeCheck alerts here when a watched token rugs — dev dump, LP pull, authority flip, price crash or whale sell.\n\nTry <code>/watchlist</code> or scan a token with <code>/scan &lt;address&gt;</code>.',
  );
}

// ── baseline capture for /watch (mirrors POST /api/watchlist) ─
async function captureBaseline(tokenAddress: string): Promise<{
  devAddress: string | null;
  devBalance: number | null;
  baseline: ReturnType<typeof snapshotBaseline> | null;
}> {
  const empty = { devAddress: null, devBalance: null, baseline: null };
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('scans')
      .select('dev_wallet_address, raw_data')
      .eq('token_address', tokenAddress)
      .maybeSingle();
    if (!data) return empty;

    const baseline = data.raw_data ? snapshotBaseline(rowToScanResult(data), Date.now()) : null;
    const devAddress: string | null = data.dev_wallet_address ?? null;
    if (!devAddress) return { devAddress: null, devBalance: null, baseline };

    const rpc = createSolanaRpc(scanConfig().rpcUrl);
    const balance = await rpc.getOwnerTokenBalance(devAddress, tokenAddress);
    return { devAddress, devBalance: balance, baseline };
  } catch {
    return empty;
  }
}
