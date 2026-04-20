'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import styles from '@/app/courses/courses.module.css';
import cardStyles from './CoursesClient.module.css';
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

type CourseCardProps = {
  course: Course;
  accessible: boolean;
  tc: typeof import('@/utils/dictionaries').dictionaries['es']['coursesPage'];
};

function CourseCard({ course, accessible, tc }: CourseCardProps) {
  return (
    <Link href={`/courses/${course.id}`} className={styles.card}>
      <div className={styles.imageContainer}>
        {course.image_url?.startsWith('http') ? (
          <Image
            src={course.image_url}
            alt={course.title}
            className={styles.image}
            width={400}
            height={225}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className={styles.placeholderImage}>
            {course.course_type === 'membership' && course.month && course.year
              ? <span>{tc.months[course.month - 1]} {course.year}</span>
              : <span>{course.title}</span>
            }
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

      <div className={styles.content}>
        <h2 className={styles.courseTitle}>{course.title}</h2>
        {course.course_type === 'membership' && course.month && course.year && (
          <p className={styles.courseDate}>{tc.months[course.month - 1]} {course.year}</p>
        )}
        <p className={styles.description}>{course.description}</p>
        <div className={cardStyles.cardFooter}>
          {!accessible && (
            <span className={cardStyles.priceTag}>
              {course.price_eur ? `€${course.price_eur}` : tc.priceNA}
            </span>
          )}
          <span className={styles.cta}>
            {accessible ? tc.view : course.price_eur ? tc.buy : tc.viewMore}
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

  const completeCourses = courses.filter(c => c.course_type === 'complete');
  const membershipCourses = courses.filter(c => c.course_type === 'membership');

  const categories = ['all', ...Array.from(new Set(completeCourses.map(c => c.category).filter(Boolean) as string[]))];

  const filteredComplete = categoryFilter === 'all'
    ? completeCourses
    : completeCourses.filter(c => c.category === categoryFilter);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{tc.title}</h1>
        {isAdmin && (
          <Link href="/courses/create" className={styles.createButton}>
            {tc.create}
          </Link>
        )}
      </div>

      {courses.length === 0 && (
        <div className={styles.emptyState}>
          <p>{tc.empty}</p>
          <p className={styles.subtext}>{tc.emptySub}</p>
        </div>
      )}

      {/* ── Cursos Completos ───────────────────────────────────────── */}
      {completeCourses.length > 0 && (
        <section className={cardStyles.section}>
          <div className={cardStyles.sectionHeader}>
            <h2 className={cardStyles.sectionTitle}>{tc.completeCourses}</h2>
            <p className={cardStyles.sectionSub}>{tc.completeSub}</p>
          </div>

          {/* Category filter */}
          {categories.length > 2 && (
            <div className={cardStyles.filters}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`${cardStyles.filterBtn} ${categoryFilter === cat ? cardStyles.filterBtnActive : ''}`}
                >
                  {cat === 'all' ? tc.filterAll : (CATEGORY_LABELS[cat] ?? cat)}
                </button>
              ))}
            </div>
          )}

          <div className={styles.grid}>
            {filteredComplete.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                accessible={accessibleCourseIds.includes(course.id)}
                tc={tc}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Clases Mensuales ──────────────────────────────────────── */}
      {membershipCourses.length > 0 && (
        <section className={cardStyles.section}>
          <div className={cardStyles.sectionHeader}>
            <h2 className={cardStyles.sectionTitle}>{tc.monthlyClasses}</h2>
            <p className={cardStyles.sectionSub}>{tc.monthlySub}</p>
          </div>
          <div className={styles.grid}>
            {membershipCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                accessible={accessibleCourseIds.includes(course.id)}
                tc={tc}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
