'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

export async function deletePost(postId: string) {
  await requireAdmin()
  if (!postId) throw new Error('postId required')
  const sb = createSupabaseAdmin()
  const { error } = await sb.from('posts').delete().eq('id', postId)
  if (error) throw error
  revalidatePath('/admin/comunidad')
}

export async function deleteComment(commentId: string) {
  await requireAdmin()
  if (!commentId) throw new Error('commentId required')
  const sb = createSupabaseAdmin()
  const { error } = await sb.from('comments').delete().eq('id', commentId)
  if (error) throw error
  revalidatePath('/admin/comunidad')
}
