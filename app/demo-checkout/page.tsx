import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isDemoMode } from '@/utils/demo/mode';
import DemoCheckoutForm from '@/components/DemoCheckoutForm';
import styles from './demo-checkout.module.css';

export const metadata: Metadata = {
  title: 'Pago simulado (demo)',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DemoCheckoutPage(props: { searchParams: Promise<{ courseId?: string }> }) {
  if (!isDemoMode()) notFound();

  const { courseId } = await props.searchParams;
  if (!courseId) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, price_eur')
    .eq('id', courseId)
    .eq('is_published', true)
    .single();

  if (!course) notFound();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.badge}>MODO DEMO</span>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.price}>€{course.price_eur} · pago simulado</p>
        <DemoCheckoutForm courseId={course.id} defaultEmail={user?.email ?? ''} />
      </div>
    </div>
  );
}
