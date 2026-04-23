'use server'

import { createClient } from '@/utils/supabase/server'
import { mux } from '@/utils/mux/server'
import {
  buildDirectUploadParams,
  buildAudioTrackPayload,
  buildSubtitleTrackPayload,
  validateLanguageCode,
} from '@/utils/mux/validation'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Unauthorized' as const, user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { supabase, error: 'Forbidden' as const, user }
  return { supabase, user, error: null }
}

export async function createMuxUpload(lessonId: string, origin: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson) return { error: 'Lección no encontrada' }

  // If an asset already exists, delete it first to avoid orphaned storage.
  if (lesson.mux_asset_id) {
    try {
      await mux.video.assets.delete(lesson.mux_asset_id)
    } catch (err) {
      console.error('Failed to delete previous Mux asset:', err)
      // Non-fatal: proceed with new upload.
    }
  }

  const upload = await mux.video.uploads.create(buildDirectUploadParams(origin, lessonId))

  const { error: dbErr } = await supabase
    .from('lessons')
    .update({
      mux_upload_id: upload.id,
      mux_asset_id: null,
      mux_playback_id: null,
      mux_status: 'preparing',
    })
    .eq('id', lessonId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)

  return { uploadUrl: upload.url, uploadId: upload.id }
}

export async function deleteMuxAsset(lessonId: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson) return { error: 'Lección no encontrada' }

  if (lesson.mux_asset_id) {
    try {
      await mux.video.assets.delete(lesson.mux_asset_id)
    } catch (err) {
      console.error('Failed to delete Mux asset:', err)
      // Continue: the asset may already be gone; clear fields regardless.
    }
  }

  const { error: dbErr } = await supabase
    .from('lessons')
    .update({
      mux_asset_id: null,
      mux_playback_id: null,
      mux_upload_id: null,
      mux_status: 'pending_upload',
    })
    .eq('id', lessonId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
  return { success: true as const }
}

export async function addMuxAudioTrack(
  lessonId: string,
  languageCode: string,
  name: string,
  fileUrl: string,
) {
  const langErr = validateLanguageCode(languageCode)
  if (langErr) return { error: langErr }

  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.mux_asset_id) return { error: 'La lección no tiene un asset de Mux listo.' }

  try {
    const track = await mux.video.assets.createTrack(
      lesson.mux_asset_id,
      buildAudioTrackPayload(fileUrl, languageCode, name),
    )
    revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
    return { trackId: track.id, status: track.status }
  } catch (err) {
    console.error('addMuxAudioTrack error:', err)
    return { error: 'No se pudo crear la pista de audio.' }
  }
}

export async function addMuxTextTrack(
  lessonId: string,
  languageCode: string,
  name: string,
  fileUrl: string,
) {
  const langErr = validateLanguageCode(languageCode)
  if (langErr) return { error: langErr }

  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.mux_asset_id) return { error: 'La lección no tiene un asset de Mux listo.' }

  try {
    const track = await mux.video.assets.createTrack(
      lesson.mux_asset_id,
      buildSubtitleTrackPayload(fileUrl, languageCode, name),
    )
    revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
    return { trackId: track.id, status: track.status }
  } catch (err) {
    console.error('addMuxTextTrack error:', err)
    return { error: 'No se pudo crear la pista de subtítulos.' }
  }
}

export async function deleteMuxTrack(lessonId: string, trackId: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.mux_asset_id) return { error: 'La lección no tiene un asset de Mux.' }

  try {
    await mux.video.assets.deleteTrack(lesson.mux_asset_id, trackId)
    revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
    return { success: true as const }
  } catch (err) {
    console.error('deleteMuxTrack error:', err)
    return { error: 'No se pudo eliminar la pista.' }
  }
}

export type MuxTrackSummary = {
  id: string
  type: 'audio' | 'text'
  languageCode: string | null
  name: string | null
  status: string | null
}

/**
 * Server-side helper (NOT a server action) to list tracks for an asset.
 * Called from admin page render. Not marked 'use server' — it's just an async function.
 */
export async function listMuxTracks(assetId: string): Promise<MuxTrackSummary[]> {
  try {
    const asset = await mux.video.assets.retrieve(assetId)
    const tracks = asset.tracks ?? []
    return tracks
      .filter(t => t.type === 'audio' || t.type === 'text')
      .map(t => ({
        id: t.id ?? '',
        type: t.type as 'audio' | 'text',
        languageCode: (t as { language_code?: string | null }).language_code ?? null,
        name: (t as { name?: string | null }).name ?? null,
        status: (t as { status?: string | null }).status ?? null,
      }))
  } catch (err) {
    console.error('listMuxTracks error:', err)
    return []
  }
}
