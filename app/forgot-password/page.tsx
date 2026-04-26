import type { Metadata } from 'next'
import { resetPassword } from '../login/actions'
import styles from '../login/login.module.css'
import { getDict } from '@/utils/get-dict'

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage(props: { searchParams: Promise<{ message: string, error: string }> }) {
  const searchParams = await props.searchParams;
  const t = await getDict();

  const errorMsg = searchParams.error
    ? (t.errors[searchParams.error as keyof typeof t.errors] ?? t.errors.unknown)
    : null;
  const successMsg = searchParams.message
    ? (t.messages[searchParams.message as keyof typeof t.messages] ?? null)
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t.forgotPassword.title}</h1>
        <p className={styles.subtitle}>{t.forgotPassword.subtitle}</p>

        {successMsg && (
          <div className={styles.message}>{successMsg}</div>
        )}
        {errorMsg && (
          <div className={styles.error}>{errorMsg}</div>
        )}

        <form className={styles.form}>
          <div className={styles.group}>
            <label htmlFor="email">{t.forgotPassword.email}</label>
            <input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>

          <div className={styles.actions}>
            <button formAction={resetPassword} className={styles.buttonPrimary}>{t.forgotPassword.submit}</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', marginTop: '10px' }}>
              <a href="/login" className={styles.buttonSecondary} style={{ textDecoration: 'none', display: 'block' }}>
                {t.forgotPassword.backToLogin}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
