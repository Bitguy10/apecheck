import { setTelegramWebhook, setTelegramCommands, getTelegramDiagnostics } from '@/lib/telegram';
import { env } from '@/lib/env';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Telegram webhook management. Protected by CRON_SECRET (?key= or Bearer).
 *
 *   GET  → diagnostics: current webhook URL, pending updates, last error, bot @name.
 *   POST → register the webhook (points Telegram at /api/telegram/webhook) and
 *          sync the slash-command menu. Pass ?url=https://public-host to override
 *          NEXT_PUBLIC_APP_URL (handy for an ngrok/cloudflared tunnel).
 */
function authed(req: Request): boolean {
  const secret = env.cronSecret();
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  const key = new URL(req.url).searchParams.get('key');
  return (auth?.replace('Bearer ', '') || key) === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return fail('UNAUTHORIZED', 'Bad cron secret.');
  const diag = await getTelegramDiagnostics();
  return ok(diag);
}

export async function POST(req: Request) {
  if (!authed(req)) return fail('UNAUTHORIZED', 'Bad cron secret.');
  if (!env.telegramBotToken()) return fail('INTERNAL', 'TELEGRAM_BOT_TOKEN is not configured.');

  const override = new URL(req.url).searchParams.get('url');
  const base = (override || env.appUrl()).replace(/\/$/, '');
  if (!/^https:\/\//.test(base)) {
    return fail('INVALID_ADDRESS', `Webhook base must be https (got "${base}"). Telegram cannot deliver to http/localhost — pass ?url=https://your-tunnel or deploy first.`);
  }

  const webhookUrl = `${base}/api/telegram/webhook`;
  const done = await setTelegramWebhook(webhookUrl, env.telegramWebhookSecret());
  if (!done) return fail('UPSTREAM_ERROR', 'Telegram rejected the webhook registration.');

  const commandsSynced = await setTelegramCommands();
  return ok({ webhookUrl, secretConfigured: !!env.telegramWebhookSecret(), commandsSynced });
}
