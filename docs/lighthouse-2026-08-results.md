# Lighthouse — 2026-08-12 — rama `feat/landing-remediation`

Medido con `npx lighthouse`, perfil **móvil**, contra `npm run build && npm start`
en local. La referencia de mayo se tomó sobre un deploy de Vercel, así que la
comparación de *Performance* no es estricta: en producción hay CDN, caché de
imágenes en el edge y compresión que aquí no existen. Las métricas de SEO,
accesibilidad y CLS sí son directamente comparables.

## Homepage `/`

| Categoría | Mayo 2026 (prod) | Agosto 2026 (local) | |
|---|---|---|---|
| Performance | 74 | 73 | ≈ |
| Accessibility | 100 | 100 | = |
| Best Practices | 92 | 96 | ↑ |
| **SEO** | **69** | **100** | **↑ +31** |

### Core Web Vitals

| Métrica | Mayo 2026 | Agosto 2026 | |
|---|---|---|---|
| FCP | 1,3 s | 2,3 s | ↓ (local, sin CDN) |
| **LCP** | **12,8 s** | **5,4 s** | **↑ −58 %** |
| CLS | 0 | 0 | = |
| TBT | 10 ms | 60 ms | ↓ |
| Speed Index | 3,3 s | 5,6 s | ↓ (local, sin CDN) |

## Qué explica los cambios

**SEO 69 → 100.** FAQPage JSON-LD, OG images generadas de 1200×630 (antes se
declaraba un JPG de 682×1024 con esas dimensiones), `canonical` en las rutas
nuevas y `robots` coherente.

**LCP 12,8 s → 5,4 s.** El fondo del hero era una `background-image` de CSS:
sin preload, sin `srcset` y sin pasar por el optimizador. Ahora es
`next/image` con `priority`, que emite `<link rel="preload">` y sirve la
imagen al tamaño del viewport.

**Best Practices 92 → 96.** Sin scripts de terceros antes del consentimiento.

## Lo que sigue abierto

**LCP 5,4 s está por encima del objetivo de 2,5 s.** Parte se recupera solo en
producción (CDN + caché de imágenes en el edge). Lo que no:

- **`public/hero-bg.webp` es 1080×1920, vertical.** `next/image` no puede
  inventar píxeles: en pantallas anchas recorta mucho y escala hacia arriba.
  Hace falta un original apaisado de ≥2560 px de ancho. Es la palanca que
  queda con más recorrido y depende de diseño, no de código.
- **900 ms de JavaScript sin usar.** Comprobado que **no** son los 6
  diccionarios (deuda M1 de la auditoría de junio): los chunks señalados no
  contienen las traducciones. Habría que perfilarlo aparte.

## Ruido de consola, solo en local

`/_vercel/insights/script.js` y `/_vercel/speed-insights/script.js` dan 404 al
ejecutar un build de producción fuera de Vercel — esas rutas las sirve la
plataforma. Desplegado no ocurre. Lighthouse lo cuenta en `errors-in-console`,
lo que penaliza *Best Practices* en esta medición local.
