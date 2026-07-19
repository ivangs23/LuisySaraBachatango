import { createClient } from '@/utils/supabase/server';
import { hasCourseAccess } from '@/utils/auth/course-access';
import { rateLimit, rateLimitKey } from '@/utils/rate-limit';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Rate limit por usuario: la ruta encadena una query de lessons + hasCourseAccess
  // (2-3 queries más) en cada GET. Era el único endpoint autenticado sin límite
  // (AUDITORIA-2026-07 B4).
  const rl = await rateLimit(rateLimitKey([user.id, 'lessons-next']), 30, 60_000);
  if (!rl.ok) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter) },
    });
  }

  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(now.getDate() - 3);

  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('id, title, order, release_date, course_id, thumbnail_url, is_free, courses!inner(is_published)')
    .eq('courses.is_published', true)
    .gte('release_date', threeDaysAgo.toISOString())
    .lte('release_date', next24Hours.toISOString())
    .order('release_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !lesson) {
    return NextResponse.json(null);
  }

  if (!lesson.is_free && !(await hasCourseAccess(user.id, lesson.course_id))) {
    return NextResponse.json(null);
  }

  return NextResponse.json(lesson);
}
