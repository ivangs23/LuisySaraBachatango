import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/utils/rate-limit'

// 30 signed-URL requests per user per minute — protects Supabase from flood.
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params
  const courseId = new URL(req.url).searchParams.get('courseId')

  if (!courseId) {
    return new NextResponse('Bad Request: courseId is required', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Rate limit per user — keyed by userId so it's not spoofable via IP header manipulation.
  if (!checkRateLimit(`video:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  // Fetch lesson and profile in parallel — both only need IDs we already have.
  const [{ data: lesson }, { data: profile }] = await Promise.all([
    supabase.from('lessons')
      .select('video_url, course_id')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!lesson) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    // Check purchase and course metadata in parallel.
    const [{ data: purchase }, { data: course }] = await Promise.all([
      supabase.from('course_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', lesson.course_id)
        .maybeSingle(),
      supabase.from('courses')
        .select('month, year')
        .eq('id', lesson.course_id)
        .single(),
    ])

    if (!purchase) {
      let hasSubscription = false
      if (course?.month && course?.year) {
        const courseFirstDay = new Date(Date.UTC(course.year, course.month - 1, 1)).toISOString()
        const courseLastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59)).toISOString()

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .lte('current_period_start', courseLastDay)
          .gte('current_period_end', courseFirstDay)
          .maybeSingle()

        hasSubscription = !!sub
      }

      if (!hasSubscription) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }
  }

  if (!lesson.video_url?.startsWith('storage://')) {
    return new NextResponse('Not a storage video', { status: 400 })
  }

  const path = lesson.video_url.replace('storage://', '')

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabaseAdmin.storage
    .from('course-content')
    .createSignedUrl(path, 300) // 5-minute expiry

  if (error || !data?.signedUrl) {
    console.error('Error creating signed URL:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: { 'Cache-Control': 'no-store' },
  })
}
