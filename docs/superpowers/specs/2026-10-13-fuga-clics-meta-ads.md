# Fuga de clics y medición de Meta Ads en `/curso-bachatango`

**Fecha:** 2026-10-13
**Origen:** campaña de Meta Ads activa desde el 9-oct-2026 (carrusel + vídeo).

## El síntoma

En 4 días: **403 clics en el enlace**, **93 «visitas a la página de destino»**.
Se pierde el 77 %. Lo normal es perder un 20-40 %. Casi todo el tráfico es
móvil desde el navegador interno de Instagram y Facebook (Stories, Feed, Reels).

## Diagnóstico

Medido el 2026-10-13 contra producción (`luisysarabachatango.com`), con
user-agent de la app de Instagram y con los parámetros reales del anuncio.

### D1 — El píxel está detrás del banner de cookies (causa dominante)

Meta cuenta una «visita a la página de destino» cuando dispara `PageView`.
`fbq('init')` y `fbq('track','PageView')` viven dentro del bloque que exige
consentimiento de marketing (`components/ThirdPartyScripts.tsx:23,56-57`), y
ambas categorías nacen denegadas (`context/ConsentContext.tsx:99`). Quien no
pulsa *Aceptar* carga la página perfectamente y Meta no se entera.

93/403 = 23 %, que es una tasa de aceptación de banner normal en móvil. La
mayor parte del «77 % de pérdida» es medición, no abandono.

**Dato que lo separa:** `landing_events` registra cada visita con `sendBeacon`
**fuera** del gate de consentimiento (`components/LandingAnalytics.tsx:20-21`) y
se pinta en `/admin/landing`. Si los únicos de `/curso-bachatango` desde el
9-oct rondan 300-400, es medición. Si rondan 100, es velocidad.

Bajo RGPD no existe forma legítima de que Meta cuente LPV de quien rechazó
marketing: `fbq('consent','revoke')` encola los eventos sin enviarlos, y la
Conversions API también debe obedecer el consentimiento
(`utils/analytics/meta-capi.ts:119`). Las dos palancas reales son subir la tasa
de aceptación y dejar de usar LPV como métrica de salud.

### D2 — LCP de 6,8 s en móvil

Lighthouse móvil sobre producción: Performance **76**, FCP 1,0 s,
**LCP 6,8 s**, TBT 80 ms, CLS 0, Speed Index 2,4 s.

Elemento LCP: la `<section class="hero">`. Desglose de fases —
TTFB 0,66 s · **espera a descubrir la imagen 3,55 s** · descarga 1,15 s ·
pintado 1,45 s.

La portada es un `background-image` en un `style` en línea
(`app/curso-bachatango/_components/LandingHero.tsx:25`): el navegador no puede
descubrirla hasta parsear el CSS y maquetar. Encima es un **PNG de 383 KB**
servido crudo desde Supabase Storage sin pasar por `next/image` (ni WebP/AVIF
ni redimensionado para 390 px de ancho) y con `cache-control: no-cache` en el
objeto. Lighthouse: `modern-image-formats` 363 KB de ahorro.

### D3 — La función se ejecuta en us-east-1 y los compradores están en España

`x-vercel-id: cdg1::iad1::…` en 5 de 5 peticiones: PoP en París, función en
**iad1**. TTFB medido desde Madrid por fibra: 0,56-1,30 s.

El origen de Supabase responde a 62-80 ms desde España con 34 ms de TLS, o sea
~28 ms de ida y vuelta real: **el proyecto de Supabase está en Europa**. Mover
la función a Europa acerca a la vez al visitante y a la base de datos.

### D4 — Nada se cachea

`cache-control: private, no-cache, no-store` y `x-vercel-cache: MISS` en toda
petición, incluida `/`, que declara `revalidate = 300` (`app/page.tsx:18`). Lo
anula el layout raíz, que lee cookies (`app/layout.tsx:97-99`).

Cada clic de anuncio paga render en vivo + 3 consultas a Supabase
(`landing-course`, `curriculum`, `free-lesson`) + 2 firmas RS256 de Mux. Y mata
el bfcache (`MainResourceHasCacheControlNoStore`): volver atrás desde Stripe
re-renderiza en lugar de restaurar.

Además el trabajo del layout se tira en la landing: `Header` devuelve `null` en
las rutas del embudo (`components/Header.tsx:93`, `utils/nav/chromeless-routes.ts`).

### D5 — 136 KB de iconos en cada carga

`app/favicon.ico` 82 KB y `app/icon.png` 55 KB, ambos con
`cache-control: public, max-age=0, must-revalidate`.

### D6 — 454 KB de JS comprimido

17 chunks, el mayor 145 KB; 155 KB sin usar según Lighthouse. Sentry carga en
navegador en producción con Replay activo (`instrumentation-client.ts:13`,
`replaysOnErrorSampleRate: 0.1`), lo que arrastra el bundle de Replay a todas
las páginas. TBT es solo 80 ms: son bytes en 4G, no CPU.

### D7 — Redirecciones

| URL | Resultado |
|---|---|
| `http://…/curso-bachatango` | 308 → https (correcto, inevitable) |
| `https://www.…/curso-bachatango` | 307 → sin www; el TLS a www tardó 1,26 s |
| `https://…/curso-bachatango/?utm…` | **308** → misma URL sin barra final |
| `https://…/curso-bachatango?utm…&fbclid=…` | 200 directo |

El proxy no redirige la landing: para ruta pública sin cookie de sesión se
salta Supabase entero (`utils/supabase/middleware-helper.ts:48`).

### D8 — Navegador interno de Instagram/Facebook

Nada roto: sin service worker, sin pop-ups, sin aviso de «abrir en el
navegador», sin APIs incompatibles. Los dos agravantes son los ya listados: sin
bfcache (D4) y el coste de aceptar el banner en pantalla pequeña (D1).

### D9 — La medición de conversiones ya está escrita, sin desplegar

Todo el punto 5 del encargo vive en la rama `feat/meta-capi-purchase`:
`InitiateCheckout` (`components/LandingCheckoutForm.tsx:67-80`), `Purchase` de
navegador una sola vez por `session_id` (`app/gracias/PurchaseTracking.tsx:94-104`),
`Purchase` de servidor por CAPI con el mismo `event_id`
(`app/api/webhooks/stripe/route.ts:37-62`, solo en `genuineInsert`), con
`em`/`fn`/`ln` en SHA-256, `fbp`, `fbc`, `client_ip_address` y
`client_user_agent` (`utils/analytics/meta-capi.ts:69-101`) y el token solo en
`META_CAPI_TOKEN`. 1030 tests en verde.

## Objetivo

1. Que Meta vea las visitas que de verdad ocurren, dentro de lo que permite el RGPD.
2. Que la landing cargue rápido en 4G dentro del navegador de Instagram.
3. Dejar la medición de conversiones terminada, desplegada y verificada.

## Criterios de aceptación

- LCP móvil de `/curso-bachatango` **< 2,5 s** (desde 6,8 s) y Performance > 90.
- `x-vercel-id` con región europea en el segundo segmento.
- Peso de iconos por carga **< 20 KB** (desde 136 KB).
- `InitiateCheckout` y los dos `Purchase` visibles y **deduplicados** en
  *Administrador de eventos → Probar eventos*.
- Ningún cambio reduce la prominencia del botón *Rechazar* del banner: la
  equivalencia visual entre aceptar y rechazar es un requisito legal (AEPD), no
  una preferencia de diseño.

## Fuera de alcance

- Migrar el sitio a Cache Components / PPR de Next 16 para servir la landing
  estática. Es la ganancia estructural mayor, toca el layout raíz de todo el
  sitio y merece su propio proyecto. Aquí se recorta el coste por petición
  (cachear las tres lecturas) sin tocar el modelo de renderizado.
- Cambiar las URL de los anuncios en Meta. Es acción de la cuenta de ads, no
  del repositorio; queda como prerrequisito.
