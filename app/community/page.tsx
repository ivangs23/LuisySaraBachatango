import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from './community.module.css'
import SubscribeButton from '@/components/SubscribeButton'
import CommunityFeed from './CommunityFeed'

export default async function CommunityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 className={styles.title} style={{ marginBottom: '1.5rem' }}>Únete a la Comunidad</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
          Para ver y participar en las discusiones exclusivas de la comunidad Bachatango, necesitas estar registrado y suscrito.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <SubscribeButton />
          
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            ¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    )
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Comunidad</h1>
        <Link href="/community/create" className={styles.createButton}>
          Crear Post
        </Link>
      </div>

      <CommunityFeed initialPosts={posts || []} />
    </div>
  )
}
