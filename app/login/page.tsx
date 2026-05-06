import type { Metadata } from 'next'
import { getDict } from '@/utils/get-dict'
import AuthShell from '@/components/AuthShell'
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
    </AuthShell>
  )
}
