/**
 * ApeCheck — local Telegram relay (long-polling → local webhook).
 *
 * A Telegram webhook needs a public HTTPS URL, so it can't reach a dev server on
 * localhost. This relay bridges the gap for LOCAL DEV ONLY: it long-polls
 * getUpdates (works from behind any NAT) and forwards each update to the same
 * /api/telegram/webhook route the production webhook would hit — so the bot
 * behaves identically here and in prod. In production you register the webhook
 * instead (POST /api/internal/telegram-setup) and do NOT run this.
 *
 * Run (loads apps/web/.env.local for the bot token + secret):
 *   npm run bot:dev
 * Override the local target if your dev server isn't on :3001:
 *   WEBHOOK_TARGET=http://localhost:3000/api/telegram/webhook npm run bot:dev
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load apps/web/.env.local (bot token + webhook secret) without a dotenv dep.
const HERE = dirname(fileURLToPath(import.meta.url));
for (const rel of ['../apps/web/.env.local', '../.env', './.env']) {
  try {
    process.loadEnvFile(resolve(HERE, rel));
  } catch {
    /* file absent — fine */
  }
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TARGET = process.env.WEBHOOK_TARGET || 'http://localhost:3001/api/telegram/webhook';

if (!TOKEN) {
  console.error('[bot] TELEGRAM_BOT_TOKEN is not set. Run via `npm run bot:dev` (loads apps/web/.env.local).');
  process.exit(1);
}

const API = (method: string) => `https://api.telegram.org/bot${TOKEN}/${method}`;

async function tg(method: string, body?: unknown, timeoutMs = 15000): Promise<any> {
  const res = await fetch(API(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.json();
}

/**
 * Forward one update to the local webhook route (same path as production).
 * Fire-and-forget from the poll loop: a cold /scan can take ~50s, and we must
 * not block polling (or new messages queue up and offsets stall).
 */
async function forward(update: unknown): Promise<void> {
  try {
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SECRET ? { 'x-telegram-bot-api-secret-token': SECRET } : {}),
      },
      body: JSON.stringify(update),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) console.error(`[bot] webhook route returned ${res.status} — is the web dev server running at ${TARGET}?`);
  } catch (err) {
    console.error(`[bot] could not reach ${TARGET} — start it with \`npm run dev:web\`.`, (err as Error).message);
  }
}

async function main(): Promise<void> {
  const me = await tg('getMe').catch(() => null);
  if (!me?.ok) {
    console.error('[bot] getMe failed — TELEGRAM_BOT_TOKEN looks invalid.');
    process.exit(1);
  }
  console.log(`[bot] relay online for @${me.result.username} → ${TARGET}`);

  // A webhook and getUpdates are mutually exclusive; drop the webhook, keep pending updates.
  await tg('deleteWebhook', { drop_pending_updates: false });

  // Keep the "/" command menu in sync (best-effort).
  await tg('setMyCommands', {
    commands: [
      { command: 'scan', description: 'Full risk + market scan of a token' },
      { command: 'risk', description: 'Risk score & key safety checks' },
      { command: 'market', description: 'Price, market cap, volume' },
      { command: 'liquidity', description: 'Liquidity size + lock/burn status' },
      { command: 'authorities', description: 'Mint / freeze authority status' },
      { command: 'dev', description: 'Dev wallet holdings + reputation' },
      { command: 'holders', description: 'Holder count + top concentration' },
      { command: 'honeypot', description: 'Can-I-sell simulation' },
      { command: 'chart', description: 'Live chart link' },
      { command: 'trades', description: 'Live trade feed link' },
      { command: 'bubblemap', description: 'Holder bubble map link' },
      { command: 'watch', description: 'Add a token to your alert watchlist' },
      { command: 'unwatch', description: 'Remove a token from your watchlist' },
      { command: 'watchlist', description: 'Show your watched tokens' },
      { command: 'alerts', description: 'Your most recent alerts' },
      { command: 'help', description: 'How to use ApeCheck bot' },
    ],
  }).catch(() => {});

  // End any ghost long-poll a previous relay left open (timeout:0 returns at once, drops nothing).
  await tg('getUpdates', { offset: 0, timeout: 0 }).catch(() => {});

  let running = true;
  const shutdown = (sig: string) => {
    if (!running) return;
    running = false;
    console.log(`\n[bot] ${sig} — shutting down cleanly.`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  let offset = 0;
  let consecErrors = 0;
  console.log('[bot] listening for messages… (Ctrl+C to stop)');
  while (running) {
    let res: any;
    try {
      // Telegram holds the request up to `timeout`s; give the client a bit more before aborting.
      res = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 30000);
    } catch (err) {
      // Connection-level blip — usually a stale keep-alive socket or a just-killed twin relay's
      // poll still winding down. A fresh socket almost always succeeds, so retry fast first.
      consecErrors++;
      const wait = consecErrors === 1 ? 300 : Math.min(consecErrors * 1000, 5000);
      if (consecErrors <= 2 || consecErrors % 5 === 0) {
        console.error(`[bot] poll error (#${consecErrors}), retrying in ${wait}ms:`, (err as Error).message);
      }
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (res?.ok === false) {
      // 409: another getUpdates is live for this bot (duplicate relay, or a prior poll not yet
      // expired on Telegram's side). Ours wins on the next cycle — wait out the ghost, don't spin.
      if (res.error_code === 409) {
        console.error('[bot] conflict: another poller is live for this bot. Clears itself in ~30s if you didn’t start a second `npm run bot:dev`.');
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      console.error('[bot] getUpdates not-ok:', res.description || JSON.stringify(res));
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    consecErrors = 0;
    if (Array.isArray(res?.result)) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        const text = update.message?.text;
        if (text) console.log(`[bot] ← ${text} (chat ${update.message?.chat?.id})`);
        // Fire-and-forget: a cold /scan can take ~50s; blocking here would stall polling.
        void forward(update);
      }
    }
  }
}

main().catch((e) => {
  console.error('[bot] fatal:', e);
  process.exit(1);
});
