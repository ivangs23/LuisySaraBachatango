import { resetPassword } from '../login/actions'
import styles from '../login/login.module.css'

export default async function ForgotPasswordPage(props: { searchParams: Promise<{ message: string, error: string }> }) {
  const searchParams = await props.searchParams;
  
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Recuperar Contraseña</h1>
        <p className={styles.subtitle}>Ingresa tu email para recibir un enlace de recuperación</p>

        {searchParams.message && (
          <div className={styles.message}>{searchParams.message}</div>
        )}
        {searchParams.error && (
          <div className={styles.error}>{searchParams.error}</div>
        )}

        <form className={styles.form}>
          <div className={styles.group}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>

          <div className={styles.actions}>
            <button formAction={resetPassword} className={styles.buttonPrimary}>Enviar enlace</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', marginTop: '10px' }}>
              <a href="/login" className={styles.buttonSecondary} style={{ textDecoration: 'none', display: 'block' }}>
                Volver al inicio de sesión
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
