import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Página no encontrada</h1>
        <p style={{ opacity: 0.75, marginBottom: '1rem' }}>Lo sentimos, no encontramos lo que buscabas.</p>
        <Link href="/" style={{ textDecoration: 'underline' }}>Volver al inicio</Link>
      </div>
    </main>
  );
}
