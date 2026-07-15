import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import LandingCheckoutForm from '@/components/LandingCheckoutForm';
import styles from './comprar.module.css';

export const metadata: Metadata = { title: 'Comprar CURSO BACHATANGO', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ComprarPage(props: { searchParams: Promise<{ courseId?: string; error?: string; name?: string; email?: string; country?: string; city?: string; postalCode?: string; dateOfBirth?: string; danceLevel?: string; phone?: string }> }) {
  const { courseId, error, name, email, country, city, postalCode, dateOfBirth, danceLevel, phone } = await props.searchParams;
  if (!courseId) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: course } = await supabase
    .from('courses').select('id, title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course) notFound();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.price}>€{course.price_eur} · pago único</p>
        <p className={styles.note}>
          Producto digital con acceso inmediato. Pago único, <strong>sin devoluciones</strong>: al comprar
          solicitas el acceso inmediato y aceptas perder el derecho de desistimiento de 14 días (art. 103.m
          RDLeg 1/2007). <a href="/legal/terms" target="_blank" rel="noopener noreferrer">Más info</a>.
        </p>
        <LandingCheckoutForm
          courseId={course.id}
          defaultEmail={email ?? user?.email ?? ''}
          defaultName={name ?? ''}
          error={error}
          defaults={{ country, city, postalCode, dateOfBirth, danceLevel, phone }}
        />
      </div>
    </div>
  );
}
