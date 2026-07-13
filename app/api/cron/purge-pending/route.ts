import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TTL comfortably beyond Stripe's async settlement/retry window so a
// late-settling paid session is never dropped before its webhook lands.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { error } = await admin.from('pending_registrations').delete().lt('created_at', cutoff);
  if (error) {
    console.error('[purge-pending] failed', error);
    return new NextResponse('Error', { status: 500 });
  }
  return NextResponse.json({ ok: true, cutoff });
}
