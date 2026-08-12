import { ImageResponse } from 'next/og';

export const alt = 'Curso de Bachatango online — Luis y Sara';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * No incluye el precio a propósito: la imagen se cachea y quedaría
 * desincronizada del valor real de `courses.price_eur` en cuanto cambie.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #050505 0%, #12100b 60%, #1c1710 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            color: '#c0a062',
            fontSize: 26,
            letterSpacing: 6,
            fontWeight: 600,
          }}
        >
          <div style={{ width: 72, height: 2, background: '#c0a062' }} />
          CURSO COMPLETO
        </div>

        <div
          style={{
            display: 'flex',
            color: '#f5f2ec',
            fontSize: 82,
            lineHeight: 1.06,
            marginTop: 30,
            maxWidth: 900,
            letterSpacing: -2,
          }}
        >
          Aprende Bachatango desde cero
        </div>

        <div
          style={{
            display: 'flex',
            color: '#a9a29a',
            fontSize: 30,
            marginTop: 28,
            maxWidth: 820,
            lineHeight: 1.4,
          }}
        >
          Técnica, conexión y musicalidad con Luis y Sara
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 56,
            color: '#c0a062',
            fontSize: 24,
            letterSpacing: 3,
          }}
        >
          PAGO ÚNICO · ACCESO DE POR VIDA
        </div>
      </div>
    ),
    size,
  );
}
