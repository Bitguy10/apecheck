import { randomBytes } from 'crypto';
import { getServerSupabase, getUserId, getAdminSupabase } from '@/lib/supabase-server';
import { env } from '@/lib/env';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TelegramLinkStatus {
  linked: boolean;
  username: string | null;
  /** Present when not yet linked: paste-into-bot code + one-tap deep link. */
  linkCode?: string;
  deepLink?: string;
  botConfigured: boolean;
}

/** GET /api/telegram/link — current link status for the signed-in user. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED', 'Sign in to connect Telegram.');

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('telegram_chats')
    .select('username, linked')
    .eq('linked', true)
    .limit(1)
    .maybeSingle();

  const status: TelegramLinkStatus = {
    linked: !!data?.linked,
    username: data?.username ?? null,
    botConfigured: !!env.telegramBotUsername(),
  };
  return ok(status);
}

/**
 * POST /api/telegram/link — mint (or reuse) a one-time link code and return a
 * t.me deep link. The user taps it, the bot receives /start <code>, and the
 * webhook binds their chat. Uses the service role to store the pending code.
 */
export async function POST() {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED', 'Sign in to connect Telegram.');

  const admin = getAdminSupabase();

  // Already linked? Nothing to do.
  const { data: existing } = await admin
    .from('telegram_chats')
    .select('id, linked, username')
    .eq('user_id', userId);
  const linkedRow = (existing || []).find((r) => r.linked);
  if (linkedRow) {
    const status: TelegramLinkStatus = {
      linked: true,
      username: linkedRow.username ?? null,
      botConfigured: !!env.telegramBotUsername(),
    };
    return ok(status);
  }

  // Reuse a pending (unlinked) code if present, else mint a new one.
  const pending = (existing || []).find((r) => !r.linked);
  let linkCode: string;
  if (pending) {
    const { data } = await admin
      .from('telegram_chats')
      .select('link_code')
      .eq('id', pending.id)
      .maybeSingle();
    linkCode = data?.link_code || (await mintCode(admin, userId, pending.id));
  } else {
    linkCode = await mintCode(admin, userId, null);
  }

  const botUsername = env.telegramBotUsername();
  const status: TelegramLinkStatus = {
    linked: false,
    username: null,
    linkCode,
    deepLink: botUsername ? `https://t.me/${botUsername}?start=${linkCode}` : undefined,
    botConfigured: !!botUsername,
  };
  return ok(status);
}

async function mintCode(
  admin: ReturnType<typeof getAdminSupabase>,
  userId: string,
  existingId: string | null,
): Promise<string> {
  const code = randomBytes(9).toString('base64url');
  if (existingId) {
    await admin.from('telegram_chats').update({ link_code: code }).eq('id', existingId);
  } else {
    // chat_id is NOT NULL + unique; use a placeholder until the bot binds the real one.
    await admin.from('telegram_chats').insert({
      user_id: userId,
      chat_id: `pending:${code}`,
      link_code: code,
      linked: false,
    });
  }
  return code;
}
