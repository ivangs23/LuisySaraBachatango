'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'sans-serif', minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
        <div>
          <h1>Algo salió mal</h1>
          <button onClick={reset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Reintentar</button>
        </div>
      </body>
    </html>
  );
}
