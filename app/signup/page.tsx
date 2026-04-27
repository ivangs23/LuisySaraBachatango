import type { Metadata } from 'next'
import { getDict } from '@/utils/get-dict'
import AuthShell from '@/components/AuthShell'
import SignupForm from '@/components/SignupForm'

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
    <AuthShell
      panelEyebrow="ÚNETE A LA ACADEMIA"
      panelTitle={
        <>
          Tu primera <em>clase</em> empieza con un paso.
        </>
      }
      panelLead="Crea tu cuenta y desbloquea acceso a las clases, los retos mensuales y la comunidad de Luis y Sara Bachatango."
      panelFeatures={[
        'Acceso a clases para todos los niveles',
        'Eventos, quedadas y música cuidada',
        'Una comunidad cálida y sin postureo',
      ]}
      panelQuote="Lo que se baila despacio, se entiende rápido."
      panelQuoteAuthor="LUIS Y SARA"
      cardEyebrow="CREAR CUENTA"
      cardTitle={t.signup.title}
      cardSubtitle={t.signup.subtitle}
      errorMsg={errorMsg}
      successMsg={successMsg}
    >
      <SignupForm
        labels={{
          email: t.signup.email,
          fullName: t.signup.fullName,
          fullNamePlaceholder: t.signup.fullNamePlaceholder,
          password: t.signup.password,
          submit: t.signup.submit,
          hasAccount: t.signup.hasAccount,
          forgotPassword: t.signup.forgotPassword,
          or: 'O',
        }}
      />
    </AuthShell>
  )
}
