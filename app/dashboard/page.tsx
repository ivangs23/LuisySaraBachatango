import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { getDict } from '@/utils/get-dict';
import DashboardClient from '@/components/DashboardClient';

type Course = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  month: number | null;
  year: number | null;
  course_type: 'membership' | 'complete';
  category: string | null;
  price_eur: number | null;
};

const getPublishedCourses = unstable_cache(
  async () => {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from('courses')
      .select('id, title, description, image_url, month, year, course_type, category, price_eur, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as (Course & { created_at: string })[];
  },
  ['dashboard-courses'],
  { revalidate: 300, tags: ['courses'] },
);

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const t = await getDict();
  const courses = await getPublishedCourses();

  const [
    purchasesResult,
    subscriptionsResult,
    profileResult,
    completedResult,
  ] = await Promise.all([
    supabase.from('course_purchases').select('course_id').eq('user_id', user.id),
    supabase
      .from('subscriptions')
      .select('status, current_period_start, current_period_end')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing']),
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase
      .from('lesson_progress')
      .select('lesson_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', true),
  ]);

  const accessibleIds = new Set<string>();
  purchasesResult.data?.forEach((p: { course_id: string }) => accessibleIds.add(p.course_id));

  const subscriptions = subscriptionsResult.data ?? [];
  const hasActiveSubscription = subscriptions.length > 0;

  if (hasActiveSubscription) {
    for (const course of courses) {
      if (course.course_type !== 'membership') continue;
      if (accessibleIds.has(course.id)) continue;
      if (!course.year || !course.month) continue;

      const firstDay = new Date(Date.UTC(course.year, course.month - 1, 1));
      const lastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59));

      const covered = subscriptions.some((sub: { current_period_start: string | null; current_period_end: string | null }) => {
        if (!sub.current_period_start || !sub.current_period_end) return false;
        const start = new Date(sub.current_period_start);
        const end = new Date(sub.current_period_end);
        return start <= lastDay && end >= firstDay;
      });

      if (covered) accessibleIds.add(course.id);
    }
  }

  const myCourses = courses.filter(c => accessibleIds.has(c.id));
  const suggested = courses
    .filter(c => !accessibleIds.has(c.id) && c.course_type === 'complete')
    .slice(0, 3);

  const fullName = (profileResult.data?.full_name as string | null) ?? null;
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;
  const role = (profileResult.data?.role as 'member' | 'premium' | 'admin' | undefined) ?? 'member';

  return (
    <DashboardClient
      greetingName={firstName}
      myCourses={myCourses}
      suggested={suggested}
      stats={{
        coursesCount: myCourses.length,
        completedLessons: completedResult.count ?? 0,
        hasActiveSubscription,
      }}
      role={role}
      t={t.dashboard}
      tc={t.coursesPage}
    />
  );
}
