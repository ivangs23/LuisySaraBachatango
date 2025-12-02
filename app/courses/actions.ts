'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createLesson(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify Admin Role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized: Only admins can add lessons')
  }

  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const videoUrl = formData.get('videoUrl') as string
  const order = parseInt(formData.get('order') as string)
  
  // New fields
  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const videoSource = formData.get('videoSource') as 'url' | 'upload'
  const duration = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const isFree = formData.get('isFree') === 'on'

  const { error } = await supabase
    .from('lessons')
    .insert({
      course_id: courseId,
      title,
      description,
      video_url: videoUrl,
      "order": order,
      release_date: new Date().toISOString(),
      thumbnail_url: thumbnailUrl,
      video_source: videoSource,
      duration: duration,
      is_free: isFree
    })

  if (error) {
    console.error('Create lesson error:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}`)
  redirect(`/courses/${courseId}`)
}
