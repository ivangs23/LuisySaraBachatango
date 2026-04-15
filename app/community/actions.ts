'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitPost(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string

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

  if (!postId || !content) {
    return
  }
  if (content.length > 5000) {
    return
  }

  const { error } = await supabase.from('comments').insert({
    user_id: user.id,
    post_id: postId,
    content: content.trim(),
  })

  if (error) {
    return
  }

  revalidatePath(`/community/${postId}`)
}
