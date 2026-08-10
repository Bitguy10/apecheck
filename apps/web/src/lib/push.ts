import { env } from './env';

/**
 * Push senders. Expo for mobile (no key needed), OneSignal for web (optional).
 * Both are best-effort and never throw into the caller.
 */

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

/** Send a push to a batch of device tokens, routing by platform. */
export async function sendPush(tokens: DeviceToken[], message: PushMessage): Promise<void> {
  const expoTokens = tokens.filter((t) => t.platform !== 'web').map((t) => t.token);
  const webTokens = tokens.filter((t) => t.platform === 'web').map((t) => t.token);

  await Promise.all([
    expoTokens.length ? sendExpoPush(expoTokens, message) : Promise.resolve(),
    webTokens.length ? sendWebPush(webTokens, message) : Promise.resolve(),
  ]);
}

/** Expo push service — https://exp.host/--/api/v2/push/send. No API key required. */
async function sendExpoPush(tokens: string[], message: PushMessage): Promise<void> {
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    priority: 'high',
  }));

  // Expo accepts up to 100 messages per request.
  const chunks: (typeof messages)[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
    } catch {
      // best-effort
    }
  }
}

/** OneSignal web push (optional). No-op if not configured. */
async function sendWebPush(tokens: string[], message: PushMessage): Promise<void> {
  const appId = env.onesignalAppId();
  const restKey = env.onesignalRestKey();
  if (!appId || !restKey) return; // web push not configured — skip silently

  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${restKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: tokens,
        headings: { en: message.title },
        contents: { en: message.body },
        data: message.data ?? {},
      }),
    });
  } catch {
    // best-effort
  }
}
