import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Consulta los términos y condiciones de uso de la plataforma de cursos online de Luis y Sara Bachatango.",
  openGraph: { title: "Términos y Condiciones | Luis y Sara Bachatango", url: "/legal/terms" },
  alternates: { canonical: "/legal/terms" },
  robots: { index: true, follow: false },
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', fontFamily: 'Playfair Display, serif' }}>Términos y Condiciones</h1>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-main)' }}>
        <p style={{ marginBottom: '1rem' }}>Última actualización: {new Date().toLocaleDateString()}</p>
        
        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>1. Aceptación de los términos</h2>
        <p>Al acceder y utilizar este sitio web, usted acepta estar sujeto a estos términos y condiciones.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>2. Uso del servicio</h2>
        <p>Usted se compromete a utilizar nuestros servicios solo para fines legales y de acuerdo con estos términos.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>3. Propiedad intelectual</h2>
        <p>Todo el contenido de este sitio web, incluidos textos, gráficos, logotipos e imágenes, es propiedad de Luis y Sara Bachatango y está protegido por las leyes de propiedad intelectual.</p>
        
        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>4. Cancelación y reembolso</h2>
        <p>Puede cancelar su suscripción en cualquier momento. Los reembolsos se manejan caso por caso según nuestra política de reembolso.</p>
      </div>
    </div>
  )
}
