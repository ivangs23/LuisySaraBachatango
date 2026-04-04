import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(now.getDate() - 3);

  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('id, title, order, release_date, course_id, thumbnail_url, is_free')
    .gte('release_date', threeDaysAgo.toISOString())
    .lte('release_date', next24Hours.toISOString())
    .order('release_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(null);
  }

  return NextResponse.json(lesson);
}
