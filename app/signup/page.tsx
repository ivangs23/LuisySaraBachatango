import { signup } from '../login/actions'
import styles from '../login/login.module.css'

export default async function SignupPage(props: { searchParams: Promise<{ message: string, error: string }> }) {
  const searchParams = await props.searchParams;
  
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Regístrate</h1>
        <p className={styles.subtitle}>Crea tu cuenta para acceder a la plataforma</p>

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
          
          <div className={styles.group}>
            <label htmlFor="fullName">Nombre Completo</label>
            <input id="fullName" name="fullName" type="text" required placeholder="Juan Pérez" />
          </div>

          <div className={styles.group}>
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required placeholder="••••••••" />
          </div>

          <div className={styles.actions}>
            <button formAction={signup} className={styles.buttonPrimary}>Registrarse</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', marginTop: '10px' }}>
              <a href="/login" className={styles.buttonSecondary} style={{ textDecoration: 'none', display: 'block' }}>
                ¿Ya tienes cuenta? Inicia Sesión
              </a>
              <a href="/forgot-password" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
