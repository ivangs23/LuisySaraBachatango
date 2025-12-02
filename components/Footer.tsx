import Link from 'next/link'
import Image from 'next/image'
import styles from './Footer.module.css'

export default function Footer() {
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
            <a href="#" className={styles.socialIcon} aria-label="Instagram">📷</a>
            <a href="#" className={styles.socialIcon} aria-label="Facebook">fb</a>
            <a href="#" className={styles.socialIcon} aria-label="YouTube">▶</a>
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
