import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

// TTL comfortably beyond Stripe's async settlement/retry window so a
// late-settling paid session is never dropped before its webhook lands.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse('Unauthorized', { status: 401 })
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
