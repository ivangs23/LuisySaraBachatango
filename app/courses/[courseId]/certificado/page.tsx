import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Great_Vibes } from 'next/font/google';
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser } from '@/utils/supabase/get-user';
import { getDict } from '@/utils/get-dict';
import { getCurrentLocale } from '@/utils/i18n/get-locale';
import {
  CERTIFICATE_BRAND,
  CERTIFICATE_CITY,
  CERTIFICATE_SIGNATORIES,
  formatCertificateDate,
} from '@/utils/courses/completion';
import PrintCertificateButton from './PrintCertificateButton';
import styles from './certificate.module.css';

// Firma manuscrita. next/font la auto-hospeda, así que no hay petición a
// fonts.googleapis.com y la CSP de next.config.ts no necesita tocarse.
const signatureFont = Great_Vibes({ subsets: ['latin'], weight: '400' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return {
    title: t.certificate.pageTitle,
    // Documento privado de una persona concreta: fuera de buscadores.
    robots: { index: false, follow: false },
  };
}

export default async function CertificatePage(props: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await props.params;

  const user = await getCurrentUser();
  // /login no soporta todavía un parámetro de retorno, así que no se le pasa uno
  // que ignoraría.
  if (!user) redirect('/login');

  const supabase = await createClient();
  const [t, locale] = await Promise.all([getDict(), getCurrentLocale()]);

  // RLS: la policy de SELECT sólo deja ver la fila propia (y todas al admin),
  // así que nadie puede leer el certificado de otro cambiando el courseId.
  const [{ data: completion }, { data: course }] = await Promise.all([
    supabase
      .from('course_completions')
      .select('certificate_code, recipient_name, lessons_total, completed_at')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle(),
    supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .maybeSingle(),
  ]);

  // Sin fila emitida no hay documento que enseñar. 404 y no "aún no puedes":
  // la ficha del curso ya explica lo que falta.
  if (!completion || !course) notFound();

  const c = t.certificate;
  const template = completion.lessons_total === 1 ? c.declarationOne : c.declaration;
  const declaration = template
    .replace('{name}', completion.recipient_name)
    .replace('{course}', course.title)
    .replace('{lessons}', String(completion.lessons_total));

  const issuedAt = c.issuedAt
    .replace('{city}', CERTIFICATE_CITY)
    .replace('{date}', formatCertificateDate(completion.completed_at, locale));

  return (
    <main className={styles.page}>
      <div className={styles.actions}>
        <Link href={`/courses/${courseId}`} className={styles.backLink}>{c.back}</Link>
        <PrintCertificateButton label={c.print} />
      </div>

      <article className={styles.sheet} aria-label={c.pageTitle}>
        <div className={styles.frame}>
          <header className={styles.head}>
            {/* logo.png es 576×1024 con la marca centrada y mucho aire: se
                encaja en un disco cuadrado y se escala, igual que el
                `.logoMark` del header. */}
            <span className={styles.logoMark}>
              <Image
                src="/logo.png"
                alt={CERTIFICATE_BRAND}
                fill
                sizes="110px"
                className={styles.logo}
              />
            </span>
            <p className={styles.kicker}>{c.docKicker}</p>
            <p className={styles.brand}>{CERTIFICATE_BRAND}</p>
          </header>

          <div className={styles.body}>
            <span className={styles.rule} aria-hidden="true" />
            <p className={styles.recipient}>{completion.recipient_name}</p>
            <span className={styles.rule} aria-hidden="true" />
            <p className={styles.declaration}>{declaration}</p>
          </div>

          <footer className={styles.foot}>
            <p className={styles.issued}>{issuedAt}</p>

            <div className={styles.signatures}>
              {CERTIFICATE_SIGNATORIES.map((signatory) => (
                <div key={signatory.name} className={styles.signature}>
                  <span className={`${styles.signatureName} ${signatureFont.className}`} aria-hidden="true">
                    {signatory.name}
                  </span>
                  <span className={styles.signatureLine} aria-hidden="true" />
                  <span className={styles.signatoryMeta}>{signatory.name}</span>
                </div>
              ))}
            </div>
            {/* El cargo va una sola vez bajo las dos firmas: repetir
                «Directores» (plural) bajo cada nombre chirría. */}
            <p className={styles.signatoryRole}>{c.signatoryRole}</p>

            <p className={styles.code}>
              <span className={styles.codeLabel}>{c.codeLabel}</span>
              <span className={styles.codeValue}>{completion.certificate_code}</span>
            </p>
            <p className={styles.disclaimer}>{c.disclaimer}</p>
          </footer>
        </div>
      </article>
    </main>
  );
}
