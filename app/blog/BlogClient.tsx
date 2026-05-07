'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutGroup, motion } from 'motion/react';
import { ArrowUpRight, BookOpen, Search } from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

interface Article {
  id: number;
  slug: string;
  image: string;
  title: string;
  category: string;
  excerpt: string;
}

export default function BlogPage() {
  const { t } = useLanguage();

  const ARTICLES: Article[] = useMemo(
    () => [
      {
        id: 1,
        slug: 'que-es-bachatango',
        image: '/about-hero.png',
        title: t.blog.items.a1.t,
        category: t.blog.items.a1.c,
        excerpt: t.blog.items.a1.e,
      },
      {
        id: 2,
        slug: 'errores-postura',
        image: '/luis-sara-about.jpg',
        title: t.blog.items.a2.t,
        category: t.blog.items.a2.c,
        excerpt: t.blog.items.a2.e,
      },
      {
        id: 3,
        slug: 'musicalidad-tango-bachata',
        image: '/hero-bg.png',
        title: t.blog.items.a3.t,
        category: t.blog.items.a3.c,
        excerpt: t.blog.items.a3.e,
      },
    ],
    [t]
  );

  const ALL_LABEL = 'Todos';

  const categories = useMemo(() => {
    const unique = Array.from(new Set(ARTICLES.map((a) => a.category)));
    return [ALL_LABEL, ...unique];
  }, [ARTICLES]);

  const [active, setActive] = useState<string>(ALL_LABEL);

  const filtered = useMemo(() => {
    if (active === ALL_LABEL) return ARTICLES;
    return ARTICLES.filter((a) => a.category === active);
  }, [ARTICLES, active]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const titleWords = t.blog.title.split(' ');
  const lastWord = titleWords.slice(-1)[0] ?? '';
  const titleHead = titleWords.slice(0, -1).join(' ');

  return (
    <div className={styles.container}>
      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              REVISTA · BLOG
              <span className={styles.eyebrowLine} aria-hidden="true" />
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.title}>
              {titleHead}{' '}
              <span className={styles.titleAccent}>{lastWord}</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={styles.subtitle}>{t.blog.desc}</p>
          </Reveal>
        </div>
      </section>

      {/* ============== FILTERS ============== */}
      <Reveal delay={0.05}>
        <div className={styles.filters}>
          <LayoutGroup id="blog-categories">
            <div className={styles.categories} role="tablist" aria-label="Filtrar por categoría">
              {categories.map((cat) => {
                const isActive = cat === active;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(cat)}
                    className={`${styles.categoryChip} ${
                      isActive ? styles.activeChip : ''
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="blog-chip-indicator"
                        className={styles.chipIndicator}
                        aria-hidden="true"
                        transition={{
                          type: 'spring',
                          bounce: 0.2,
                          duration: 0.55,
                        }}
                      />
                    )}
                    {cat}
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </Reveal>

      {/* ============== BODY ============== */}
      <div className={styles.body}>
        {filtered.length === 0 ? (
          <Reveal>
            <div className={styles.empty}>
              <Search size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3 className={styles.emptyTitle}>Sin artículos por aquí</h3>
              <p className={styles.emptyText}>
                Prueba otra categoría — pronto sumaremos más lecturas a esta
                colección.
              </p>
            </div>
          </Reveal>
        ) : (
          <>
            {featured && (
              <section className={styles.section}>
                <Reveal>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitleBlock}>
                      <span className={styles.sectionEyebrow}>
                        <span
                          className={styles.sectionEyebrowLine}
                          aria-hidden="true"
                        />
                        EDITORIAL DESTACADA
                      </span>
                      <h2 className={styles.sectionTitle}>
                        Lectura{' '}
                        <span className={styles.sectionTitleAccent}>
                          principal
                        </span>
                      </h2>
                    </div>
                  </div>
                </Reveal>

                <Reveal delay={0.06}>
                  <Link
                    href={`/blog/${featured.slug}`}
                    className={styles.featured}
                  >
                    <div className={styles.featuredImageWrap}>
                      <Image
                        src={featured.image}
                        alt={featured.title}
                        fill
                        sizes="(max-width: 820px) 100vw, 55vw"
                        style={{ objectFit: 'cover', opacity: 0.92 }}
                        priority
                      />
                      <span className={styles.featuredImageOverlay} aria-hidden="true" />
                      <span className={styles.featuredBadge}>
                        <BookOpen size={12} strokeWidth={2.4} aria-hidden="true" />
                        DESTACADO
                      </span>
                    </div>
                    <div className={styles.featuredContent}>
                      <span className={styles.featuredCategory}>
                        <span
                          className={styles.featuredCategoryDot}
                          aria-hidden="true"
                        />
                        {featured.category}
                      </span>
                      <h3 className={styles.featuredTitle}>{featured.title}</h3>
                      <p className={styles.featuredExcerpt}>
                        {featured.excerpt}
                      </p>
                      <span className={styles.featuredCta}>
                        {t.blog.readMore}
                        <ArrowUpRight
                          size={14}
                          strokeWidth={2.6}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              </section>
            )}

            {rest.length > 0 && (
              <section className={styles.section}>
                <Reveal>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitleBlock}>
                      <span className={styles.sectionEyebrow}>
                        <span
                          className={styles.sectionEyebrowLine}
                          aria-hidden="true"
                        />
                        MÁS LECTURAS
                      </span>
                      <h2 className={styles.sectionTitle}>
                        Sigue{' '}
                        <span className={styles.sectionTitleAccent}>
                          explorando
                        </span>
                      </h2>
                    </div>
                  </div>
                </Reveal>

                <div className={styles.grid}>
                  {rest.map((article, i) => (
                    <Reveal key={article.id} delay={0.05 + i * 0.06}>
                      <Link
                        href={`/blog/${article.slug}`}
                        className={styles.card}
                      >
                        <div className={styles.imageContainer}>
                          <Image
                            src={article.image}
                            alt={article.title}
                            fill
                            sizes="(max-width: 720px) 100vw, 33vw"
                            style={{ objectFit: 'cover', opacity: 0.9 }}
                          />
                          <span
                            className={styles.imageOverlay}
                            aria-hidden="true"
                          />
                          <span className={styles.cardBadge}>
                            <span
                              className={styles.cardBadgeDot}
                              aria-hidden="true"
                            />
                            {article.category}
                          </span>
                        </div>
                        <div className={styles.cardContent}>
                          <h3 className={styles.cardTitle}>{article.title}</h3>
                          <p className={styles.excerpt}>{article.excerpt}</p>
                          <span className={styles.readMore}>
                            {t.blog.readMore}
                            <ArrowUpRight
                              size={13}
                              strokeWidth={2.6}
                              aria-hidden="true"
                            />
                          </span>
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
