'use server'

import { createClient } from '@/utils/supabase/server'
import { notify } from '@/utils/notifications/server'
import { revalidatePath } from 'next/cache'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'

export async function togglePostLike(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Debes iniciar sesión' }
  }

  const rl = await rateLimit(rateLimitKey([user.id, 'post-like']), 60, 60_000)
  if (!rl.ok) {
    return { error: 'rate_limit' }
  }

  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id)
    revalidatePath(`/community/${postId}`)
    return { success: true, liked: false }
  }

  await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })

  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (post) {
    void notify({
      recipientId: post.user_id,
      actorId: user.id,
      type: 'post_like',
      entityType: 'post',
      entityId: postId,
      link: `/community/${postId}`,
    }).catch(err => console.error('notify failed', err))
  }

  revalidatePath(`/community/${postId}`)
  return { success: true, liked: true }
}
