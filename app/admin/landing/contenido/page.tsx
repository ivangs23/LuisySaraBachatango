import Link from 'next/link'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import LandingContentForms from '@/components/admin/LandingContentForms'
import styles from './contenido.module.css'

export const dynamic = 'force-dynamic'

export default async function LandingContentPage() {
  // Sin filtrar por publicado: el admin también ve lo oculto.
  const sb = createSupabaseAdmin()
  const [stats, testimonials, faq] = await Promise.all([
    sb.from('landing_stats').select('key, value').order('position'),
    sb.from('landing_testimonials').select('*').order('position'),
    sb.from('landing_faq').select('*').order('position'),
  ])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Contenido de la landing</h1>
        <Link href="/admin/landing" className={styles.navLink}>← Estadísticas</Link>
      </header>

      <p className={styles.intro}>
        Solo el español es obligatorio. Los idiomas que dejes vacíos mostrarán el
        texto en español. Los cambios salen en la web al guardar.
      </p>

      <LandingContentForms
        stats={stats.data ?? []}
        testimonials={testimonials.data ?? []}
        faq={faq.data ?? []}
      />
    </div>
  )
}
