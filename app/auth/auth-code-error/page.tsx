import type { Metadata } from 'next'
import Link from 'next/link'
import { getDict } from '@/utils/get-dict'
import AuthShell from '@/components/AuthShell'
import styles from '@/app/login/login.module.css'

export const metadata: Metadata = {
  title: 'Enlace caducado',
  robots: { index: false, follow: false },
}

/**
 * Adónde van a parar los enlaces por email que ya no sirven.
 *
 * `/auth/callback` y `/auth/confirm` llevan aquí desde siempre, pero la página
 * no existía: un enlace caducado daba un 404 del sitio, que se lee como «la web
 * está rota» y no como «pide otro enlace». Dos personas se quedaron fuera por
 * esto sin que nadie se enterara.
 *
 * No dice por qué falló el enlace —caducado, ya usado, manipulado— a propósito:
 * distinguirlos le contaría a un desconocido si un token existe. La salida es la
 * misma en los tres casos, así que basta con ofrecerla.
 */
export default async function AuthCodeErrorPage() {
  const t = await getDict()

  return (
    <AuthShell
      panelEyebrow={t.authCodeError.panelEyebrow}
      panelTitle={t.authCodeError.panelTitle}
      panelTitleEmphasis={t.authCodeError.panelTitleEmphasis}
      panelTitleSuffix={t.authCodeError.panelTitleSuffix}
      panelLead={t.authCodeError.panelLead}
      panelFeatures={t.authCodeError.panelFeatures}
      cardEyebrow={t.authCodeError.cardEyebrow}
      cardTitle={t.authCodeError.title}
      cardSubtitle={t.authCodeError.subtitle}
    >
      <p className={styles.linkSubtle}>{t.authCodeError.body}</p>

      <div className={styles.actions}>
        <Link href="/forgot-password" className={styles.buttonPrimary}>
          {t.authCodeError.requestNew}
        </Link>

        <div className={styles.secondaryLinks}>
          <Link href="/login" className={styles.buttonSecondary}>
            {t.authCodeError.backToLogin}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
