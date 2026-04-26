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
      panelEyebrow="ACCESO PRIVADO"
      panelTitle={
        <>
          Bailar es <em>recordar</em> con el cuerpo.
        </>
      }
      panelLead="Vuelve a tu sitio en la academia: clases nuevas, comunidad activa y todo el archivo de Luis y Sara esperándote."
      panelFeatures={[
        'Clases en vídeo en alta calidad',
        'Comunidad de bailarines y eventos',
        'Tu progreso, guardado lección a lección',
      ]}
      panelQuote="La bachata no se aprende, se siente. Pero se practica."
      panelQuoteAuthor="LUIS Y SARA"
      cardEyebrow="ENTRAR"
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
          or: 'O',
        }}
      />
    </AuthShell>
  )
}
