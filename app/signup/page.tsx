import type { Metadata } from 'next'
import { signup } from '../login/actions'
import styles from '../login/login.module.css'
import { getDict } from '@/utils/get-dict'

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: { index: false, follow: false },
};

export default async function SignupPage(props: { searchParams: Promise<{ message: string, error: string }> }) {
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
        <h1 className={styles.title}>{t.signup.title}</h1>
        <p className={styles.subtitle}>{t.signup.subtitle}</p>

        {successMsg && (
          <div className={styles.message}>{successMsg}</div>
        )}
        {errorMsg && (
          <div className={styles.error}>{errorMsg}</div>
        )}

        <form className={styles.form}>
          <div className={styles.group}>
            <label htmlFor="email">{t.signup.email}</label>
            <input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>

          <div className={styles.group}>
            <label htmlFor="fullName">{t.signup.fullName}</label>
            <input id="fullName" name="fullName" type="text" required placeholder={t.signup.fullNamePlaceholder} />
          </div>

          <div className={styles.group}>
            <label htmlFor="password">{t.signup.password}</label>
            <input id="password" name="password" type="password" required placeholder="••••••••" />
          </div>

          <div className={styles.actions}>
            <button formAction={signup} className={styles.buttonPrimary}>{t.signup.submit}</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', marginTop: '10px' }}>
              <a href="/login" className={styles.buttonSecondary} style={{ textDecoration: 'none', display: 'block' }}>
                {t.signup.hasAccount}
              </a>
              <a href="/forgot-password" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t.signup.forgotPassword}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
