import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import styles from './dashboard.module.css';
import coursesStyles from '@/app/courses/courses.module.css';
import cardStyles from '@/components/CoursesClient.module.css';
import { getDict } from '@/utils/get-dict';

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

const CATEGORY_LABELS: Record<string, string> = {
  bachatango: 'BachaTango',
  bachata:    'Bachata',
  tango:      'Tango',
  chachacha:  'Chachachá',
  otro:       'Otro',
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

function CourseCard({
  course,
  tc,
  accessible,
}: {
  course: Course;
  tc: Awaited<ReturnType<typeof getDict>>['coursesPage'];
  accessible: boolean;
}) {
  return (
    <Link href={`/courses/${course.id}`} className={coursesStyles.card}>
      <div className={coursesStyles.imageContainer}>
        {course.image_url?.startsWith('http') ? (
          <Image
            src={course.image_url}
            alt={course.title}
            className={coursesStyles.image}
            width={400}
            height={225}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className={coursesStyles.placeholderImage}>
            {course.course_type === 'membership' && course.month && course.year
              ? <span>{tc.months[course.month - 1]} {course.year}</span>
              : <span>{course.title}</span>}
          </div>
        )}
        <div className={cardStyles.badgeOverlay}>
          {course.course_type === 'complete' && course.category && (
            <span className={cardStyles.badgeCategory}>
              {CATEGORY_LABELS[course.category] ?? course.category}
            </span>
          )}
          {accessible && <span className={cardStyles.badgeAccess}>{tc.hasAccess}</span>}
        </div>
      </div>

      <div className={coursesStyles.content}>
        <h2 className={coursesStyles.courseTitle}>{course.title}</h2>
        {course.course_type === 'membership' && course.month && course.year && (
          <p className={coursesStyles.courseDate}>{tc.months[course.month - 1]} {course.year}</p>
        )}
        <p className={coursesStyles.description}>{course.description}</p>
        <div className={cardStyles.cardFooter}>
          {!accessible && (
            <span className={cardStyles.priceTag}>
              {course.price_eur ? `€${course.price_eur}` : tc.priceNA}
            </span>
          )}
          <span className={coursesStyles.cta}>
            {accessible ? tc.view : course.price_eur ? tc.buy : tc.viewMore}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const t = await getDict();
  const courses = await getPublishedCourses();

  const [purchasesResult, subscriptionsResult] = await Promise.all([
    supabase.from('course_purchases').select('course_id').eq('user_id', user.id),
    supabase
      .from('subscriptions')
      .select('current_period_start, current_period_end')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing']),
  ]);

  const accessibleIds = new Set<string>();
  purchasesResult.data?.forEach(p => accessibleIds.add(p.course_id));

  const subscriptions = subscriptionsResult.data ?? [];
  if (subscriptions.length > 0) {
    for (const course of courses) {
      if (course.course_type !== 'membership') continue;
      if (accessibleIds.has(course.id)) continue;
      if (!course.year || !course.month) continue;

      const firstDay = new Date(Date.UTC(course.year, course.month - 1, 1));
      const lastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59));

      const covered = subscriptions.some(sub => {
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.dashboard.title}</h1>
      </div>

      {myCourses.length > 0 ? (
        <section className={styles.section}>
          <div className={coursesStyles.grid}>
            {myCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                tc={t.coursesPage}
                accessible
              />
            ))}
          </div>
        </section>
      ) : (
        <div className={coursesStyles.emptyState}>
          <p>{t.dashboard.empty}</p>
          <p className={coursesStyles.subtext}>{t.dashboard.emptySub}</p>
        </div>
      )}

      {suggested.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t.dashboard.discover}</h2>
            <Link href="/courses" className={styles.sectionLink}>
              {t.dashboard.exploreAll}
            </Link>
          </div>
          <div className={coursesStyles.grid}>
            {suggested.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                tc={t.coursesPage}
                accessible={false}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
