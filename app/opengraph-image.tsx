import { ImageResponse } from 'next/og';
import { getLandingStats } from '@/utils/landing/content';

export const alt = 'Luis y Sara Bachatango — Cursos online de Bachata y Bachatango';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Sin esto la imagen se prerenderiza en build y se queda congelada: editar una
 * cifra en el panel no se reflejaría hasta el siguiente despliegue. Con ISR se
 * regenera como mucho cada 5 minutos, igual que la home.
 */
export const revalidate = 300;

/**
 * OG image generada en lugar de un archivo estático. El motivo: la anterior
 * declaraba /luis-sara-about.jpg como 1200x630 cuando el fichero real es
 * 682x1024 (retrato), así que WhatsApp, Facebook y Twitter lo recortaban mal.
 *
 * Satori (el motor de next/og) exige `display` explícito en cualquier elemento
 * con más de un hijo, y no soporta `gap` fuera de flex. Respetar eso al editar.
 */
export default async function OpengraphImage() {
  // Era la tercera copia de las cifras y la razón de que se desincronizaran.
  const stats = await getLandingStats();

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
          LUIS &amp; SARA
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
          Domina el arte del Bachatango
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
          Cursos online con instructores internacionales
        </div>

        <div
          style={{
            display: 'flex',
            gap: 48,
            marginTop: 56,
            color: '#c0a062',
            fontSize: 24,
            letterSpacing: 3,
          }}
        >
          <div style={{ display: 'flex' }}>+{stats.years} AÑOS</div>
          <div style={{ display: 'flex' }}>+{stats.students} ALUMNOS</div>
          <div style={{ display: 'flex' }}>+{stats.countries} PAÍSES</div>
        </div>
      </div>
    ),
    size,
  );
}
