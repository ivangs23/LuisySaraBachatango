import type { Metadata } from 'next'
import { getDict } from '@/utils/get-dict'
import AuthShell from '@/components/AuthShell'
import ForgotPasswordForm from '@/components/ForgotPasswordForm'

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
    <AuthShell
      panelEyebrow={t.forgotPassword.panelEyebrow}
      panelTitle={t.forgotPassword.panelTitle}
      panelTitleEmphasis={t.forgotPassword.panelTitleEmphasis}
      panelTitleSuffix={t.forgotPassword.panelTitleSuffix}
      panelLead={t.forgotPassword.panelLead}
      panelFeatures={t.forgotPassword.panelFeatures}
      cardEyebrow={t.forgotPassword.cardEyebrow}
      cardTitle={t.forgotPassword.title}
      cardSubtitle={t.forgotPassword.subtitle}
      errorMsg={errorMsg}
      successMsg={successMsg}
    >
      <ForgotPasswordForm
        labels={{
          email: t.forgotPassword.email,
          submit: t.forgotPassword.submit,
          backToLogin: t.forgotPassword.backToLogin,
        }}
      />
    </AuthShell>
  )
}
