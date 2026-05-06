'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { notify } from '@/utils/notifications/server'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import type { ActionResult } from '@/utils/actions/result'

export async function submitPost(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'auth' }
  }

  const rl = await rateLimit(rateLimitKey([user.id, 'post']), 5, 60_000) // 5 posts/min
  if (!rl.ok) return { success: false, error: 'rate_limit' }

  const title = ((formData.get('title') as string | null) ?? '').trim()
  const content = ((formData.get('content') as string | null) ?? '').trim()

  if (!title || !content) {
    return { success: false, error: 'Campos obligatorios.' }
  }
  if (title.length > 200) {
    return { success: false, error: 'Título demasiado largo.' }
  }
  if (content.length > 10000) {
    return { success: false, error: 'Contenido demasiado largo.' }
  }

  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    title,
    content,
  })

  if (error) {
    return { success: false, error: 'No se pudo crear el post.' }
  }

  revalidatePath('/community')
  return { success: true }
}

export async function submitComment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'auth' }
  }

  const postId = (formData.get('postId') as string | null) ?? ''
  const content = ((formData.get('content') as string | null) ?? '').trim()
  const parentId = (formData.get('parentId') as string | null) || null

  const rl = await rateLimit(rateLimitKey([user.id, 'comment']), 30, 60_000) // 30 comments/min
  if (!rl.ok) return { success: false, error: 'rate_limit' }

  if (!postId || !content) {
    return { success: false, error: 'Campos obligatorios.' }
  }
  if (content.length > 5000) {
    return { success: false, error: 'Comentario demasiado largo.' }
  }

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({
      user_id: user.id,
      post_id: postId,
      content,
      parent_id: parentId,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { success: false, error: 'No se pudo publicar el comentario.' }
  }

  // Notify post author only for top-level comments (replies notify the parent author below).
  // Notification failures are intentionally ignored — they must not fail the comment.
  if (!parentId) {
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (post) {
      void notify({
        recipientId: post.user_id,
        actorId: user.id,
        type: 'post_comment',
        entityType: 'post',
        entityId: postId,
        link: `/community/${postId}#comment-${inserted.id}`,
      })
    }
  }

  if (parentId) {
    const { data: parent } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', parentId)
      .single()

    if (parent) {
      void notify({
        recipientId: parent.user_id,
        actorId: user.id,
        type: 'comment_reply',
        entityType: 'comment',
        entityId: inserted.id,
        link: `/community/${postId}#comment-${inserted.id}`,
      })
    }
  }

  revalidatePath(`/community/${postId}`)
  return { success: true }
}
