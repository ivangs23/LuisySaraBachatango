import type { Metadata } from 'next'
import { getDict } from '@/utils/get-dict'
import AuthShell from '@/components/AuthShell'
import { resendConfirmation } from './actions'
import LoginForm from '@/components/LoginForm'

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
    <AuthShell
      panelEyebrow={t.login.panelEyebrow}
      panelTitle={t.login.panelTitle}
      panelTitleEmphasis={t.login.panelTitleEmphasis}
      panelTitleSuffix={t.login.panelTitleSuffix}
      panelLead={t.login.panelLead}
      panelFeatures={t.login.panelFeatures}
      panelQuote={t.login.panelQuote}
      panelQuoteAuthor="LUIS Y SARA"
      cardEyebrow={t.login.cardEyebrow}
      cardTitle={t.login.title}
      cardSubtitle={t.login.subtitle}
      errorMsg={errorMsg}
      successMsg={successMsg}
    >
      <LoginForm
        labels={{
          email: t.login.email,
          password: t.login.password,
          submit: t.login.submit,
          noAccount: t.login.noAccount,
          forgotPassword: t.login.forgotPassword,
          or: t.login.or,
        }}
      />

      {/* Solo cuando el fallo ha sido por falta de confirmación: es la única
          salida propia que tiene esa persona. Recuperar la contraseña no
          desbloquea la cuenta, así que sin esto dependía de que un admin la
          confirmara a mano. */}
      {searchParams.error === 'email_not_confirmed' && (
        <form action={resendConfirmation} style={{ marginTop: '1rem' }}>
          <label htmlFor="resend-email" className="sr-only">{t.login.email}</label>
          <input
            id="resend-email"
            name="email"
            type="email"
            required
            placeholder={t.login.email}
            style={{
              width: '100%', padding: '0.7rem 0.9rem', marginBottom: '0.6rem',
              background: 'transparent', color: 'inherit',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%', padding: '0.7rem 1rem', cursor: 'pointer',
              background: 'transparent', color: 'var(--primary)',
              border: '1px solid var(--primary)', borderRadius: 'var(--radius-pill, 999px)',
            }}
          >
            {t.errors.resend_confirmation}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
