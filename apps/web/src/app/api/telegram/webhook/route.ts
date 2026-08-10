import { handleTelegramUpdate, type TgUpdate } from '@/lib/telegram-bot';
import { env } from '@/lib/env';
import { waitUntil } from '@vercel/functions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A cold /scan can take 20-50s. We ACK Telegram instantly (below) and let the
// handler finish in the background via waitUntil — but the function must stay
// alive until that work settles, so keep the max duration at the Hobby ceiling.
export const maxDuration = 60;

/**
 * POST /api/telegram/webhook — Telegram update receiver.
 * Register with POST /api/internal/telegram-setup?key=<CRON_SECRET>.
 *
 * Routes every message through handleTelegramUpdate (scan/info commands +
 * /start deep-link binding + watchlist commands). We return 200 immediately and
 * run the handler in the background (waitUntil): a scan can take 20-50s, and if
 * we held the response open that long Telegram would time out, retry the update,
 * and the user would get duplicate replies. The handler sends its own progress
 * ("🔍 Scanning…") and result messages, so nothing is lost by acking early.
 * Only a bad secret token returns non-200.
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

  waitUntil(handleTelegramUpdate(update));
  return Response.json({ ok: true });
}
