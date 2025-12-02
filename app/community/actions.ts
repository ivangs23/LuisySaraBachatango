'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string

  if (!title || !content) {
    return { error: 'Title and content are required' }
  }

  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    title,
    content,
  })

  if (error) {
    console.error('Error creating post:', error)
    return { error: 'Failed to create post' }
  }

  revalidatePath('/community')
  redirect('/community')
}

export async function createComment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const postId = formData.get('postId') as string
  const content = formData.get('content') as string

  if (!postId || !content) {
    return { error: 'Content is required' }
  }

  const { error } = await supabase.from('comments').insert({
    user_id: user.id,
    post_id: postId,
    content,
  })

  if (error) {
    console.error('Error creating comment:', error)
    return { error: 'Failed to create comment' }
  }

  revalidatePath(`/community/${postId}`)
}
