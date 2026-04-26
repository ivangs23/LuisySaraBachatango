import type { Metadata } from 'next'
import { login } from './actions'
import styles from './login.module.css'
import { getDict } from '@/utils/get-dict'

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: { searchParams: Promise<{ message: string, error: string }> }) {
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
        <h1 className={styles.title}>{t.login.title}</h1>
        <p className={styles.subtitle}>{t.login.subtitle}</p>

        {successMsg && (
          <div className={styles.message}>{successMsg}</div>
        )}
        {errorMsg && (
          <div className={styles.error}>{errorMsg}</div>
        )}

        <form className={styles.form}>
          <div className={styles.group}>
            <label htmlFor="email">{t.login.email}</label>
            <input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>

          <div className={styles.group}>
            <label htmlFor="password">{t.login.password}</label>
            <input id="password" name="password" type="password" required placeholder="••••••••" />
          </div>

          <div className={styles.actions}>
            <button formAction={login} className={styles.buttonPrimary}>{t.login.submit}</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', marginTop: '10px' }}>
              <a href="/signup" className={styles.buttonSecondary} style={{ textDecoration: 'none', display: 'block' }}>
                {t.login.noAccount}
              </a>
              <a href="/forgot-password" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t.login.forgotPassword}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
