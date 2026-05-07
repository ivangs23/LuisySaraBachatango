import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Validates Mux webhook signature.
 * Header format: t=<timestamp>,v1=<hex>
 * Signed payload: `${timestamp}.${rawBody}`
 * https://docs.mux.com/guides/system/listen-for-webhooks#validate-the-signature
 */
function verifyMuxSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex')
  // Timing-safe compare. Catch invalid hex (different length) by length check first.
  if (expected.length !== v1.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET
  if (!secret) {
    console.error('Mux webhook secret not configured')
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('mux-signature')

  if (!verifyMuxSignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: { type?: string; data?: { id?: string; playback_ids?: { id: string }[] } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  if (event.type === 'video.asset.ready') {
    const assetId = event.data?.id
    const playbackId = event.data?.playback_ids?.[0]?.id ?? null
    if (assetId) {
      await supabase
        .from('lessons')
        .update({ mux_status: 'ready', mux_playback_id: playbackId })
        .eq('mux_asset_id', assetId)
    }
  } else if (event.type === 'video.asset.errored') {
    const assetId = event.data?.id
    if (assetId) {
      await supabase
        .from('lessons')
        .update({ mux_status: 'errored' })
        .eq('mux_asset_id', assetId)
    }
  }

  return new NextResponse(null, { status: 200 })
}
