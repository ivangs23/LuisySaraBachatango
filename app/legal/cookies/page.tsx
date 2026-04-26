import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Política de Cookies",
  description: "Información sobre el uso de cookies en la plataforma de Luis y Sara Bachatango.",
  openGraph: { title: "Política de Cookies | Luis y Sara Bachatango", url: "/legal/cookies" },
  alternates: { canonical: "/legal/cookies" },
  robots: { index: true, follow: false },
};

export default function CookiesPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', fontFamily: 'Playfair Display, serif' }}>Política de Cookies</h1>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-main)' }}>
        <p style={{ marginBottom: '1rem' }}>Última actualización: {new Date().toLocaleDateString()}</p>
        
        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>1. ¿Qué son las cookies?</h2>
        <p>Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita un sitio web.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>2. Cómo utilizamos las cookies</h2>
        <p>Utilizamos cookies para mejorar su experiencia en nuestro sitio web, recordar sus preferencias y analizar el tráfico del sitio.</p>

        <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem' }}>3. Gestión de cookies</h2>
        <p>Puede controlar y administrar las cookies a través de la configuración de su navegador.</p>
      </div>
    </div>
  )
}
