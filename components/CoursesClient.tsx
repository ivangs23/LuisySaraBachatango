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

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function AccessBadge({ accessible }: { accessible: boolean }) {
  if (accessible) {
    return (
      <span className={cardStyles.badgeAccess}>✓ Tienes acceso</span>
    );
  }
  return null;
}

function PriceTag({ price, accessible }: { price: number | null; accessible: boolean }) {
  if (accessible) return null;
  if (!price) return <span className={cardStyles.priceTag}>Precio no disponible</span>;
  return <span className={cardStyles.priceTag}>€{price}</span>;
}

function CourseCard({ course, accessible }: { course: Course; accessible: boolean }) {
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
              ? <span>{MONTHS_ES[course.month - 1]} {course.year}</span>
              : <span>{course.title}</span>
            }
          </div>
        )}
        {/* Overlay badge */}
        <div className={cardStyles.badgeOverlay}>
          {course.course_type === 'complete' && course.category && (
            <span className={cardStyles.badgeCategory}>
              {CATEGORY_LABELS[course.category] ?? course.category}
            </span>
          )}
          <AccessBadge accessible={accessible} />
        </div>
      </div>

      <div className={styles.content}>
        <h2 className={styles.courseTitle}>{course.title}</h2>
        {course.course_type === 'membership' && course.month && course.year && (
          <p className={styles.courseDate}>{MONTHS_ES[course.month - 1]} {course.year}</p>
        )}
        <p className={styles.description}>{course.description}</p>
        <div className={cardStyles.cardFooter}>
          <PriceTag price={course.price_eur} accessible={accessible} />
          <span className={styles.cta}>
            {accessible ? 'Ver Clases →' : course.price_eur ? 'Comprar →' : 'Ver más →'}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function CoursesClient({ courses, isAdmin, accessibleCourseIds }: Props) {
  const { t } = useLanguage();
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
        <h1 className={styles.title}>{t.coursesPage.title}</h1>
        {isAdmin && (
          <Link href="/courses/create" className={styles.createButton}>
            {t.coursesPage.create}
          </Link>
        )}
      </div>

      {courses.length === 0 && (
        <div className={styles.emptyState}>
          <p>{t.coursesPage.empty}</p>
          <p className={styles.subtext}>{t.coursesPage.emptySub}</p>
        </div>
      )}

      {/* ── Cursos Completos ───────────────────────────────────────── */}
      {completeCourses.length > 0 && (
        <section className={cardStyles.section}>
          <div className={cardStyles.sectionHeader}>
            <h2 className={cardStyles.sectionTitle}>Cursos Completos</h2>
            <p className={cardStyles.sectionSub}>Precio fijo · Acceso permanente</p>
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
                  {cat === 'all' ? 'Todos' : (CATEGORY_LABELS[cat] ?? cat)}
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
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Clases Mensuales ──────────────────────────────────────── */}
      {membershipCourses.length > 0 && (
        <section className={cardStyles.section}>
          <div className={cardStyles.sectionHeader}>
            <h2 className={cardStyles.sectionTitle}>Clases Mensuales</h2>
            <p className={cardStyles.sectionSub}>
              4 clases por mes · Suscripción o compra individual por mes
            </p>
          </div>
          <div className={styles.grid}>
            {membershipCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                accessible={accessibleCourseIds.includes(course.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
