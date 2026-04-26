'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import styles from './CoursesClient.module.css';
import Reveal from './Reveal';
import { useLanguage } from '@/context/LanguageContext';

const CATEGORY_LABELS: Record<string, string> = {
  bachatango: 'BachaTango',
  bachata:    'Bachata',
  tango:      'Tango',
  chachacha:  'Chachachá',
  otro:       'Otro',
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  month: number | null;
  year: number | null;
  is_published: boolean;
  course_type: 'membership' | 'complete';
  category: string | null;
  price_eur: number | null;
  stripe_price_id: string | null;
};

type Props = {
  courses: Course[];
  isAdmin: boolean;
  accessibleCourseIds: string[];
};

type Dict = typeof import('@/utils/dictionaries').dictionaries['es']['coursesPage'];

type CourseCardProps = {
  course: Course;
  accessible: boolean;
  index: number;
  tc: Dict;
  variant: 'complete' | 'membership';
};

function CourseCard({ course, accessible, index, tc, variant }: CourseCardProps) {
  const isMembership = variant === 'membership';
  const monthLabel =
    isMembership && course.month && course.year
      ? `${tc.months[course.month - 1]} ${course.year}`
      : null;
  const categoryLabel =
    course.category && CATEGORY_LABELS[course.category]
      ? CATEGORY_LABELS[course.category]
      : course.category ?? null;

  return (
    <Link href={`/courses/${course.id}`} className={styles.card} aria-label={course.title}>
      {/* Index editorial */}
      <span className={styles.cardIndex} aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Imagen con ken-burns + overlays */}
      <div className={styles.imageContainer}>
        {course.image_url?.startsWith('http') ? (
          <Image
            src={course.image_url}
            alt={course.title}
            className={styles.image}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.placeholderImage}>
            <span>{monthLabel ?? course.title}</span>
          </div>
        )}

        {/* Gradiente inferior (siempre visible, se intensifica al hover) */}
        <span className={styles.imageGradient} aria-hidden="true" />

        {/* Esquinas decorativas */}
        <span className={styles.cornerTL} aria-hidden="true" />
        <span className={styles.cornerBR} aria-hidden="true" />

        {/* Badges arriba */}
        <div className={styles.badgeOverlay}>
          <div className={styles.badgesLeft}>
            <span className={`${styles.badgeType} ${isMembership ? styles.badgeTypeMonthly : styles.badgeTypeComplete}`}>
              {isMembership ? tc.monthlyClasses.toUpperCase() : 'COMPLETO'}
            </span>
            {!isMembership && categoryLabel && (
              <span className={styles.badgeCategory}>{categoryLabel}</span>
            )}
          </div>
          {accessible && <span className={styles.badgeAccess}>{tc.hasAccess}</span>}
        </div>

        {/* Pie sobre imagen: meta info que aparece reforzada al hover */}
        <div className={styles.imageFooter}>
          {monthLabel && <span className={styles.imageFooterMeta}>{monthLabel}</span>}
        </div>
      </div>

      {/* Contenido */}
      <div className={styles.content}>
        <h3 className={styles.courseTitle}>{course.title}</h3>
        {course.description && (
          <p className={styles.description}>{course.description}</p>
        )}

        <div className={styles.cardFooter}>
          <span className={styles.priceTag}>
            {accessible
              ? tc.hasAccess
              : course.price_eur != null
                ? <><span className={styles.priceCurrency}>€</span>{course.price_eur}</>
                : tc.priceNA}
          </span>
          <span className={styles.cta}>
            {accessible ? tc.view : course.price_eur != null ? tc.buy : tc.viewMore}
            <span className={styles.ctaArrow} aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function CoursesClient({ courses, isAdmin, accessibleCourseIds }: Props) {
  const { t } = useLanguage();
  const tc = t.coursesPage;
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const completeCourses = useMemo(
    () => courses.filter(c => c.course_type === 'complete'),
    [courses],
  );
  const membershipCourses = useMemo(
    () => courses.filter(c => c.course_type === 'membership'),
    [courses],
  );

  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(completeCourses.map(c => c.category).filter(Boolean) as string[]),
    );
    return ['all', ...cats];
  }, [completeCourses]);

  const filteredComplete = useMemo(
    () =>
      categoryFilter === 'all'
        ? completeCourses
        : completeCourses.filter(c => c.category === categoryFilter),
    [completeCourses, categoryFilter],
  );

  const totalCount = courses.length;

  return (
    <div className={styles.container}>
      {/* Header / hero pequeño */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Reveal direction="left" distance={32}>
            <span className={styles.headerEyebrow}>
              <span className={styles.headerKickerLine} aria-hidden="true" />
              CATÁLOGO · {totalCount} {totalCount === 1 ? 'CURSO' : 'CURSOS'}
            </span>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className={styles.headerTitle}>{tc.title}</h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className={styles.headerSub}>
              {tc.completeSub} · {tc.monthlySub}
            </p>
          </Reveal>
        </div>

        {isAdmin && (
          <Reveal direction="right" delay={0.15}>
            <Link href="/courses/create" className={styles.createButton}>
              {tc.create}
            </Link>
          </Reveal>
        )}
      </header>

      {courses.length === 0 && (
        <Reveal>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">⏳</div>
            <p className={styles.emptyTitle}>{tc.empty}</p>
            <p className={styles.emptySub}>{tc.emptySub}</p>
          </div>
        </Reveal>
      )}

      {/* ── Cursos Completos ───────────────────────────────────────── */}
      {completeCourses.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Reveal>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNum}>01</span>
                <div>
                  <h2 className={styles.sectionTitle}>{tc.completeCourses}</h2>
                  <p className={styles.sectionSub}>{tc.completeSub}</p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Filtros con indicator deslizante */}
          {categories.length > 2 && (
            <Reveal>
              <LayoutGroup id="course-filters">
                <div className={styles.filters} role="tablist" aria-label="Filtrar por categoría">
                  {categories.map(cat => {
                    const active = categoryFilter === cat;
                    const label = cat === 'all' ? tc.filterAll : (CATEGORY_LABELS[cat] ?? cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setCategoryFilter(cat)}
                        className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`}
                      >
                        {active && (
                          <motion.span
                            layoutId="filter-indicator"
                            className={styles.filterIndicator}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span className={styles.filterBtnLabel}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </Reveal>
          )}

          <div className={styles.grid}>
            {filteredComplete.map((course, i) => (
              <Reveal key={course.id} delay={Math.min(i * 0.06, 0.36)}>
                <CourseCard
                  course={course}
                  accessible={accessibleCourseIds.includes(course.id)}
                  index={i}
                  tc={tc}
                  variant="complete"
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Clases Mensuales (membership) ──────────────────────────── */}
      {membershipCourses.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Reveal>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNum}>02</span>
                <div>
                  <h2 className={styles.sectionTitle}>{tc.monthlyClasses}</h2>
                  <p className={styles.sectionSub}>{tc.monthlySub}</p>
                </div>
              </div>
            </Reveal>
          </div>

          <div className={styles.grid}>
            {membershipCourses.map((course, i) => (
              <Reveal key={course.id} delay={Math.min(i * 0.06, 0.36)}>
                <CourseCard
                  course={course}
                  accessible={accessibleCourseIds.includes(course.id)}
                  index={i}
                  tc={tc}
                  variant="membership"
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
