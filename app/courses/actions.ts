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

export async function updateLesson(formData: FormData) {
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
    throw new Error('Unauthorized: Only admins can edit lessons')
  }

  const lessonId = formData.get('lessonId') as string
  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const videoUrl = formData.get('videoUrl') as string
  const order = parseInt(formData.get('order') as string)
  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const videoSource = formData.get('videoSource') as 'url' | 'upload'
  const duration = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const isFree = formData.get('isFree') === 'on'

  type LessonUpdateData = {
    title: string;
    description: string;
    video_url: string;
    "order": number;
    video_source: 'url' | 'upload';
    duration: number | null;
    is_free: boolean;
    thumbnail_url?: string;
  };

  const updateData: LessonUpdateData = {
    title,
    description,
    video_url: videoUrl,
    "order": order,
    video_source: videoSource,
    duration: duration,
    is_free: isFree
  }

  // Only update thumbnail if a new one is provided
  if (thumbnailUrl) {
    updateData.thumbnail_url = thumbnailUrl
  }

  const { error } = await supabase
    .from('lessons')
    .update(updateData)
    .eq('id', lessonId)

  if (error) {
    console.error('Update lesson error:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}`)
  redirect(`/courses/${courseId}`) // Or back to lesson detail? course list seems safer.
}

export async function createCourse(formData: FormData) {
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
    throw new Error('Unauthorized: Only admins can create courses')
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const year = parseInt(formData.get('year') as string)
  const month = parseInt(formData.get('month') as string)
  const isPublished = formData.get('isPublished') === 'on'
  const imageFile = formData.get('image') as File

  let imageUrl = ''

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `course-covers/${fileName}`

    // Ensure bucket exists or use a common one. 'thumbnails' might be okay, or create 'courses'.
    // Existing buckets: 'thumbnails', 'course-content'. 
    // Let's use 'thumbnails' for course covers for now as it makes sense for public images.
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, imageFile)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: uploadError.message }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(filePath)
    
    imageUrl = publicUrl
  }

  const { error } = await supabase
    .from('courses')
    .insert({
      title,
      description,
      year,
      month,
      is_published: isPublished,
      image_url: imageUrl
    })

  if (error) {
    console.error('Create course error:', error)
    return { error: error.message }
  }

  revalidatePath('/courses')
  redirect('/courses')
}

export async function updateCourse(formData: FormData) {
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
    throw new Error('Unauthorized: Only admins can edit courses')
  }

  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const year = parseInt(formData.get('year') as string)
  const month = parseInt(formData.get('month') as string)
  const isPublished = formData.get('isPublished') === 'on'
  const imageFile = formData.get('image') as File
  const imageUrlProp = formData.get('imageUrl') as string

  let imageUrl = imageUrlProp

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `course-covers/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, imageFile)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: uploadError.message }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(filePath)
    
    imageUrl = publicUrl
  }

  const { error } = await supabase
    .from('courses')
    .update({
      title,
      description,
      year,
      month,
      is_published: isPublished,
      image_url: imageUrl
    })
    .eq('id', courseId)

  if (error) {
    console.error('Update course error:', error)
    return { error: error.message }
  }

  revalidatePath('/courses')
  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/courses/${courseId}`)
  redirect(`/courses/${courseId}`)
}

export async function markLessonAsCompleted(courseId: string, lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: user.id,
      lesson_id: lessonId,
      is_completed: true,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error marking lesson complete:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}/${lessonId}`)
  revalidatePath(`/courses/${courseId}`)
}
