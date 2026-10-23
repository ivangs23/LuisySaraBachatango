import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { verifyFreeClassesToken } from '@/utils/newsletter/free-classes-token';
import { getExtraFreeLessons, type ExtraFreeLesson } from '@/utils/courses/extra-free-lessons';
import { signPublicPlaybackToken, signPublicThumbnailToken } from '@/utils/mux/public-token';
import { getCurrentLocale } from '@/utils/i18n/get-locale';
import { getLandingCopy } from '@/app/curso-bachatango/copy';
import FreeClassPlayer from '@/components/FreeClassPlayer';
import styles from '../page.module.css';

// Lleva el email en la URL: ni se indexa ni se cachea.
export const metadata: Metadata = {
  title: 'Tus dos clases de Bachatango',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

type Firmada = ExtraFreeLesson & { playbackToken: string; thumbnailToken: string };

/**
 * Las dos clases que se mandan por email a quien deja su correo en la landing
 * (T3.1). Se entra con `?e=<email>&t=<token>` desde el primer correo de la
 * secuencia; sin un token válido para ese email, 404.
 *
 * Los tokens de Mux se firman en cada visita y nunca se cachean: viajan
 * embebidos en el HTML y una firma reutilizada puede llegar caducada (ver
 * utils/mux/public-token.ts).
 */
export default async function ClasesExtraPage(props: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await props.searchParams;
  if (!e || !t || !verifyFreeClassesToken(e, t)) notFound();

  const [lessons, locale] = await Promise.all([getExtraFreeLessons(), getCurrentLocale()]);
  const c = getLandingCopy(locale).extraClasses;

  let firmadas: Firmada[] = [];
  try {
    firmadas = await Promise.all(
      lessons.map(async (l) => {
        const [playbackToken, thumbnailToken] = await Promise.all([
          signPublicPlaybackToken(l.mux_playback_id),
          signPublicThumbnailToken(l.mux_playback_id),
        ]);
        return { ...l, playbackToken, thumbnailToken };
      }),
    );
  } catch (err) {
    console.error('[clase-gratis/mas] no se pudieron firmar los tokens: %s', (err as Error).message);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{c.title}</h1>
        <p className={styles.lead}>{firmadas.length > 0 ? c.lead : c.unavailable}</p>
      </header>

      {firmadas.map((l) => (
        <section key={l.id}>
          <FreeClassPlayer
            playbackId={l.mux_playback_id}
            playbackToken={l.playbackToken}
            thumbnailToken={l.thumbnailToken}
            posterUrl={null}
            title={l.title}
          />
          <h2 className={styles.lessonTitle}>{l.title}</h2>
          {l.description && <p className={styles.lessonDesc}>{l.description}</p>}
        </section>
      ))}

      <section className={styles.upsell}>
        <h2 className={styles.upsellTitle}>{c.ctaTitle}</h2>
        <p className={styles.upsellBody}>{c.ctaBody}</p>
        <a href="/curso-bachatango" className={styles.cta}>{c.cta}</a>
      </section>
    </div>
  );
}
