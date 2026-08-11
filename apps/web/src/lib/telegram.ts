import { env } from './env';

/**
 * Telegram Bot API helpers. Server-only — uses TELEGRAM_BOT_TOKEN.
 * All senders are best-effort and never throw into the caller.
 */

const API = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

/** Send a plain-text message to a chat. No-op if the bot isn't configured. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = env.telegramBotToken();
  if (!token) return false;
  try {
    const res = await fetch(API(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Register the webhook URL with Telegram so updates POST to our route. */
export async function setTelegramWebhook(webhookUrl: string, secretToken?: string): Promise<boolean> {
  const token = env.telegramBotToken();
  if (!token) return false;
  try {
    const res = await fetch(API(token, 'setWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Remove any registered webhook (required before long-polling with getUpdates). */
export async function deleteTelegramWebhook(): Promise<boolean> {
  const token = env.telegramBotToken();
  if (!token) return false;
  try {
    const res = await fetch(API(token, 'deleteWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch current webhook + bot status for diagnostics (never throws). */
export async function getTelegramDiagnostics(): Promise<{
  botConfigured: boolean;
  botUsername?: string;
  webhookUrl?: string;
  pendingUpdateCount?: number;
  lastErrorMessage?: string;
}> {
  const token = env.telegramBotToken();
  if (!token) return { botConfigured: false };
  try {
    const [meRes, whRes] = await Promise.all([
      fetch(API(token, 'getMe')),
      fetch(API(token, 'getWebhookInfo')),
    ]);
    const me = await meRes.json().catch(() => null);
    const wh = await whRes.json().catch(() => null);
    return {
      botConfigured: true,
      botUsername: me?.result?.username,
      webhookUrl: wh?.result?.url || '',
      pendingUpdateCount: wh?.result?.pending_update_count,
      lastErrorMessage: wh?.result?.last_error_message,
    };
  } catch {
    return { botConfigured: true };
  }
}

/**
 * Register the bot's slash-command menu so it matches what the webhook handles.
 * Keeps the BotFather menu in sync with the code (idempotent).
 */
export async function setTelegramCommands(): Promise<boolean> {
  const token = env.telegramBotToken();
  if (!token) return false;
  try {
    const res = await fetch(API(token, 'setMyCommands'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: BOT_COMMANDS }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The command menu shown in the Telegram "/" picker — kept in sync with the webhook handler. */
export const BOT_COMMANDS: { command: string; description: string }[] = [
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
  { command: 'wallet', description: 'Scan any wallet — holdings, value & PnL' },
  { command: 'watch', description: 'Add a token to your alert watchlist' },
  { command: 'unwatch', description: 'Remove a token from your watchlist' },
  { command: 'watchlist', description: 'Show your watched tokens' },
  { command: 'alerts', description: 'Your most recent alerts' },
  { command: 'help', description: 'How to use ApeCheck bot' },
];

/** HTML-escape user-controlled text before embedding in a Telegram message. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Show the "typing…" indicator in a chat (best-effort; expires after ~5s). */
export async function sendChatAction(chatId: string, action = 'typing'): Promise<void> {
  const token = env.telegramBotToken();
  if (!token) return;
  try {
    await fetch(API(token, 'sendChatAction'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    /* best-effort */
  }
}
