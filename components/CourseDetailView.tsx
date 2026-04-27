'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Lock, Play, Check, ArrowLeft, Calendar, Sparkles } from 'lucide-react';
import BuyCourseButton from '@/components/BuyCourseButton';
import Reveal from '@/components/Reveal';
import styles from '@/app/courses/[courseId]/course-detail.module.css';

const CATEGORY_LABELS: Record<string, string> = {
  bachatango: 'BachaTango',
  bachata:    'Bachata',
  tango:      'Tango',
  chachacha:  'Chachachá',
  otro:       'Otro',
};

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export type CourseDetailCourse = {
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

export type CourseDetailLesson = {
  id: string;
  title: string;
  order: number;
  release_date: string;
  parent_lesson_id?: string | null;
};

type LessonNode = CourseDetailLesson & {
  displayNumber: string;
  depth: number;
};

type Props = {
  course: CourseDetailCourse;
  lessons: CourseDetailLesson[];
  hasAccess: boolean;
  isAdmin: boolean;
  completedLessonIds: string[];
};

/**
 * Flatten lessons into a depth-first ordered list with hierarchical
 * display numbers (e.g. "1", "2", "3", "3.1", "3.2").
 * Top-level lessons (parent_lesson_id === null) are numbered by their
 * position among top-level lessons; children are numbered N.M relative
 * to their parent.
 */
function buildLessonTree(lessons: CourseDetailLesson[]): LessonNode[] {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const topLevel = sorted.filter(l => !l.parent_lesson_id);
  const childrenByParent = new Map<string, CourseDetailLesson[]>();

  for (const l of sorted) {
    if (l.parent_lesson_id) {
      const list = childrenByParent.get(l.parent_lesson_id) ?? [];
      list.push(l);
      childrenByParent.set(l.parent_lesson_id, list);
    }
  }

  const result: LessonNode[] = [];
  topLevel.forEach((parent, i) => {
    const parentNum = String(i + 1);
    result.push({ ...parent, displayNumber: parentNum, depth: 0 });
    const children = childrenByParent.get(parent.id) ?? [];
    children.forEach((child, j) => {
      result.push({
        ...child,
        displayNumber: `${parentNum}.${j + 1}`,
        depth: 1,
      });
    });
  });

  // Orphans: children whose parent isn't in the list (shouldn't happen,
  // but render them at the bottom rather than dropping them).
  const placedIds = new Set(result.map(n => n.id));
  sorted
    .filter(l => !placedIds.has(l.id))
    .forEach((orphan, k) => {
      result.push({
        ...orphan,
        displayNumber: String(topLevel.length + k + 1),
        depth: 0,
      });
    });

  return result;
}

const BENEFITS = [
  'Acceso a todas las lecciones del curso',
  'Vídeos en alta calidad con múltiples ángulos',
  'Recursos musicales y guías de pasos',
  'Comunidad privada de bailarines',
];

export default function CourseDetailView({
  course,
  lessons,
  hasAccess,
  isAdmin,
  completedLessonIds,
}: Props) {
  const completedSet = new Set(completedLessonIds);
  const completedCount = lessons.filter(l => completedSet.has(l.id)).length;
  const progressPct =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const lessonTree = buildLessonTree(lessons);

  const monthLabel =
    course.month && course.year
      ? `${MONTHS_ES[course.month - 1]} ${course.year}`
      : null;

  const categoryLabel =
    course.category && CATEGORY_LABELS[course.category]
      ? CATEGORY_LABELS[course.category]
      : course.category;

  const isMembership = course.course_type === 'membership';

  return (
    <div className={styles.container}>
      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        {/* Background image / fallback */}
        <div className={styles.heroBg} aria-hidden="true">
          {course.image_url?.startsWith('http') ? (
            <Image
              src={course.image_url}
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.heroImage}
            />
          ) : (
            <div className={styles.heroPlaceholder} />
          )}
          <span className={styles.heroOverlay} />
          <span className={styles.heroVignette} />
        </div>

        <div className={styles.heroInner}>
          <Reveal direction="left" distance={24}>
            <Link href="/courses" className={styles.backLink}>
              <ArrowLeft size={16} strokeWidth={2.2} />
              <span>Volver a Cursos</span>
            </Link>
          </Reveal>

          {/* Badges */}
          <Reveal delay={0.05}>
            <div className={styles.heroBadges}>
              <span
                className={`${styles.heroBadge} ${
                  isMembership ? styles.heroBadgeMonthly : styles.heroBadgeComplete
                }`}
              >
                {isMembership ? 'CLASES MENSUALES' : 'CURSO COMPLETO'}
              </span>
              {!isMembership && categoryLabel && (
                <span className={`${styles.heroBadge} ${styles.heroBadgeMuted}`}>
                  {categoryLabel}
                </span>
              )}
              {monthLabel && (
                <span className={`${styles.heroBadge} ${styles.heroBadgeMuted}`}>
                  <Calendar size={12} strokeWidth={2.2} />
                  {monthLabel}
                </span>
              )}
              {hasAccess && (
                <span className={styles.heroBadgeAccess}>
                  <Check size={12} strokeWidth={3} />
                  Acceso activo
                </span>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <h1 className={styles.heroTitle}>{course.title}</h1>
          </Reveal>

          {course.description && (
            <Reveal delay={0.2}>
              <p className={styles.heroDescription}>{course.description}</p>
            </Reveal>
          )}

          {/* Stats / progress */}
          <Reveal delay={0.28}>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{lessons.length}</span>
                <span className={styles.heroStatLabel}>
                  {lessons.length === 1 ? 'LECCIÓN' : 'LECCIONES'}
                </span>
              </div>

              {hasAccess && lessons.length > 0 && (
                <>
                  <div className={styles.heroStat}>
                    <span className={styles.heroStatValue}>
                      {completedCount}/{lessons.length}
                    </span>
                    <span className={styles.heroStatLabel}>COMPLETADAS</span>
                  </div>
                  <div className={styles.heroStatProgress}>
                    <div className={styles.heroStatProgressLabel}>
                      <span>TU PROGRESO</span>
                      <span className={styles.heroStatProgressPct}>{progressPct}%</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <motion.div
                        className={styles.progressFill}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Reveal>

          {/* Admin actions */}
          {isAdmin && (
            <Reveal delay={0.35}>
              <div className={styles.adminActions}>
                <Link href={`/courses/${course.id}/edit`} className={styles.adminButton}>
                  Editar Curso
                </Link>
                <Link
                  href={`/courses/${course.id}/add-lesson`}
                  className={`${styles.adminButton} ${styles.adminButtonPrimary}`}
                >
                  + Añadir Lección
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ============== LOCKED / LESSONS ============== */}
      {!hasAccess ? (
        <Reveal>
          <section className={styles.lockedState}>
            <div className={styles.lockedHalo} aria-hidden="true" />
            <div className={styles.lockedIcon} aria-hidden="true">
              <Lock size={28} strokeWidth={1.8} />
            </div>
            <h2 className={styles.lockedTitle}>Contenido Bloqueado</h2>
            <p className={styles.lockedSub}>
              Compra este curso o suscríbete para desbloquear todas las lecciones, recursos y la comunidad.
            </p>

            <ul className={styles.benefitsList}>
              {BENEFITS.map((benefit, i) => (
                <li key={i} className={styles.benefitItem}>
                  <span className={styles.benefitCheck} aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className={styles.lockedActions}>
              <BuyCourseButton
                courseId={course.id}
                label={
                  course.price_eur != null
                    ? `Comprar curso · €${course.price_eur}`
                    : 'Comprar curso'
                }
              />
              <Link href="/courses" className={styles.lockedSecondary}>
                <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
                Ver otros cursos
              </Link>
            </div>
          </section>
        </Reveal>
      ) : (
        <section className={styles.lessonsSection}>
          <Reveal>
            <div className={styles.lessonsHeader}>
              <span className={styles.lessonsEyebrow}>
                <span className={styles.lessonsEyebrowLine} aria-hidden="true" />
                CONTENIDO DEL CURSO
              </span>
              <h2 className={styles.lessonsTitle}>Lecciones</h2>
            </div>
          </Reveal>

          <ol className={styles.lessonList}>
            {lessonTree.map((lesson, i) => {
              const isCompleted = completedSet.has(lesson.id);
              const releaseDate = new Date(lesson.release_date);
              const isReleased = releaseDate <= new Date();
              const isChild = lesson.depth > 0;
              return (
                <Reveal
                  key={lesson.id}
                  delay={Math.min(i * 0.05, 0.4)}
                  direction="up"
                  distance={20}
                  as="li"
                >
                  <Link
                    href={`/courses/${course.id}/${lesson.id}`}
                    className={`${styles.lessonCard} ${
                      isCompleted ? styles.lessonCardCompleted : ''
                    } ${!isReleased ? styles.lessonCardLocked : ''} ${
                      isChild ? styles.lessonCardChild : ''
                    }`}
                    data-depth={lesson.depth}
                  >
                    {isChild && (
                      <span className={styles.lessonBranch} aria-hidden="true" />
                    )}
                    <span className={styles.lessonNumber} aria-hidden="true">
                      {lesson.displayNumber}
                    </span>
                    <div className={styles.lessonInfo}>
                      <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                      <p className={styles.lessonDate}>
                        {isReleased ? 'Disponible' : 'Próximamente'} ·{' '}
                        {releaseDate.toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`${styles.lessonStatus} ${
                        isCompleted ? styles.lessonStatusDone : ''
                      }`}
                      aria-hidden="true"
                    >
                      {isCompleted ? (
                        <Check size={16} strokeWidth={2.5} />
                      ) : (
                        <Play size={14} strokeWidth={2.5} />
                      )}
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ol>

          {lessons.length === 0 && (
            <Reveal>
              <div className={styles.emptyLessons}>
                <p>Este curso aún no tiene lecciones publicadas.</p>
              </div>
            </Reveal>
          )}
        </section>
      )}
    </div>
  );
}
