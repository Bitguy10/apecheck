import { getServerSupabase, getUserId } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['ios', 'android', 'web'] as const;

/** POST /api/push-tokens — register a device push token. Body: { token, platform }. */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED', 'Sign in to enable push.');

  let body: { token?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_ADDRESS', 'Body must be JSON.');
  }

  const token = (body.token || '').trim();
  const platform = body.platform as (typeof PLATFORMS)[number];
  if (!token) return fail('INVALID_ADDRESS', 'Missing push token.');
  if (!PLATFORMS.includes(platform)) return fail('INVALID_ADDRESS', 'Invalid platform.');

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' });

  if (error) return fail('INTERNAL', error.message);
  return ok({ registered: true }, { status: 201 });
}
