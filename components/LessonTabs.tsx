'use client';

import { MessageSquare } from 'lucide-react';
import styles from './LessonTabs.module.css';
import CommentsSection from './CommentsSection';
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

export default function LessonTabs({ courseId, lessonId }: LessonTabsProps) {
  const { t } = useLanguage();

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-comments"
          aria-selected="true"
          aria-controls="panel-comments"
          className={`${styles.tab} ${styles.tabActive}`}
        >
          <MessageSquare size={15} strokeWidth={2} aria-hidden="true" className={styles.tabIcon} />
          <span className={styles.tabLabel}>{t.lesson.comments}</span>
        </button>
      </div>

      <div className={styles.content}>
        <div
          role="tabpanel"
          id="panel-comments"
          aria-labelledby="tab-comments"
          tabIndex={0}
          className={styles.panel}
        >
          <CommentsSection lessonId={lessonId} courseId={courseId} />
        </div>
      </div>
    </div>
  );
}
