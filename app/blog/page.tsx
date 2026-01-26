'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function BlogPage() {
  const { t } = useLanguage();

  const ARTICLES = [
    {
      id: 1,
      title: t.blog.items.a1.t,
      category: t.blog.items.a1.c,
      excerpt: t.blog.items.a1.e,
      image: "/about-hero.png", 
      slug: "que-es-bachatango"
    },
    {
      id: 2,
      title: t.blog.items.a2.t,
      category: t.blog.items.a2.c,
      excerpt: t.blog.items.a2.e,
      image: "/luis-sara-about.jpg",
      slug: "errores-postura"
    },
    {
      id: 3,
      title: t.blog.items.a3.t,
      category: t.blog.items.a3.c,
      excerpt: t.blog.items.a3.e,
      image: "/hero-bg.png",
      slug: "musicalidad-tango-bachata"
    }
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t.blog.title}</h1>
      <p className={styles.subtitle}>
        {t.blog.desc}
      </p>

      <div className={styles.grid}>
        {ARTICLES.map(article => (
          <article key={article.id} className={styles.card}>
            <div className={styles.imageContainer}>
              <Image 
                src={article.image} 
                alt={article.title} 
                fill 
                style={{objectFit: 'cover', opacity: 0.8}}
              />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.category}>{article.category}</span>
              <h2 className={styles.cardTitle}>{article.title}</h2>
              <p className={styles.excerpt}>{article.excerpt}</p>
              <Link href={`/blog/${article.slug}`} className={styles.readMore}>
                {t.blog.readMore} <span>→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
