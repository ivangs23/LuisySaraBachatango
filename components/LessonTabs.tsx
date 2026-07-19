'use client';

import { useState } from 'react';
import { MessageSquare, ClipboardList, AlignLeft } from 'lucide-react';
import styles from './LessonTabs.module.css';
import CommentsSection from './CommentsSection';
import AssignmentPanel from './AssignmentPanel';
import { useLanguage } from '@/context/LanguageContext';

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

type LessonTabsProps = {
  description: string;
  courseId: string;
  lessonId: string;
  assignment?: Assignment | null;
  submission?: Submission | null;
  isAdmin?: boolean;
};

type TabKey = 'description' | 'assignment' | 'comments';

export default function LessonTabs({
  description,
  courseId,
  lessonId,
  assignment = null,
  submission = null,
  isAdmin = false,
}: LessonTabsProps) {
  const { t } = useLanguage();

  const hasDescription = description.trim().length > 0;
  // La pestaña de tarea aparece si hay tarea o si es admin (para gestionarla).
  const hasAssignment = assignment !== null || isAdmin;

  const tabs: { key: TabKey; label: string; icon: typeof MessageSquare; badge?: boolean }[] = [];
  if (hasDescription) tabs.push({ key: 'description', label: t.lesson.description, icon: AlignLeft });
  if (hasAssignment) {
    // Punto de aviso si el alumno tiene una corrección o una tarea sin entregar.
    const badge = !isAdmin && assignment !== null &&
      (submission === null || submission.status === 'reviewed');
    tabs.push({ key: 'assignment', label: t.lesson.assignment, icon: ClipboardList, badge });
  }
  tabs.push({ key: 'comments', label: t.lesson.comments, icon: MessageSquare });

  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? 'comments');

  // Navegación con flechas entre pestañas (accesibilidad WAI-ARIA).
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + dir + tabs.length) % tabs.length;
    setActive(tabs[next].key);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="tablist" aria-label={t.lesson.courseLessons}>
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(tab.key)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            >
              <Icon size={15} strokeWidth={2} aria-hidden="true" className={styles.tabIcon} />
              <span className={styles.tabLabel}>{tab.label}</span>
              {tab.badge && <span className={styles.tabBadgeDot} aria-hidden="true" />}
              {isActive && <span className={styles.tabIndicator} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className={styles.content}>
        {active === 'description' && (
          <div role="tabpanel" id="panel-description" aria-labelledby="tab-description" tabIndex={0} className={styles.panel}>
            <div className={styles.description}>
              {description.split('\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        )}

        {active === 'assignment' && (
          <div role="tabpanel" id="panel-assignment" aria-labelledby="tab-assignment" tabIndex={0} className={styles.panel}>
            <AssignmentPanel
              courseId={courseId}
              lessonId={lessonId}
              assignment={assignment}
              submission={submission}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {active === 'comments' && (
          <div role="tabpanel" id="panel-comments" aria-labelledby="tab-comments" tabIndex={0} className={styles.panel}>
            <CommentsSection lessonId={lessonId} courseId={courseId} />
          </div>
        )}
      </div>
    </div>
  );
}
