import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import LandingCheckoutForm from '@/components/LandingCheckoutForm';
import styles from './comprar.module.css';

export const metadata: Metadata = { title: 'Comprar CURSO BACHATANGO', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ComprarPage(props: { searchParams: Promise<{ courseId?: string; error?: string; name?: string; email?: string }> }) {
  const { courseId, error, name, email } = await props.searchParams;
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
        <LandingCheckoutForm courseId={course.id} defaultEmail={email ?? user?.email ?? ''} defaultName={name ?? ''} error={error} />
      </div>
    </div>
  );
}
