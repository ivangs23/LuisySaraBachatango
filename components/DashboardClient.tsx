'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Compass,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import AdminBanner from '@/components/admin/AdminBanner';
import styles from '@/app/dashboard/dashboard.module.css';
import coursesStyles from '@/app/courses/courses.module.css';
import cardStyles from '@/components/CoursesClient.module.css';

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

type CoursesPageDict = {
  months: string[];
  hasAccess: string;
  view: string;
  buy: string;
  viewMore: string;
  priceNA: string;
};

type DashboardDict = {
  title: string;
  empty: string;
  emptySub: string;
  discover: string;
  exploreAll: string;
};

type Props = {
  greetingName: string | null;
  myCourses: Course[];
  suggested: Course[];
  stats: {
    coursesCount: number;
    completedLessons: number;
    hasActiveSubscription: boolean;
  };
  role: 'member' | 'premium' | 'admin';
  t: DashboardDict;
  tc: CoursesPageDict;
};

const CATEGORY_LABELS: Record<string, string> = {
  bachatango: 'BachaTango',
  bachata: 'Bachata',
  tango: 'Tango',
  chachacha: 'Chachachá',
  otro: 'Otro',
};

function CourseCard({
  course,
  tc,
  accessible,
}: {
  course: Course;
  tc: CoursesPageDict;
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
            {course.course_type === 'membership' && course.month && course.year ? (
              <span>
                {tc.months[course.month - 1]} {course.year}
              </span>
            ) : (
              <span>{course.title}</span>
            )}
          </div>
        )}
        <div className={cardStyles.badgeOverlay}>
          {course.course_type === 'complete' && course.category && (
            <span className={cardStyles.badgeCategory}>
              {CATEGORY_LABELS[course.category] ?? course.category}
            </span>
          )}
          {accessible && (
            <span className={cardStyles.badgeAccess}>{tc.hasAccess}</span>
          )}
        </div>
      </div>

      <div className={coursesStyles.content}>
        <h3 className={coursesStyles.courseTitle}>{course.title}</h3>
        {course.course_type === 'membership' && course.month && course.year && (
          <p className={coursesStyles.courseDate}>
            {tc.months[course.month - 1]} {course.year}
          </p>
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

export default function DashboardClient({
  greetingName,
  myCourses,
  suggested,
  stats,
  role,
  t,
  tc,
}: Props) {
  const hour = new Date().getHours();
  const greeting =
    hour < 6
      ? 'Buenas noches'
      : hour < 13
      ? 'Buenos días'
      : hour < 20
      ? 'Buenas tardes'
      : 'Buenas noches';

  return (
    <div className={styles.container}>
      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal direction="left" distance={20}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              PANEL · ACCESO PRIVADO
            </span>
          </Reveal>

          {role === 'admin' && (
            <Reveal delay={0.02}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AdminBanner />
              </div>
            </Reveal>
          )}

          {greetingName && (
            <Reveal delay={0.05}>
              <p className={styles.greeting}>
                {greeting},
                <span className={styles.greetingName}>{greetingName}.</span>
              </p>
            </Reveal>
          )}

          <Reveal delay={0.1}>
            <h1 className={styles.title}>
              {t.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className={styles.titleAccent}>
                {t.title.split(' ').slice(-1)[0] ?? ''}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.15}>
            <p className={styles.heroSub}>
              Sigue donde lo dejaste, descubre lo último que hemos subido y
              guarda tu ritmo entre clases.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Mis cursos</span>
                  <span className={styles.statIcon} aria-hidden="true">
                    <GraduationCap size={14} strokeWidth={2.2} />
                  </span>
                </div>
                <div className={styles.statValue}>
                  <span className={styles.statValueAccent}>
                    {stats.coursesCount.toString().padStart(2, '0')}
                  </span>
                </div>
                <p className={styles.statHint}>
                  {stats.coursesCount === 1
                    ? 'Curso accesible'
                    : 'Cursos accesibles'}
                </p>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Lecciones</span>
                  <span className={styles.statIcon} aria-hidden="true">
                    <BookOpenCheck size={14} strokeWidth={2.2} />
                  </span>
                </div>
                <div className={styles.statValue}>
                  <span className={styles.statValueAccent}>
                    {stats.completedLessons.toString().padStart(2, '0')}
                  </span>
                </div>
                <p className={styles.statHint}>Completadas hasta hoy</p>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Suscripción</span>
                  <span className={styles.statIcon} aria-hidden="true">
                    <Sparkles size={14} strokeWidth={2.2} />
                  </span>
                </div>
                <div className={styles.statValue}>
                  <span
                    className={
                      stats.hasActiveSubscription
                        ? styles.statValueAccent
                        : ''
                    }
                  >
                    {stats.hasActiveSubscription ? 'Activa' : 'Sin plan'}
                  </span>
                </div>
                <p className={styles.statHint}>
                  {stats.hasActiveSubscription
                    ? 'Acceso al mes en curso'
                    : 'Suscríbete para acceder a las clases del mes'}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Body ===== */}
      <div className={styles.body}>
        {/* Mis cursos */}
        <section className={styles.section}>
          <Reveal>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleBlock}>
                <span className={styles.sectionEyebrow}>
                  <span className={styles.sectionEyebrowLine} aria-hidden="true" />
                  TU BIBLIOTECA
                </span>
                <h2 className={styles.sectionTitle}>
                  Mis <span className={styles.sectionTitleAccent}>cursos</span>
                  {myCourses.length > 0 && (
                    <span className={styles.sectionCount}>
                      ({myCourses.length})
                    </span>
                  )}
                </h2>
              </div>
              {myCourses.length > 0 && (
                <Link href="/courses" className={styles.sectionLink}>
                  Catálogo
                  <ArrowUpRight size={13} strokeWidth={2.6} aria-hidden="true" />
                </Link>
              )}
            </div>
          </Reveal>

          {myCourses.length > 0 ? (
            <div className={coursesStyles.grid}>
              {myCourses.map((course, i) => (
                <Reveal
                  key={course.id}
                  delay={Math.min(i * 0.05, 0.4)}
                  direction="up"
                  distance={20}
                >
                  <CourseCard course={course} tc={tc} accessible />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <div className={styles.emptyCard}>
                <div className={styles.emptyHalo} aria-hidden="true" />
                <span className={styles.emptyIcon} aria-hidden="true">
                  <Compass size={22} strokeWidth={1.8} />
                </span>
                <h3 className={styles.emptyTitle}>{t.empty}</h3>
                <p className={styles.emptyText}>{t.emptySub}</p>
                <Link href="/courses" className={styles.emptyCta}>
                  Ver catálogo
                  <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>
          )}
        </section>

        {/* Sugeridos */}
        {suggested.length > 0 && (
          <section className={styles.section}>
            <Reveal>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleBlock}>
                  <span className={styles.sectionEyebrow}>
                    <span
                      className={styles.sectionEyebrowLine}
                      aria-hidden="true"
                    />
                    SIGUE EXPLORANDO
                  </span>
                  <h2 className={styles.sectionTitle}>
                    {t.discover.split(' ')[0]}{' '}
                    <span className={styles.sectionTitleAccent}>
                      {t.discover.split(' ').slice(1).join(' ')}
                    </span>
                  </h2>
                </div>
                <Link href="/courses" className={styles.sectionLink}>
                  {t.exploreAll.replace('→', '').trim()}
                  <ArrowUpRight size={13} strokeWidth={2.6} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>

            <div className={coursesStyles.grid}>
              {suggested.map((course, i) => (
                <Reveal
                  key={course.id}
                  delay={Math.min(i * 0.05, 0.3)}
                  direction="up"
                  distance={20}
                >
                  <CourseCard course={course} tc={tc} accessible={false} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
