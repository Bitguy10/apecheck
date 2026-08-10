import { handleTelegramUpdate, type TgUpdate } from '@/lib/telegram-bot';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A cold /scan can take 20-50s. Without this the function inherits Vercel's 10s
// default and is killed mid-scan → Telegram never gets a 200 → it retries the
// update → duplicate "Scanning…" replies + apparent hangs. 60s (Hobby max) lets
// the handler finish and ack within Telegram's webhook tolerance.
export const maxDuration = 60;

/**
 * POST /api/telegram/webhook — Telegram update receiver.
 * Register with POST /api/internal/telegram-setup?key=<CRON_SECRET>.
 *
 * Routes every message through handleTelegramUpdate (scan/info commands +
 * /start deep-link binding + watchlist commands). Always returns 200 so
 * Telegram doesn't retry — except on a bad secret token.
 */
export async function POST(req: Request) {
  // Verify the secret Telegram echoes back, when configured.
  const secret = env.telegramWebhookSecret();
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return Response.json({ ok: true });
  }

  await handleTelegramUpdate(update);
  return Response.json({ ok: true });
}
