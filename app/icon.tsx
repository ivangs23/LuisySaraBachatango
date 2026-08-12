import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/**
 * Icono cuadrado generado. El manifest declaraba /logo.png con `sizes: 'any'`,
 * pero ese fichero es 576x1024 (retrato) y Android e iOS lo deformaban al
 * instalar la PWA.
 *
 * Las siglas van centradas con margen de sobra para que el mismo PNG sirva
 * también como `maskable`, donde Android recorta un círculo.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050505',
          color: '#c0a062',
          fontSize: 230,
          fontWeight: 700,
          letterSpacing: -10,
        }}
      >
        LS
      </div>
    ),
    size,
  );
}
