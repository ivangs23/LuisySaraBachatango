'use client';

import Link from "next/link";
import styles from "./page.module.css";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Newsletter from "@/components/Newsletter";
import InstagramGallery from "@/components/InstagramGallery";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        {/* Ambient floating orbs */}
        <span className={styles.orb1} aria-hidden="true" />
        <span className={styles.orb2} aria-hidden="true" />
        <span className={styles.orb3} aria-hidden="true" />

        <div className={styles.heroContent}>
          <h1 className={styles.title} style={{ whiteSpace: 'pre-line' }}>
            {t.hero.title}
          </h1>
          <p className={styles.subtitle}>
            {t.hero.subtitle}
          </p>
          <Link href="/courses" className={styles.ctaButton}>
            {t.hero.cta}
          </Link>
        </div>

        <div className={styles.scrollIndicator} aria-hidden="true">
          <div className={styles.scrollDot} />
        </div>
      </section>

      {/* Features Section */}
      <Features />

      {/* Testimonials */}
      <Testimonials />

      {/* Gallery */}
      <InstagramGallery />

      {/* FAQ */}
      <FAQ />

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
