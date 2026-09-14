import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { buildOffer, formatSpotsLeft, selectWithOfferColumns } from '@/utils/courses/offer';
import OfferPrice from '@/components/OfferPrice';
import LandingCheckoutForm from '@/components/LandingCheckoutForm';
import styles from './comprar.module.css';

export const metadata: Metadata = { title: 'Comprar CURSO BACHATANGO', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type FlashFields = { name?: string; email?: string };

export default async function ComprarPage(props: { searchParams: Promise<{ courseId?: string; error?: string }> }) {
  const { courseId, error } = await props.searchParams;
  if (!courseId) notFound();

  // Re-echo de campos tras un error de validación: llegan por cookie flash
  // (httpOnly, maxAge 120s), nunca por query string — la PII (email) no debe
  // acabar en logs ni en el historial (AUDITORIA-2026-07 M6).
  let flash: FlashFields = {};
  const flashCookie = (await cookies()).get('landing_form')?.value;
  if (flashCookie) {
    try {
      const parsed = JSON.parse(flashCookie) as unknown;
      if (parsed && typeof parsed === 'object') flash = parsed as FlashFields;
    } catch {
      // cookie corrupta → formulario vacío
    }
  }
  const { name, email } = flash;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: course } = await selectWithOfferColumns<{
    id: string; title: string; price_eur: number | null;
    compare_at_price_eur?: number | null; spots_left?: number | null;
  }>((offerColumns) =>
    supabase
      .from('courses').select(`id, title, ${offerColumns}`).eq('id', courseId).eq('is_published', true).single(),
  );
  if (!course) notFound();

  const offer = buildOffer(course);
  const spotsText = formatSpotsLeft('Quedan {n} plazas disponibles', offer.spotsLeft);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{course.title}</h1>
        {offer.price !== null && (
          <OfferPrice
            className={styles.priceBlock}
            price={offer.price}
            compareAt={offer.compareAt}
            discountPct={offer.discountPct}
            spotsText={spotsText}
            currency="prefix"
            size="md"
            align="center"
          />
        )}
        <p className={styles.price}>Pago único</p>
        <p className={styles.note}>
          Producto digital con acceso inmediato. Pago único, <strong>sin devoluciones</strong>: al comprar
          solicitas el acceso inmediato y aceptas perder el derecho de desistimiento de 14 días (art. 103.m
          RDLeg 1/2007). <a href="/legal/terms" target="_blank" rel="noopener noreferrer">Más info</a>.
        </p>
        <ul className={styles.trust}>
          <li>Pago seguro con Stripe</li>
          <li>Acceso de por vida</li>
          <li>Comunidad de bailarines</li>
        </ul>
        <LandingCheckoutForm
          courseId={course.id}
          defaultEmail={email ?? user?.email ?? ''}
          defaultName={name ?? ''}
          error={error}
        />
      </div>
    </div>
  );
}
