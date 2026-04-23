import { createClient } from '@/utils/supabase/server'
import { mux } from '@/utils/mux/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: lesson } = await supabase
      .from('lessons')
      .select('mux_upload_id, mux_asset_id, mux_playback_id, mux_status')
      .eq('id', lessonId)
      .single()
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    // Already ready or errored — return cached state.
    if (lesson.mux_status === 'ready' || lesson.mux_status === 'errored') {
      return NextResponse.json({
        status: lesson.mux_status,
        assetId: lesson.mux_asset_id,
        playbackId: lesson.mux_playback_id,
      })
    }

    // Need to discover asset_id from upload_id, then check asset status.
    let assetId = lesson.mux_asset_id
    if (!assetId && lesson.mux_upload_id) {
      const upload = await mux.video.uploads.retrieve(lesson.mux_upload_id)
      if (upload.asset_id) assetId = upload.asset_id
    }

    if (!assetId) {
      return NextResponse.json({ status: 'preparing' })
    }

    const asset = await mux.video.assets.retrieve(assetId)

    if (asset.status === 'ready') {
      const signedPlaybackId = asset.playback_ids?.find(p => p.policy === 'signed')?.id ?? null
      if (!signedPlaybackId) {
        return NextResponse.json({ error: 'Asset ready but no signed playback_id' }, { status: 500 })
      }
      await supabase
        .from('lessons')
        .update({
          mux_asset_id: assetId,
          mux_playback_id: signedPlaybackId,
          mux_status: 'ready',
        })
        .eq('id', lessonId)
      return NextResponse.json({ status: 'ready', assetId, playbackId: signedPlaybackId })
    }

    if (asset.status === 'errored') {
      await supabase.from('lessons').update({ mux_status: 'errored' }).eq('id', lessonId)
      return NextResponse.json({ status: 'errored', assetId })
    }

    // Still preparing
    if (assetId && !lesson.mux_asset_id) {
      await supabase.from('lessons').update({ mux_asset_id: assetId }).eq('id', lessonId)
    }
    return NextResponse.json({ status: 'preparing', assetId })
  } catch (err) {
    console.error('[mux/status]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
