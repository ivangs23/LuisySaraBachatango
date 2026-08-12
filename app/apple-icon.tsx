import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * apple-touch-icon, que faltaba por completo. iOS no redondea las esquinas de
 * este icono automáticamente, así que se dibuja el fondo pleno.
 */
export default function AppleIcon() {
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
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: -3,
        }}
      >
        LS
      </div>
    ),
    size,
  );
}
