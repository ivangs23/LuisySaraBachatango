import type { Metadata } from 'next'
import { getDict } from '@/utils/get-dict'
import AuthShell from '@/components/AuthShell'
import ResetPasswordForm from '@/components/ResetPasswordForm'

export const metadata: Metadata = {
  title: "Fija tu contraseña",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const t = await getDict();

  return (
    <AuthShell
      panelEyebrow={t.resetPassword.panelEyebrow}
      panelTitle={t.resetPassword.panelTitle}
      panelTitleEmphasis={t.resetPassword.panelTitleEmphasis}
      panelTitleSuffix={t.resetPassword.panelTitleSuffix}
      panelLead={t.resetPassword.panelLead}
      panelFeatures={t.resetPassword.panelFeatures}
      cardEyebrow={t.resetPassword.cardEyebrow}
      cardTitle={t.resetPassword.title}
      cardSubtitle={t.resetPassword.subtitle}
    >
      <ResetPasswordForm
        labels={{
          password: t.resetPassword.password,
          confirmPassword: t.resetPassword.confirmPassword,
          submit: t.resetPassword.submit,
          mismatch: t.resetPassword.mismatch,
          errorPasswordTooShort: t.errors.password_too_short,
          errorUpdateFailed: t.errors.update_failed,
        }}
      />
    </AuthShell>
  )
}
