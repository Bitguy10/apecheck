import { handleTelegramUpdate, type TgUpdate } from '@/lib/telegram-bot';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
