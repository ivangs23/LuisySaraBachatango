'use client';

import Link from 'next/link';
import { Plus, Users, ArrowRight } from 'lucide-react';
import styles from '@/app/community/community.module.css';
import CommunityFeed from '@/app/community/CommunityFeed';
import Reveal from '@/components/Reveal';
import { useLanguage } from '@/context/LanguageContext';

type Profile = { full_name: string | null } | null;

type Post = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  profiles: Profile;
  category?: string;
  likes_count?: number;
  comments_count?: number;
};

type User = { id: string } | null;

type Props = {
  user: User;
  posts: Post[];
  currentPage: number;
  totalPages: number;
};

export default function CommunityClient({ user, posts, currentPage, totalPages }: Props) {
  const { t } = useLanguage();

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.heroBg} aria-hidden="true" />
          <Reveal>
            <div className={styles.authGate}>
              <div className={styles.authGateHalo} aria-hidden="true" />
              <div className={styles.authGateIcon} aria-hidden="true">
                <Users size={26} strokeWidth={1.8} />
              </div>
              <h1 className={styles.authGateTitle}>{t.communityPage.joinTitle}</h1>
              <p className={styles.authGateDesc}>{t.communityPage.joinDesc}</p>
              <Link href="/login?next=/community" className={styles.authGateButton}>
                {t.communityPage.login}
                <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    );
  }

  const totalPosts = posts.length;

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroInner}>
          <Reveal direction="left" distance={20}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              FORO · {totalPosts} {totalPosts === 1 ? 'POST' : 'POSTS'}
            </span>
          </Reveal>

          <div className={styles.heroTopRow}>
            <div className={styles.heroBlock}>
              <Reveal delay={0.06}>
                <h1 className={styles.title}>{t.communityPage.title}</h1>
              </Reveal>
              <Reveal delay={0.14}>
                <p className={styles.heroSub}>
                  Comparte tu progreso, resuelve dudas y conecta con otros bailarines de Bachatango.
                </p>
              </Reveal>
            </div>

            <Reveal direction="right" delay={0.1}>
              <Link href="/community/create" className={styles.createButton}>
                <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
                {t.communityPage.create}
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <CommunityFeed initialPosts={posts || []} />

      {totalPages > 1 && (
        <nav aria-label="Paginación de posts" className={styles.pagination}>
          {currentPage > 1 ? (
            <Link href={`/community?page=${currentPage - 1}`}>← Anterior</Link>
          ) : <span aria-hidden="true" />}
          <span>Página {currentPage} de {totalPages}</span>
          {currentPage < totalPages ? (
            <Link href={`/community?page=${currentPage + 1}`}>Siguiente →</Link>
          ) : <span aria-hidden="true" />}
        </nav>
      )}
    </div>
  );
}
