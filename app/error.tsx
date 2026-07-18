'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Algo salió mal</h1>
        <p style={{ opacity: 0.75, marginBottom: '1rem' }}>Ha ocurrido un error. Inténtalo de nuevo.</p>
        <button onClick={reset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Reintentar</button>
      </div>
    </main>
  );
}
