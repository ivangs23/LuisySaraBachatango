# Lighthouse — 2026-10-13 — remediación de la fuga de clics de Meta Ads

Medido con `npx lighthouse@12`, perfil **móvil**, `--throttling-method=simulate`,
contra **producción** y con los parámetros reales del anuncio:

```
https://luisysarabachatango.com/curso-bachatango?utm_source=meta&utm_medium=paid&utm_campaign=bachatango&utm_content=carrusel
```

La línea base es de **una sola pasada**; el «después» es la **mediana de tres**.
Esa asimetría importa para leer la tabla y se comenta abajo.

Diagnóstico y plan que originaron esto:
[spec](superpowers/specs/2026-10-13-fuga-clics-meta-ads.md) ·
[plan](superpowers/plans/2026-10-13-fuga-clics-meta-ads.md).

## Core Web Vitals

| Métrica | Antes (1 pasada) | Después (mediana de 3) | Pasadas | |
|---|---|---|---|---|
| **LCP** | **6,81 s** | **3,72 s** | 3,91 · 3,72 · 3,36 | **↑ −45 %** |
| FCP | 0,98 s | 1,91 s | 1,91 · 2,09 · 0,96 | ruido, ver abajo |
| Speed Index | 2,44 s | 3,48 s | 3,48 · 4,68 · 1,09 | ruido, ver abajo |
| TBT | 84 ms | 93 ms | 93 · 128 · 55 | ≈ |
| CLS | 0 | 0 | 0 · 0 · 0 | = |
| Performance | 76 | 85 | 85 · 83 · 92 | ↑ +9 |

**El LCP es la única mejora que el dato sostiene.** Las tres pasadas caen en
3,36-3,91 s, sin solape con los 6,81 s de partida.

**FCP y Speed Index no se pueden afirmar en ninguna dirección.** Sus pasadas van
de 0,96 a 2,09 s y de 1,09 a 4,68 s: el rango de una sola métrica es mayor que
la diferencia que se le atribuye, y la línea base es una sola medición con la
misma incertidumbre. Decir «el FCP ha empeorado 0,9 s» sería leer ruido como
señal. Para zanjarlo harían falta medianas de 5+ pasadas a ambos lados.

## Medidas que no dependen de Lighthouse

Estas sí son deterministas.

| | Antes | Después |
|---|---|---|
| Región de la función (`x-vercel-id`) | `cdg1::iad1::` (Washington) | `cdg1::cdg1::` (París) |
| TTFB real desde Madrid por fibra | 0,56 - 1,30 s | **0,23 s** (3 tomas: 0,242 · 0,231 · 0,230) |
| Imagen de portada | 383 KB PNG | **9 KB AVIF** |
| `favicon.ico` | 82.480 B, `max-age=0` | 2.267 B, `immutable` |
| `icon.png` | 54.744 B, `max-age=0` | 6.079 B, `immutable` |
| Consultas a Supabase por clic | 3 | 0 con caché caliente (TTL 5 min) |

## Qué explica los cambios

**La portada del hero, de `background-image` a `next/image`.** Era el elemento
LCP y el navegador no podía descubrirla hasta parsear el CSS y maquetar: se
midieron **3.550 ms solo de espera** antes de empezar a descargar. Con el
`<link rel="preload">` en el `<head>` esa fase cae a **172 ms**. Y el fichero
pasa de 383 KB PNG a 9 KB AVIF ya redimensionado.

En Next 16.2.5 `priority` ya **no** pone `fetchpriority` en el `<img>`: solo
activa el preload. Hay que pasar `fetchPriority="high"` aparte, y eso alimenta
también el `fetchpriority` del propio preload.

**La función, de us-east-1 a cdg1.** El PoP estaba en París y la función en
Washington: cada render cruzaba el Atlántico. Supabase está en `eu-west-1`.

Se eligió `cdg1` y no `dub1` —que estaría pegado a la base de datos— porque con
las lecturas ya cacheadas la mayoría de peticiones no toca Supabase, y entonces
manda el salto PoP→función: ~0 ms con `cdg1` contra ~20 ms con `dub1`. En fallo
de caché `dub1` ganaría ~18 ms. Si el ratio de acierto resultara malo, es un
cambio de una línea en `vercel.json`.

**Iconos.** 136 KB que se revalidaban en cada carga, por delante del contenido.
Regenerados con sharp: 7,4 KB en total y `immutable`.

**Las tres lecturas de la landing, cacheadas 5 min** con invalidación al editar
el curso o sus lecciones. El precio anunciado sale de la caché; el que cobra
Stripe, de una lectura fresca — por eso la invalidación no es opcional.

**Sentry sin Session Replay: 0 bytes de ahorro.** El plan esperaba −60/−80 KB.
Medido: 3.756 KB de chunks antes y después, y ningún chunk contenía código de
Replay en ningún momento. El SDK solo lo incluye si se registra
`Sentry.replayIntegration()`, cosa que esta configuración nunca hizo. El cambio
se mantuvo porque deja la config veraz, no por rendimiento.

## Objetivos del plan: uno cumplido, dos no

| Criterio | Objetivo | Resultado | |
|---|---|---|---|
| LCP móvil | < 2,5 s | 3,72 s | ✗ |
| Performance | > 90 | 85 | ✗ (una pasada llegó a 92) |
| `x-vercel-id` europeo | sí | `cdg1::cdg1::` | ✓ |
| Iconos por carga | < 20 KB | 8,3 KB | ✓ |

## Qué queda para bajar de 2,5 s

Con la imagen ya en 9 KB y el *load delay* en 172 ms, el LCP restante se reparte
entre **render delay (~1.970 ms)** y el TTFB simulado. No queda nada que rascar
en la imagen: el cuello se ha movido.

1. **La página sigue siendo 100 % dinámica.** `cache-control: private, no-cache,
   no-store` y `x-vercel-cache: MISS` en toda petición, porque el layout raíz lee
   cookies. Es la migración a Cache Components/PPR que la spec dejó
   explícitamente fuera de alcance, y ahora es la palanca mayor que queda.
   Recupera además el bfcache, hoy desactivado.
2. **160 KB de JavaScript sin usar** según Lighthouse, con 0,7 s de trabajo en el
   hilo principal. Es lo que más puede morder el render delay.
3. La fuente Inter pesa 48 KB y entra en la cadena crítica.

## Cómo reproducir

```bash
npx --yes lighthouse@12 "https://luisysarabachatango.com/curso-bachatango?utm_source=meta&utm_medium=paid&utm_campaign=bachatango&utm_content=carrusel" \
  --form-factor=mobile --throttling-method=simulate \
  --only-categories=performance --quiet \
  --chrome-flags="--headless=new --no-sandbox"
```

Repetir 3-5 veces y quedarse con la mediana. Una sola pasada de esta página
varía más de un segundo en FCP.

## Lo que esto NO arregla

El 77 % de clics perdidos es **en su mayor parte medición, no abandono**: el
píxel está detrás del banner de cookies, así que Meta solo cuenta la visita de
quien pulsa *Aceptar*. 93 de 403 (23 %) es una tasa de aceptación de banner
normal en móvil.

Bajo RGPD no hay forma legítima de que Meta cuente a quien rechazó marketing.
Las palancas reales son subir la aceptación (el banner se acortó: cuerpo de 231
a 142 caracteres y panel de `80vh` a `min(70vh, 32rem)`) y dejar de usar «visitas
a la página de destino» como métrica de salud, optimizando hacia `Purchase` —que
ahora sí llega por la API de conversiones— y vigilando el embudo propio de
`/admin/landing`, que registra cada visita fuera del gate de consentimiento.
