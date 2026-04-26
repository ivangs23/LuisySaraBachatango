'use client';

import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { FileText, Music, ClipboardList, MessageSquare } from 'lucide-react';
import styles from './LessonTabs.module.css';
import CommentsSection from './CommentsSection';
import LessonAssignmentTab from './LessonAssignmentTab';
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

type TabId = 'description' | 'resources' | 'assignment' | 'comments';

export default function LessonTabs({
  description,
  courseId,
  lessonId,
  assignment = null,
  submission = null,
  isAdmin = false,
}: LessonTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const { t } = useLanguage();

  const tabs: Array<{
    id: TabId;
    label: string;
    icon: typeof FileText;
    badge?: 'dot' | 'soon' | null;
  }> = [
    { id: 'description', label: t.lesson.description, icon: FileText },
    { id: 'resources', label: t.lesson.musicalResources, icon: Music, badge: 'soon' },
    {
      id: 'assignment',
      label: t.lesson.assignment,
      icon: ClipboardList,
      badge: assignment && !submission ? 'dot' : null,
    },
    { id: 'comments', label: t.lesson.comments, icon: MessageSquare },
  ];

  return (
    <div className={styles.wrapper}>
      <LayoutGroup id="lesson-tabs">
        <div className={styles.tabs} role="tablist">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              >
                <Icon size={15} strokeWidth={2} aria-hidden="true" className={styles.tabIcon} />
                <span className={styles.tabLabel}>{tab.label}</span>
                {tab.badge === 'dot' && (
                  <span className={styles.tabBadgeDot} aria-hidden="true" />
                )}
                {tab.badge === 'soon' && (
                  <span className={styles.tabBadgeSoon}>SOON</span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="lesson-tab-indicator"
                    className={styles.tabIndicator}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className={styles.content}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={styles.panel}
          >
            {activeTab === 'description' && (
              <div className={styles.description}>
                {description ? (
                  <p>{description}</p>
                ) : (
                  <p className={styles.placeholder}>—</p>
                )}
              </div>
            )}
            {activeTab === 'resources' && (
              <div className={styles.placeholder}>
                <Music size={28} strokeWidth={1.5} aria-hidden="true" />
                <p>{t.lesson.resourcesComingSoon}</p>
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
