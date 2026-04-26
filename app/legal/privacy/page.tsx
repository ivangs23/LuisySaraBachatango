import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Consulta nuestra política de privacidad. Información sobre el tratamiento de tus datos personales en la plataforma de cursos de Luis y Sara Bachatango.",
  openGraph: { title: "Política de Privacidad | Luis y Sara Bachatango", url: "/legal/privacy" },
  alternates: { canonical: "/legal/privacy" },
  robots: { index: true, follow: false },
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', fontFamily: 'Playfair Display, serif' }}>Política de Privacidad</h1>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-main)' }}>
        <p style={{ marginBottom: '1rem' }}>Última actualización: {new Date().toLocaleDateString()}</p>
        
        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>1. Información que recopilamos</h2>
        <p>Recopilamos información que usted nos proporciona directamente, como cuando crea una cuenta, se suscribe a un curso o se comunica con nosotros.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>2. Cómo utilizamos su información</h2>
        <p>Utilizamos la información que recopilamos para proporcionar, mantener y mejorar nuestros servicios, procesar transacciones y enviarle avisos técnicos y soporte.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>3. Compartir información</h2>
        <p>No compartimos su información personal con terceros, excepto cuando es necesario para procesar pagos o cumplir con la ley.</p>
        
        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>4. Seguridad</h2>
        <p>Tomamos medidas razonables para proteger su información personal contra pérdida, robo, uso indebido y acceso no autorizado.</p>
      </div>
    </div>
  )
}
