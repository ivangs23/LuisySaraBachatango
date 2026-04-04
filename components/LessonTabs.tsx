'use client';

import { useState } from 'react';
import styles from './LessonTabs.module.css';
import CommentsSection from './CommentsSection';
import LessonAssignmentTab from './LessonAssignmentTab';

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

type TabId = 'description' | 'resources' | 'comments' | 'assignment';

export default function LessonTabs({
  description,
  courseId,
  lessonId,
  assignment = null,
  submission = null,
  isAdmin = false,
}: LessonTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description');

  return (
    <>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'description' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('description')}
        >
          Descripción
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'resources' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          Recursos Musicales
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'assignment' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('assignment')}
        >
          Tarea
          {assignment && !submission && (
            <span style={{ marginLeft: 6, width: 8, height: 8, background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle' }} />
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'comments' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comentarios
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'description' && (
          <div className={styles.description}>
            <p>{description}</p>
          </div>
        )}
        {activeTab === 'resources' && (
          <div className={styles.placeholder}>
            <p>Recursos musicales próximamente...</p>
          </div>
        )}
        {activeTab === 'assignment' && (
          <LessonAssignmentTab
            assignment={assignment}
            submission={submission}
            isAdmin={isAdmin}
            courseId={courseId}
            lessonId={lessonId}
          />
        )}
        {activeTab === 'comments' && (
          <CommentsSection lessonId={lessonId} courseId={courseId} />
        )}
      </div>
    </>
  );
}
