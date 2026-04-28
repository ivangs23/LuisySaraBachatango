'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Check, Play, Clock, Edit3 } from 'lucide-react';
import LessonTabs from '@/components/LessonTabs';
import LessonPlayer from '@/components/LessonPlayer';
import Reveal from '@/components/Reveal';
import LessonNavigation from '@/components/LessonNavigation';
import { findAdjacentAccessibleLessons } from '@/utils/lesson-navigation';
import { useLanguage } from '@/context/LanguageContext';
import styles from '@/app/courses/[courseId]/[lessonId]/lesson.module.css';

type LessonItem = {
  id: string;
  title: string;
  order: number;
  parent_lesson_id?: string | null;
  is_free: boolean;
};

type LessonNode = LessonItem & {
  displayNumber: string;
  depth: number;
};

function buildLessonTree(lessons: LessonItem[]): LessonNode[] {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const topLevel = sorted.filter(l => !l.parent_lesson_id);
  const childrenByParent = new Map<string, LessonItem[]>();

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

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  mux_playback_id: string | null;
  mux_status: string | null;
};

type Assignment = {
  id: string;
  title: string;
  description: string | null;
};

type Submission = {
  id?: string;
  text_content: string | null;
  file_url: string | null;
  status: string;
  grade: string | null;
  feedback: string | null;
};

type Props = {
  courseId: string;
  lessonId: string;
  lesson: Lesson;
  allLessons: LessonItem[];
  completedLessonIds: string[];
  hasAccess: boolean;
  isAdmin: boolean;
  playbackToken: string | null;
  thumbnailToken: string | null;
  assignment: Assignment | null;
  submission: Submission | null;
  viewerUserId: string;
};

export default function LessonView({
  courseId,
  lessonId,
  lesson,
  allLessons,
  completedLessonIds,
  hasAccess,
  isAdmin,
  playbackToken,
  thumbnailToken,
  assignment,
  submission,
  viewerUserId,
}: Props) {
  const { t } = useLanguage();
  const completedSet = new Set(completedLessonIds);
  const completedCount = allLessons.filter(l => completedSet.has(l.id)).length;
  const total = allLessons.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const lessonTree = buildLessonTree(allLessons);
  const { prev: prevLesson, next: nextLesson } = findAdjacentAccessibleLessons(
    lessonTree,
    lessonId,
    isAdmin || hasAccess,
  );
  const currentNode = lessonTree.find(n => n.id === lessonId);
  const positionLabel = currentNode
    ? `Lección ${currentNode.displayNumber} de ${total}`
    : null;

  const canPlay =
    hasAccess && lesson.mux_status === 'ready' && !!lesson.mux_playback_id;
  const isProcessing = hasAccess && lesson.mux_status !== 'ready';

  return (
    <div className={styles.container}>
      {/* Header / breadcrumb */}
      <Reveal direction="left" distance={20}>
        <div className={styles.header}>
          <Link href={`/courses/${courseId}`} className={styles.backLink}>
            <ArrowLeft size={16} strokeWidth={2.2} />
            <span>{t.lesson.backToCourse.replace(/^[\s←‹]+/, '')}</span>
          </Link>

          {isAdmin && (
            <Link
              href={`/courses/${courseId}/${lessonId}/edit`}
              className={styles.adminButton}
            >
              <Edit3 size={14} strokeWidth={2.2} aria-hidden="true" />
              {t.lesson.editLesson}
            </Link>
          )}
        </div>
      </Reveal>

      <div className={styles.mainLayout}>
        {/* ============= SIDEBAR ============= */}
        <aside className={styles.sidebar}>
          <Reveal direction="left" distance={20}>
            <div className={styles.sidebarHeader}>
              <span className={styles.sidebarEyebrow}>
                {t.lesson.courseLessons.toUpperCase()}
              </span>
              <div className={styles.sidebarProgress}>
                <div className={styles.sidebarProgressLabel}>
                  <span>{completedCount}/{total} completadas</span>
                  <span className={styles.sidebarProgressPct}>{progressPct}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <motion.div
                    className={styles.progressFill}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                  />
                </div>
              </div>
            </div>
          </Reveal>

          <ol className={styles.lessonList}>
            {lessonTree.map(l => {
              const isCompleted = completedSet.has(l.id);
              const isActive = l.id === lessonId;
              const isChild = l.depth > 0;
              return (
                <li key={l.id} className={isChild ? styles.lessonListItemChild : undefined}>
                  <Link
                    href={`/courses/${courseId}/${l.id}`}
                    className={`${styles.lessonItem} ${
                      isActive ? styles.lessonItemActive : ''
                    } ${isCompleted ? styles.lessonItemCompleted : ''} ${
                      isChild ? styles.lessonItemChild : ''
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    data-depth={l.depth}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="lesson-sidebar-indicator"
                        className={styles.lessonItemIndicator}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    {isChild && (
                      <span className={styles.lessonItemBranch} aria-hidden="true" />
                    )}
                    <span className={styles.lessonOrder} aria-hidden="true">
                      {l.displayNumber}
                    </span>
                    <span className={styles.lessonTitleText}>{l.title}</span>
                    <span className={styles.lessonStatus} aria-hidden="true">
                      {isCompleted ? (
                        <Check size={14} strokeWidth={2.6} />
                      ) : isActive ? (
                        <Play size={12} strokeWidth={2.6} />
                      ) : (
                        <span className={styles.lessonDot} />
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* ============= MAIN CONTENT ============= */}
        <div className={styles.contentWrapper}>
          {/* Player wrapper cinemático */}
          <Reveal>
            <div className={styles.videoWrapper}>
              <span className={styles.playerCornerTL} aria-hidden="true" />
              <span className={styles.playerCornerTR} aria-hidden="true" />
              <span className={styles.playerCornerBL} aria-hidden="true" />
              <span className={styles.playerCornerBR} aria-hidden="true" />

              {canPlay ? (
                <LessonPlayer
                  playbackId={lesson.mux_playback_id!}
                  playbackToken={playbackToken!}
                  thumbnailToken={thumbnailToken ?? undefined}
                  posterUrl={lesson.thumbnail_url}
                  lessonId={lessonId}
                  lessonTitle={lesson.title}
                  courseId={courseId}
                  viewerUserId={viewerUserId}
                />
              ) : isProcessing ? (
                <div className={styles.lockedContent}>
                  <div className={styles.lockedIcon}>
                    <Clock size={28} strokeWidth={1.8} />
                  </div>
                  <h2 className={styles.lockedTitle}>Vídeo en preparación</h2>
                  <p className={styles.lockedSub}>
                    El vídeo de esta lección todavía se está procesando. Vuelve en unos minutos.
                  </p>
                </div>
              ) : (
                <div className={styles.lockedContent}>
                  <div className={styles.lockedIcon}>
                    <Lock size={28} strokeWidth={1.8} />
                  </div>
                  <h2 className={styles.lockedTitle}>{t.lesson.lockedContent}</h2>
                  <p className={styles.lockedSub}>{t.lesson.lockedMessage}</p>
                  <Link href={`/courses/${courseId}`} className={styles.lockedCta}>
                    {t.lesson.getPremium}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </div>
          </Reveal>

          <LessonNavigation
            courseId={courseId}
            prev={prevLesson ? { id: prevLesson.id, title: prevLesson.title, displayNumber: prevLesson.displayNumber } : null}
            next={nextLesson ? { id: nextLesson.id, title: nextLesson.title, displayNumber: nextLesson.displayNumber } : null}
          />

          {/* Lesson info */}
          <Reveal delay={0.08}>
            <div className={styles.lessonInfo}>
              {positionLabel && (
                <span className={styles.lessonEyebrow}>
                  <span className={styles.lessonEyebrowLine} aria-hidden="true" />
                  {positionLabel}
                </span>
              )}
              <h1 className={styles.title}>{lesson.title}</h1>
            </div>
          </Reveal>

          {/* Tabs */}
          {hasAccess ? (
            <Reveal delay={0.15}>
              <div className={styles.tabsCard}>
                <LessonTabs
                  description={lesson.description ?? ''}
                  courseId={courseId}
                  lessonId={lessonId}
                  assignment={assignment}
                  submission={submission}
                  isAdmin={isAdmin}
                />
              </div>
            </Reveal>
          ) : (
            <Reveal delay={0.15}>
              <div className={styles.exclusiveCard}>
                <p>{t.lesson.exclusiveContent}</p>
                <Link href={`/courses/${courseId}`} className={styles.exclusiveCta}>
                  {t.lesson.getPremium}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}
