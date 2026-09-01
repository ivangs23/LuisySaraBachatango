import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLandingCourse } from '@/utils/courses/landing-course';
import { getCurriculum } from '@/utils/courses/curriculum';
import { getFreeLesson } from '@/utils/courses/free-lesson';
import { signPublicPlaybackToken, signPublicThumbnailToken } from '@/utils/mux/public-token';
import { getCurrentUser } from '@/utils/supabase/get-user';
import { safeJsonLd } from '@/utils/jsonld';
import LandingHero from './_components/LandingHero';
import LandingSections from './_components/LandingSections';
import StickyBuyBar from './_components/StickyBuyBar';
import styles from './page.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com';

export const metadata: Metadata = {
  title: 'Curso de Bachatango online | Luis y Sara',
  description: 'Aprende bachatango desde cero con el método completo de Luis y Sara: técnica, conexión y musicalidad. Pago único, acceso de por vida.',
  openGraph: {
    title: 'Curso de Bachatango online | Luis y Sara',
    description: 'El método completo de Luis y Sara para dominar el bachatango a tu ritmo, desde casa.',
    url: `${BASE_URL}/curso-bachatango`,
    type: 'website',
    // Sin `images`: las inyecta ./opengraph-image.tsx.
    siteName: 'Luis y Sara Bachatango',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Curso de Bachatango online | Luis y Sara',
    description: 'El método completo de Luis y Sara para dominar el bachatango a tu ritmo, desde casa.',
  },
  alternates: { canonical: `${BASE_URL}/curso-bachatango` },
};

export default async function CursoBachatangoLanding() {
  const course = await getLandingCourse();
  if (!course) notFound();

  const [user, curriculum, lesson] = await Promise.all([
    getCurrentUser(), getCurriculum(), getFreeLesson(),
  ]);
  const isAuthed = !!user;

  // Se firma en cada render, nunca se cachea: el token viaja embebido en el
  // HTML y una firma reutilizada puede llegar al visitante ya caducada (ver
  // utils/mux/public-token.ts). Si algo falla, `freeClass` queda a null y la
  // sección enseña el enlace de siempre en lugar de un vídeo roto.
  let freeClass: {
    playbackId: string; playbackToken: string; thumbnailToken: string; title: string;
  } | null = null;
  if (lesson) {
    try {
      const [playbackToken, thumbnailToken] = await Promise.all([
        signPublicPlaybackToken(lesson.mux_playback_id),
        signPublicThumbnailToken(lesson.mux_playback_id),
      ]);
      freeClass = {
        playbackId: lesson.mux_playback_id,
        playbackToken,
        thumbnailToken,
        title: lesson.title,
      };
    } catch (e) {
      console.error('[landing] no se pudo firmar la clase gratis: %s', (e as Error).message);
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: course.title,
    description: 'Curso completo de bachatango online con Luis y Sara.',
    image: course.image_url ? [course.image_url] : undefined,
    brand: { '@type': 'Brand', name: 'Luis y Sara Bachatango' },
    offers: {
      '@type': 'Offer',
      price: course.price_eur,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: `${BASE_URL}/curso-bachatango`,
    },
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <LandingHero courseId={course.id} isAuthed={isAuthed} price={course.price_eur} imageUrl={course.image_url} />
      <LandingSections courseId={course.id} price={course.price_eur} curriculum={curriculum} freeClass={freeClass} />
      <StickyBuyBar courseId={course.id} price={course.price_eur} />
    </div>
  );
}
