import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLandingCourse } from '@/utils/courses/landing-course';
import { buildOffer } from '@/utils/courses/offer';
import { getCurriculum } from '@/utils/courses/curriculum';
import { getFreeLesson } from '@/utils/courses/free-lesson';
import { signPublicPlaybackToken, signPublicThumbnailToken } from '@/utils/mux/public-token';
import { getCurrentUser } from '@/utils/supabase/get-user';
import { getCurrentLocale } from '@/utils/i18n/get-locale';
import { getTestimonials } from '@/utils/landing/content';
import { getLandingCopy } from './copy';
import { heroSub } from './_lib/curriculum-copy';
import { safeJsonLd } from '@/utils/jsonld';
import LandingHero from './_components/LandingHero';
import LandingSections from './_components/LandingSections';
import StickyBuyBar from './_components/StickyBuyBar';
import styles from './page.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com';

// Alineada con el titular de la landing (copy.ts → hero.h1). El <title> se
// queda con «Curso de Bachatango online», que es lo que se busca; la
// descripción y la tarjeta social llevan la autoridad. Sin cifras del temario:
// el metadata es estático y no debe envejecer cuando cambie el curso.
const SOCIAL_TITLE = 'Aprende bachatango con los finalistas de Bailando con las Estrellas';
const SOCIAL_DESCRIPTION =
  'El curso online de Luis y Sara, en vídeo. Aprendes el rol de leader y el de follower, así que puedes empezar sin pareja.';

export const metadata: Metadata = {
  title: 'Curso de Bachatango online | Luis y Sara',
  description:
    'Aprende bachatango con Luis y Sara, finalistas de Bailando con las Estrellas. Curso online en vídeo, con el rol de leader y el de follower: puedes empezar sin pareja. Pago único, acceso de por vida.',
  openGraph: {
    title: SOCIAL_TITLE,
    description: SOCIAL_DESCRIPTION,
    url: `${BASE_URL}/curso-bachatango`,
    type: 'website',
    // Sin `images`: las inyecta ./opengraph-image.tsx.
    siteName: 'Luis y Sara Bachatango',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: SOCIAL_TITLE,
    description: SOCIAL_DESCRIPTION,
  },
  alternates: { canonical: `${BASE_URL}/curso-bachatango` },
};

export default async function CursoBachatangoLanding() {
  const course = await getLandingCourse();
  if (!course) notFound();

  // El idioma va primero porque los testimonios se localizan con él; solo
  // lee una cookie, así que no retrasa al resto.
  const locale = await getCurrentLocale();
  const [user, curriculum, lesson, testimonials] = await Promise.all([
    getCurrentUser(), getCurriculum(), getFreeLesson(), getTestimonials(locale),
  ]);
  // El idioma se resuelve en servidor desde la cookie, no en el contexto de
  // cliente: así el HTML sale ya en el idioma correcto y no hay un parpadeo
  // en español justo en la página que vende.
  const copy = getLandingCopy(locale);
  const isAuthed = !!user;
  // Precio real + tachado + plazas, ya normalizados. El tachado es sólo
  // decoración: `offers.price` del JSON-LD sigue siendo el precio que se cobra.
  const offer = buildOffer(course);

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
      <LandingHero courseId={course.id} isAuthed={isAuthed} offer={offer} imageUrl={course.image_url} copy={copy} sub={heroSub(copy, curriculum)} />
      <LandingSections courseId={course.id} offer={offer} curriculum={curriculum} freeClass={freeClass} testimonials={testimonials} copy={copy} />
      <StickyBuyBar courseId={course.id} offer={offer} copy={copy} />
    </div>
  );
}
