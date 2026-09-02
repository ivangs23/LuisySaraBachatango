import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Luis y Sara Bachatango',
    short_name: 'L&S Bachatango',
    description: 'Plataforma de cursos online de Bachata y Bachatango.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#c0a062',
    // /icon.png es el logo real recortado y compuesto sobre fondo crema
    // (app/icon.png). Se declara con extensión: antes apuntaba a /icon, la
    // ruta que generaba app/icon.tsx dibujando las siglas; al pasar a fichero
    // estático esa ruta devuelve 404 y la PWA instalada se quedaba sin icono.
    //
    // El logo lleva tinta negra, así que va sobre fondo claro: sobre el
    // #050505 del tema oscuro sería invisible. Se declara también `maskable`
    // porque Android recorta un círculo inscrito, y por eso el PNG de 512
    // reserva un 16% de margen que ese recorte se puede comer sin tocar la
    // marca.
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
