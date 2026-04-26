import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Aviso Legal",
  description: "Aviso legal de Luis y Sara Bachatango. Información sobre el titular de la plataforma y las condiciones de uso.",
  openGraph: { title: "Aviso Legal | Luis y Sara Bachatango", url: "/legal/notice" },
  alternates: { canonical: "/legal/notice" },
  robots: { index: true, follow: false },
};

export default function LegalNoticePage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', fontFamily: 'Playfair Display, serif' }}>Aviso Legal</h1>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-main)' }}>
        <p style={{ marginBottom: '1rem' }}>Última actualización: {new Date().toLocaleDateString()}</p>
        
        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>1. Información del titular</h2>
        <p>Este sitio web es operado por Luis y Sara Bachatango.</p>
        <p>Email de contacto: contacto@luisysarabachatango.com</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>2. Responsabilidad</h2>
        <p>No nos hacemos responsables de los daños o perjuicios que puedan derivarse del uso de este sitio web o de sus contenidos.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>3. Ley aplicable</h2>
        <p>Este aviso legal se rige por las leyes de España y cualquier disputa se someterá a los tribunales competentes.</p>
      </div>
    </div>
  )
}
