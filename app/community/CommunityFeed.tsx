'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Heart, MessageCircle, ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useLanguage } from '@/context/LanguageContext';
import styles from './community.module.css';

type Post = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
  likes_count?: number;
  comments_count?: number;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function CommunityFeed({ initialPosts }: { initialPosts: Post[] }) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  // Nota: la tabla posts no tiene columna de categoría, así que aquí solo
  // filtramos por búsqueda. Si algún día se añade la columna, reintroducir
  // las pestañas de categoría con un filtro real.
  const filteredPosts = useMemo(() => {
    return initialPosts.filter(post => {
      const term = searchTerm.toLowerCase();
      return (
        post.title.toLowerCase().includes(term) ||
        post.content.toLowerCase().includes(term)
      );
    });
  }, [initialPosts, searchTerm]);

  return (
    <>
      <section className={styles.filterSection}>
        <Reveal>
          <div className={styles.searchWrapper}>
            <Search
              className={styles.searchIcon}
              size={18}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder={t.community.searchPlaceholder}
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </Reveal>
      </section>

      <section className={styles.feedSection}>
        <div className={styles.postList}>
          {filteredPosts.map((post, i) => {
            const initial = post.profiles?.full_name?.[0]?.toUpperCase() || 'U';
            return (
              <Reveal
                key={post.id}
                delay={Math.min(i * 0.05, 0.4)}
                direction="up"
                distance={20}
              >
                <Link href={`/community/${post.id}`} className={styles.postCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.avatarMini} aria-hidden="true">
                      {initial}
                    </div>
                    <div className={styles.headerInfo}>
                      <h2 className={styles.postTitle}>{post.title}</h2>
                      <div className={styles.postMeta}>
                        <span className={styles.authorName}>
                          {post.profiles?.full_name || t.community.anonymous}
                        </span>
                        <span className={styles.dot}>•</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <p className={styles.postContent}>{post.content}</p>

                  <div className={styles.cardFooter}>
                    <span className={styles.interaction} aria-label={t.community.like}>
                      <Heart size={14} strokeWidth={2.2} />
                      {post.likes_count ?? 0}
                    </span>
                    <span className={styles.interaction} aria-label={t.community.comments}>
                      <MessageCircle size={14} strokeWidth={2.2} />
                      {post.comments_count ?? 0}
                    </span>
                    <span className={styles.cardCta}>
                      {t.community.read}
                      <ArrowUpRight size={12} strokeWidth={2.6} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}

          {filteredPosts.length === 0 && (
            <Reveal>
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {searchTerm
                    ? t.community.noResults.replace('{term}', searchTerm)
                    : t.community.noPosts}
                </p>
                <p>
                  {searchTerm
                    ? t.community.noResultsSub
                    : t.community.noPostsSub}
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
