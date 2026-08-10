import { getAdminSupabase } from '@/lib/supabase-server';
import { runAlertCheck } from '@/lib/alert-engine';
import { env } from '@/lib/env';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST/GET /api/internal/check-dumps — cron-triggered dump detector.
 * Protected by CRON_SECRET. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * (configure the header in Vercel project settings) OR we accept ?key=.
 */
async function handle(req: Request) {
  const secret = env.cronSecret();
  if (secret) {
    const auth = req.headers.get('authorization');
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    const provided = auth?.replace('Bearer ', '') || key;
    if (provided !== secret) return fail('UNAUTHORIZED', 'Bad cron secret.');
  }

  const admin = getAdminSupabase();
  const result = await runAlertCheck(admin, env.solanaRpcUrl(), Date.now());
  return ok({ ...result, ranAt: new Date().toISOString() });
}

export async function POST(req: Request) {
  return handle(req);
}

// Vercel Cron issues GET requests by default.
export async function GET(req: Request) {
  return handle(req);
}
