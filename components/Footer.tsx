import Link from 'next/link'
import Image from 'next/image'
import styles from './Footer.module.css'

import { createClient } from '@/utils/supabase/server'

export default async function Footer() {
  const supabase = await createClient()
  
  // Fetch the most recently updated profile that has an Instagram link
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('instagram, facebook, tiktok, youtube')
    .neq('instagram', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  console.log('DEBUG FOOTER:', {
      timestamp: new Date().toISOString(),
      adminProfile,
      instagram: adminProfile?.instagram,
      fallbackUsed: !adminProfile?.instagram
  });



  // Default Fallbacks
  const instagramUrl = adminProfile?.instagram || "https://www.instagram.com/luisysarabachatango/"
  const facebookUrl = adminProfile?.facebook || "https://www.facebook.com/LuisySaraBachatango"
  const tiktokUrl = adminProfile?.tiktok || "https://www.tiktok.com/@luisysarabachatango"
  const youtubeUrl = adminProfile?.youtube || "https://www.youtube.com/@LuisySaraBachatango"

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.column}>
          <div style={{ marginBottom: '1.5rem', backgroundColor: 'white', borderRadius: '50%', padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', overflow: 'hidden' }}>
            <Image src="/logo.png" alt="Luis y Sara Bachatango" width={80} height={80} style={{ objectFit: 'contain', transform: 'scale(2.0)', transformOrigin: 'center', objectPosition: 'center' }} />
          </div>
          <p style={{ lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Aprende a bailar con pasión y técnica. Cursos online de Bachatango para todos los niveles.
          </p>
          <div className={styles.socialLinks}>
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Facebook">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
            <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="TikTok">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
              </svg>
            </a>
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="YouTube">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
              </svg>
            </a>
          </div>
        </div>

        <div className={styles.column}>
          <h3>Explorar</h3>
          <ul className={styles.linkList}>
            <li><Link href="/" className={styles.link}>Inicio</Link></li>
            <li><Link href="/courses" className={styles.link}>Cursos</Link></li>
            <li><Link href="/community" className={styles.link}>Comunidad</Link></li>
            <li><Link href="/login" className={styles.link}>Iniciar Sesión</Link></li>
          </ul>
        </div>

        <div className={styles.column}>
          <h3>Legal</h3>
          <ul className={styles.linkList}>
            <li><Link href="/legal/privacy" className={styles.link}>Política de Privacidad</Link></li>
            <li><Link href="/legal/terms" className={styles.link}>Términos y Condiciones</Link></li>
            <li><Link href="/legal/cookies" className={styles.link}>Política de Cookies</Link></li>
            <li><Link href="/legal/notice" className={styles.link}>Aviso Legal</Link></li>
          </ul>
        </div>
      </div>

      <div className={styles.bottom}>
        <p>&copy; {new Date().getFullYear()} Luis y Sara Bachatango. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
