import type { Metadata } from 'next';
import Link from 'next/link';
import { getDict } from '@/utils/get-dict';
import { getFreeLesson } from '@/utils/courses/free-lesson';
import { getLandingCourse } from '@/utils/courses/landing-course';
import { signPublicPlaybackToken, signPublicThumbnailToken } from '@/utils/mux/public-token';
import FreeClassPlayer from '@/components/FreeClassPlayer';
import styles from './page.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com';

// El JWT vive 15 min y la caché de tokens 10; regenerar el HTML cada 5 min
// garantiza que el token embebido nunca está próximo a caducar.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Clase gratis de Bachatango',
  description: 'Una clase completa del curso de Bachatango de Luis y Sara, gratis y sin registro. Pruébala antes de decidir.',
  alternates: { canonical: `${BASE_URL}/clase-gratis` },
  openGraph: {
    title: 'Clase gratis de Bachatango | Luis y Sara',
    description: 'Una clase completa del curso, gratis y sin registro.',
    url: `${BASE_URL}/clase-gratis`,
    type: 'website',
    siteName: 'Luis y Sara Bachatango',
    locale: 'es_ES',
  },
};

export default async function FreeClassPage() {
  const dict = await getDict();
  const c = dict.freeClass;

  const [lesson, course] = await Promise.all([getFreeLesson(), getLandingCourse()]);

  if (!lesson) {
    return (
      <div className={styles.page}>
        <section className={styles.unavailable}>
          <h1 className={styles.title}>{c.title}</h1>
          <p className={styles.lead}>{c.unavailable}</p>
          <Link href="/courses" className={styles.cta}>{c.unavailableCta}</Link>
        </section>
      </div>
    );
  }

  const [playbackToken, thumbnailToken] = await Promise.all([
    signPublicPlaybackToken(lesson.mux_playback_id),
    signPublicThumbnailToken(lesson.mux_playback_id),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{c.eyebrow}</span>
        <h1 className={styles.title}>{c.title}</h1>
        <p className={styles.lead}>{c.lead}</p>
      </header>

      <FreeClassPlayer
        playbackId={lesson.mux_playback_id}
        playbackToken={playbackToken}
        thumbnailToken={thumbnailToken}
        posterUrl={lesson.thumbnail_url}
        title={lesson.title}
      />

      <h2 className={styles.lessonTitle}>{lesson.title}</h2>
      {lesson.description && <p className={styles.lessonDesc}>{lesson.description}</p>}

      <section className={styles.upsell}>
        <h2 className={styles.upsellTitle}>{c.ctaTitle}</h2>
        <p className={styles.upsellBody}>{c.ctaBody}</p>
        {course && <p className={styles.upsellPrice}>{course.price_eur} €</p>}
        <Link href="/curso-bachatango" className={styles.cta}>{c.cta}</Link>
      </section>
    </div>
  );
}
