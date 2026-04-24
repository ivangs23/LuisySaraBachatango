'use client';

import Link from 'next/link';
import styles from '@/app/community/community.module.css';
import subscribeStyles from '@/components/SubscribeButton.module.css';
import CommunityFeed from '@/app/community/CommunityFeed';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  user: any;
  posts: any[];
};

export default function CommunityClient({ user, posts }: Props) {
  const { t } = useLanguage();

  if (!user) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 className={styles.title} style={{ marginBottom: '1.5rem' }}>{t.communityPage.joinTitle}</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
          {t.communityPage.joinDesc}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/login" className={subscribeStyles.button} style={{ textAlign: 'center' }}>
            {t.communityPage.login}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.communityPage.title}</h1>
        <Link href="/community/create" className={styles.createButton}>
          {t.communityPage.create}
        </Link>
      </div>

      <CommunityFeed initialPosts={posts || []} />
    </div>
  );
}
