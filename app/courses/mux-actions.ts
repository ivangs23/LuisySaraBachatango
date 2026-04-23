'use server'

import { createClient } from '@/utils/supabase/server'
import { mux } from '@/utils/mux/server'
import { buildDirectUploadParams } from '@/utils/mux/validation'
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
