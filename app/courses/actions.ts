'use server'

import { createClient } from '@/utils/supabase/server'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/utils/auth/require-admin'
import { hasCourseAccess } from '@/utils/auth/course-access'

export async function createLesson(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const order = parseInt(formData.get('order') as string)
  if (isNaN(order) || order < 1) return { error: 'El orden de la lección debe ser un número positivo' }
  if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
  if (description && description.length > 5000) return { error: 'description_too_long' }

  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const durationRaw = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const duration = durationRaw !== null && isNaN(durationRaw) ? null : durationRaw
  const isFree = formData.get('isFree') === 'on'
  const parentLessonId = (formData.get('parentLessonId') as string | null) || null

  const { data: inserted, error } = await supabase
    .from('lessons')
    .insert({
      course_id: courseId,
      title,
      description,
      "order": order,
      release_date: new Date().toISOString(),
      thumbnail_url: thumbnailUrl || null,
      duration,
      is_free: isFree,
      parent_lesson_id: parentLessonId,
      mux_status: 'pending_upload',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Create lesson error:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}`)
  revalidateTag(`course:${courseId}:lessons`, 'max')
  redirect(`/courses/${courseId}/${inserted.id}/edit`)
}

export async function updateLesson(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const lessonId = formData.get('lessonId') as string
  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const order = parseInt(formData.get('order') as string)
  if (isNaN(order) || order < 1) return { error: 'El orden de la lección debe ser un número positivo' }
  if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
  if (description && description.length > 5000) return { error: 'description_too_long' }
  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const durationRaw = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const duration = durationRaw !== null && isNaN(durationRaw) ? null : durationRaw
  const isFree = formData.get('isFree') === 'on'
  const parentLessonId = (formData.get('parentLessonId') as string | null) || null
  const expectedUpdatedAt = formData.get('expectedUpdatedAt') as string | null

  const update: Record<string, unknown> = {
    title,
    description,
    "order": order,
    duration,
    is_free: isFree,
    parent_lesson_id: parentLessonId,
    updated_at: new Date().toISOString(),
  }
  if (thumbnailUrl) update.thumbnail_url = thumbnailUrl

  let query = supabase
    .from('lessons')
    .update(update)
    .eq('id', lessonId)

  if (expectedUpdatedAt) {
    query = query.eq('updated_at', expectedUpdatedAt)
  }

  const { data, error } = await query.select('id').maybeSingle()

  if (error) {
    console.error('Update lesson error:', error)
    return { error: error.message }
  }

  if (expectedUpdatedAt && !data) {
    return { error: 'concurrent_update' }
  }

  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}/edit`)
  revalidateTag(`course:${courseId}:lessons`, 'max')
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
  await requireAdmin()
  const supabase = await createClient()

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

  if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
  if (description && description.length > 5000) return { error: 'description_too_long' }
  if (priceEur !== null && (priceEur < 0 || priceEur > 9999)) return { error: 'invalid_price' }
  if (year !== null && (year < 2020 || year > 2100)) return { error: 'invalid_year' }
  if (month !== null && (month < 1 || month > 12)) return { error: 'invalid_month' }

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
  await requireAdmin()
  const supabase = await createClient()

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

  if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
  if (description && description.length > 5000) return { error: 'description_too_long' }
  if (priceEur !== null && (priceEur < 0 || priceEur > 9999)) return { error: 'invalid_price' }
  if (year !== null && (year < 2020 || year > 2100)) return { error: 'invalid_year' }
  if (month !== null && (month < 1 || month > 12)) return { error: 'invalid_month' }

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
  await requireAdmin()
  if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
  if (description && description.length > 5000) return { error: 'description_too_long' }
  const supabase = await createClient()

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
  await requireAdmin()
  if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
  if (description && description.length > 5000) return { error: 'description_too_long' }
  const supabase = await createClient()

  // Ownership: confirm assignment belongs to lessonId.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return { error: 'assignment_not_found' }
  if (assignment.lesson_id !== lessonId) return { error: 'assignment_mismatch' }

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
  await requireAdmin()
  const supabase = await createClient()

  // Ownership: confirm assignment belongs to lessonId.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return { error: 'assignment_not_found' }
  if (assignment.lesson_id !== lessonId) return { error: 'assignment_mismatch' }

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

  // Resolve assignment → lesson → course and verify access.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id, lessons(course_id)')
    .eq('id', assignmentId)
    .single()

  const courseId = (assignment?.lessons as { course_id?: string } | null)?.course_id
  if (!courseId) {
    return { error: 'assignment_not_found' }
  }

  if (!(await hasCourseAccess(user.id, courseId))) {
    return { error: 'forbidden' }
  }

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
  const admin = await requireAdmin()
  const supabase = await createClient()

  // Verify submission belongs to the claimed courseId via:
  // submissions.assignment_id → assignments.lesson_id → lessons.course_id
  const { data: ownership } = await supabase
    .from('submissions')
    .select('assignments(lessons(course_id))')
    .eq('id', submissionId)
    .single()

  if (!ownership) {
    return { error: 'submission_not_found' }
  }

  const submissionCourseId =
    (ownership.assignments as { lessons?: { course_id?: string } } | null)
      ?.lessons?.course_id

  if (submissionCourseId !== courseId) {
    return { error: 'submission_mismatch' }
  }

  const { error } = await supabase
    .from('submissions')
    .update({ grade, feedback, status: 'reviewed', updated_at: new Date().toISOString() })
    .eq('id', submissionId)

  if (error) {
    console.error('Error grading submission:', error)
    return { error: error.message }
  }

  // Notify the student
  // Use admin client to bypass RLS (notifications has no INSERT policy for users).
  // UPSERT so re-grading updates the existing notification instead of conflicting on the dedupe unique index.
  const adminSupabase = createSupabaseAdmin()
  await adminSupabase.from('notifications').upsert(
    {
      user_id: submittedUserId,
      title: 'Tu tarea ha sido corregida',
      message: `El profesor ha revisado tu entrega. Calificación: ${grade || 'Sin nota'}`,
      type: 'assignment_graded',
      entity_type: 'submission',
      entity_id: submissionId,
      link: `/courses/${courseId}/${lessonId}`,
      actor_ids: [admin.id],
      is_read: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,type,entity_type,entity_id' }
  )

  revalidatePath(`/courses/${courseId}/${lessonId}/submissions`)
}

// ─── Assignment file upload ────────────────────────────────────────────────

const ALLOWED_SUBMISSION_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/webm',
]
const MAX_SUBMISSION_SIZE = 50 * 1024 * 1024 // 50 MB

export async function uploadAssignmentFile(
  assignmentId: string,
  file: File,
): Promise<{ fileUrl?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  if (!ALLOWED_SUBMISSION_TYPES.includes(file.type)) {
    return { error: 'unsupported_type' }
  }
  if (file.size > MAX_SUBMISSION_SIZE) {
    return { error: 'too_large' }
  }

  // Verify access via assignment → lesson → course chain.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id, lessons(course_id)')
    .eq('id', assignmentId)
    .single()

  const courseId = (assignment?.lessons as { course_id?: string } | null)?.course_id
  if (!courseId) return { error: 'assignment_not_found' }
  if (!(await hasCourseAccess(user.id, courseId))) return { error: 'forbidden' }

  // Sanitize extension: take only the last segment, alphanumeric+lowercase only.
  const rawExt = file.name.split('.').pop() ?? 'bin'
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  const fileName = `${user.id}/${assignmentId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('submissions')
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    console.error('uploadAssignmentFile error', uploadError)
    return { error: uploadError.message }
  }

  return { fileUrl: `storage://submissions/${fileName}` }
}

// ─── Lesson progress ───────────────────────────────────────────────────────

export async function markLessonAsCompleted(courseId: string, lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  if (!(await hasCourseAccess(user.id, courseId))) {
    return { error: 'forbidden' }
  }

  // Verify the lesson actually belongs to this course (defense in depth
  // against a forged courseId/lessonId pair where the user has access to
  // courseId but lessonId is in a different course).
  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson || lesson.course_id !== courseId) {
    return { error: 'lesson_mismatch' }
  }

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
