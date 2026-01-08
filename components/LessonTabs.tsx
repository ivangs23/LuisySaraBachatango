'use client';

import { useState } from 'react';
import styles from './LessonTabs.module.css'; // We'll need to create this or reuse existing styles

import CommentsSection from './CommentsSection';

type LessonTabsProps = {
  description: string;
  courseId: string;
  lessonId: string;
  musicalResources?: string; // Placeholder for now
  comments?: any[]; // Placeholder
};

export default function LessonTabs({ description, courseId, lessonId }: LessonTabsProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'resources' | 'comments'>('description');

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
        {activeTab === 'comments' && (
          <CommentsSection lessonId={lessonId} courseId={courseId} />
        )}
      </div>
    </>
  );
}
