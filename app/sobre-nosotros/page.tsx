'use client';

import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { useLanguage } from "@/context/LanguageContext";

export default function SobreNosotros() {
  const { t } = useLanguage();

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>{t.about.heroTitle}</h1>
          <p className={styles.heroSubtitle}>{t.about.heroSubtitle}</p>
        </div>
      </section>

      {/* Bio Section */}
      <section className={styles.section}>
        <div className={styles.bioSection}>
          <div className={styles.bioText}>
            <h2>{t.about.bioTitle}</h2>
            <p>
              {t.about.bio1}
            </p>
            <p>
              {t.about.bio2}
            </p>
          </div>
          <div className={styles.bioImageContainer}>
            {/* User provided image */}
            <Image 
              src="/luis-sara-about.jpg" 
              alt="Luis y Sara bailando" 
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Stats / Achievements */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>15+</span>
            <span className={styles.statLabel}>{t.about.stats.s1}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>50k+</span>
            <span className={styles.statLabel}>{t.about.stats.s2}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>30+</span>
            <span className={styles.statLabel}>{t.about.stats.s3}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>🏆</span>
            <span className={styles.statLabel}>{t.about.stats.s4}</span>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className={styles.philosophySection}>
        <p className={styles.quote}>
          "{t.about.quote}"
        </p>
        <p className={styles.author}>- Luis y Sara</p>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <Link href="/courses" className={styles.ctaButton}>
          {t.about.cta}
        </Link>
      </section>
    </div>
  );
}
