import { getServerSupabase, getUserId } from '@/lib/supabase-server';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/watchlist/:id — stop watching a token. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED');

  const supabase = getServerSupabase();
  const { error } = await supabase.from('watchlist').delete().eq('id', params.id);
  if (error) return fail('INTERNAL', error.message);
  return new Response(null, { status: 204 });
}

/** PATCH /api/watchlist/:id — toggle the dump alert. Body: { alertEnabled: boolean }. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return fail('UNAUTHORIZED');

  let body: { alertEnabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_ADDRESS', 'Body must be JSON.');
  }
  if (typeof body.alertEnabled !== 'boolean') {
    return fail('INVALID_ADDRESS', 'alertEnabled must be a boolean.');
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('watchlist')
    .update({ alert_enabled: body.alertEnabled })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return fail('INTERNAL', error.message);
  return ok({ id: data.id, alertEnabled: data.alert_enabled });
}
