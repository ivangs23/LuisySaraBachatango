'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { LayoutGroup, motion } from 'motion/react';
import { Search, Heart, MessageCircle, ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './community.module.css';

type Post = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
  category?: string;
  likes_count?: number;
  comments_count?: number;
};

const CATEGORIES = ['Todos', 'General', 'Dudas de Clase', 'Música', 'Eventos', 'Quedadas'];

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const filteredPosts = useMemo(() => {
    return initialPosts.filter(post => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        post.title.toLowerCase().includes(term) ||
        post.content.toLowerCase().includes(term);
      // Category filter is a stub for now (no category column in DB)
      const matchesCategory = selectedCategory === 'Todos' || true;
      return matchesSearch && matchesCategory;
    });
  }, [initialPosts, searchTerm, selectedCategory]);

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
              placeholder="Buscar en la comunidad..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <LayoutGroup id="community-categories">
            <div className={styles.categories} role="tablist" aria-label="Categorías">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat)}
                    className={`${styles.categoryChip} ${active ? styles.activeChip : ''}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="community-chip-indicator"
                        className={styles.chipIndicator}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    {cat}
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
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
                          {post.profiles?.full_name || 'Usuario'}
                        </span>
                        <span className={styles.dot}>•</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <p className={styles.postContent}>{post.content}</p>

                  <div className={styles.cardFooter}>
                    <span className={styles.interaction} aria-label="Me gusta">
                      <Heart size={14} strokeWidth={2.2} />
                      {post.likes_count ?? 0}
                    </span>
                    <span className={styles.interaction} aria-label="Comentarios">
                      <MessageCircle size={14} strokeWidth={2.2} />
                      {post.comments_count ?? 0}
                    </span>
                    <span className={styles.cardCta}>
                      Leer
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
                    ? `Sin resultados para "${searchTerm}"`
                    : 'Todavía no hay posts'}
                </p>
                <p>
                  {searchTerm
                    ? 'Prueba con otra búsqueda o publica el primer post sobre el tema.'
                    : 'Sé el primero en compartir algo con la comunidad.'}
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
