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
  if (isNaN(order) || order < 1) return { error: 'El orden de la lección debe ser un número positivo' }

  // New fields
  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const videoSource = formData.get('videoSource') as 'url' | 'upload'
  const durationRaw = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const duration = durationRaw !== null && isNaN(durationRaw) ? null : durationRaw
  const isFree = formData.get('isFree') === 'on'
  const mediaConfigStr = formData.get('mediaConfig') as string
  let mediaConfig = {}
  if (mediaConfigStr) {
    try {
      mediaConfig = JSON.parse(mediaConfigStr)
    } catch {
      return { error: 'Configuración de media inválida' }
    }
  }

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
      is_free: isFree,
      media_config: mediaConfig // Save media_config
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
  if (isNaN(order) || order < 1) return { error: 'El orden de la lección debe ser un número positivo' }
  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const videoSource = formData.get('videoSource') as 'url' | 'upload'
  const durationRaw = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const duration = durationRaw !== null && isNaN(durationRaw) ? null : durationRaw
  const isFree = formData.get('isFree') === 'on'
  const mediaConfigStr = formData.get('mediaConfig') as string
  let mediaConfig = null
  if (mediaConfigStr) {
    try {
      mediaConfig = JSON.parse(mediaConfigStr)
    } catch {
      return { error: 'Configuración de media inválida' }
    }
  }

  type MediaConfig = {
    tracks: { language: string; label: string; url: string }[];
    subtitles: { language: string; label: string; url: string }[];
  };

  type LessonUpdateData = {
    title: string;
    description: string;
    video_url: string;
    "order": number;
    video_source: 'url' | 'upload';
    duration: number | null;
    is_free: boolean;
    thumbnail_url?: string;
    media_config?: MediaConfig;
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

  if (mediaConfig) {
    updateData.media_config = mediaConfig
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

async function uploadCourseImage(supabase: Awaited<ReturnType<typeof createClient>>, imageFile: File): Promise<{ url: string } | { error: string }> {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB

  if (!ALLOWED_TYPES.includes(imageFile.type)) {
    return { error: 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).' }
  }
  if (imageFile.size > MAX_SIZE) {
    return { error: 'El archivo es demasiado grande. El tamaño máximo es 5MB.' }
  }

  const fileExt = imageFile.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${fileExt}`
  const filePath = `course-covers/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('thumbnails')
    .upload(filePath, imageFile)

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(filePath)
  return { url: publicUrl }
}

export async function createCourse(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized: Only admins can create courses')

  const courseType = (formData.get('courseType') as string) || 'membership'
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const isPublished = formData.get('isPublished') === 'on'
  const imageFile = formData.get('image') as File
  const priceEurRaw = formData.get('priceEur') as string
  const category = (formData.get('category') as string) || null

  const yearRaw = formData.get('year') as string
  const monthRaw = formData.get('month') as string
  const year = yearRaw ? parseInt(yearRaw) : null
  const month = monthRaw ? parseInt(monthRaw) : null
  const priceEur = priceEurRaw ? parseInt(priceEurRaw) : null

  let imageUrl = ''
  if (imageFile && imageFile.size > 0) {
    const result = await uploadCourseImage(supabase, imageFile)
    if ('error' in result) return { error: result.error }
    imageUrl = result.url
  }

  const { error } = await supabase.from('courses').insert({
    title,
    description,
    year,
    month,
    is_published: isPublished,
    image_url: imageUrl,
    course_type: courseType,
    category,
    price_eur: priceEur,
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
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized: Only admins can edit courses')

  const courseId = formData.get('courseId') as string
  const courseType = (formData.get('courseType') as string) || 'membership'
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const isPublished = formData.get('isPublished') === 'on'
  const imageFile = formData.get('image') as File
  const imageUrlProp = (formData.get('imageUrl') as string) || ''
  const priceEurRaw = formData.get('priceEur') as string
  const category = (formData.get('category') as string) || null

  const yearRaw = formData.get('year') as string
  const monthRaw = formData.get('month') as string
  const year = yearRaw ? parseInt(yearRaw) : null
  const month = monthRaw ? parseInt(monthRaw) : null
  const priceEur = priceEurRaw ? parseInt(priceEurRaw) : null

  let imageUrl = imageUrlProp
  if (imageFile && imageFile.size > 0) {
    const result = await uploadCourseImage(supabase, imageFile)
    if ('error' in result) return { error: result.error }
    imageUrl = result.url
  }

  const { error } = await supabase
    .from('courses')
    .update({
      title,
      description,
      year,
      month,
      is_published: isPublished,
      image_url: imageUrl,
      course_type: courseType,
      category,
      price_eur: priceEur,
    })
    .eq('id', courseId)

  if (error) {
    console.error('Update course error:', error)
    return { error: error.message }
  }

  revalidatePath('/courses')
  revalidatePath(`/courses/${courseId}`)
  redirect(`/courses/${courseId}`)
}

// ─── Assignment actions ──────────────────────────────────────────────��─────

export async function createAssignment(lessonId: string, courseId: string, title: string, description: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  // Verify the lesson actually belongs to this course
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!lesson) throw new Error('Lesson not found in this course')

  const { error } = await supabase
    .from('assignments')
    .insert({ lesson_id: lessonId, course_id: courseId, title, description })

  if (error) {
    console.error('Error creating assignment:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}/${lessonId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}/edit`)
}

export async function updateAssignment(assignmentId: string, title: string, description: string, courseId: string, lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('assignments')
    .update({ title, description })
    .eq('id', assignmentId)

  if (error) {
    console.error('Error updating assignment:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}/${lessonId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}/edit`)
}

export async function deleteAssignment(assignmentId: string, courseId: string, lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)

  if (error) {
    console.error('Error deleting assignment:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}/${lessonId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}/edit`)
}

// ─── Submission actions ────────────────────────────────────────────────────

export async function submitAssignment(assignmentId: string, textContent: string, fileUrl: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('submissions')
    .upsert({
      assignment_id: assignmentId,
      user_id: user.id,
      text_content: textContent || null,
      file_url: fileUrl,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('Error submitting assignment:', error)
    return { error: error.message }
  }

  return { success: true }
}

export async function gradeSubmission(
  submissionId: string,
  grade: string,
  feedback: string,
  courseId: string,
  lessonId: string,
  submittedUserId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('submissions')
    .update({ grade, feedback, status: 'reviewed', updated_at: new Date().toISOString() })
    .eq('id', submissionId)

  if (error) {
    console.error('Error grading submission:', error)
    return { error: error.message }
  }

  // Notify the student
  await supabase.from('notifications').insert({
    user_id: submittedUserId,
    title: 'Tu tarea ha sido corregida',
    message: `El profesor ha revisado tu entrega. Calificación: ${grade || 'Sin nota'}`,
  })

  revalidatePath(`/courses/${courseId}/${lessonId}/submissions`)
}

// ─── Lesson progress ───────────────────────────────────────────────────────

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
