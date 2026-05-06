'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notify } from '@/utils/notifications/server'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'

export async function submitPost(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const rl = rateLimit(rateLimitKey([user.id, 'post']), 5, 60_000) // 5 posts/min
  if (!rl.ok) return

  if (!title || !content) {
    return
  }
  if (title.length > 200) {
    return
  }
  if (content.length > 10000) {
    return
  }

  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    title: title.trim(),
    content: content.trim(),
  })

  if (error) {
    return
  }

  revalidatePath('/community')
  redirect('/community')
}

export async function submitComment(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const postId = formData.get('postId') as string
  const content = formData.get('content') as string
  const parentId = (formData.get('parentId') as string | null) || null

  const rl = rateLimit(rateLimitKey([user.id, 'comment']), 30, 60_000) // 30 comments/min
  if (!rl.ok) return

  if (!postId || !content) {
    return
  }
  if (content.length > 5000) {
    return
  }

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({
      user_id: user.id,
      post_id: postId,
      content: content.trim(),
      parent_id: parentId,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return
  }

  // Notify post author only for top-level comments (replies notify the parent author below).
  if (!parentId) {
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (post) {
      await notify({
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
      await notify({
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
}
