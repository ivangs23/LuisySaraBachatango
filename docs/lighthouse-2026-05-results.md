# Lighthouse Audit — Producción — 2026-05-07

Branch evaluado: `chore/post-audit5-hardening` (incluye audits 1-5 + post-audit5 hardening).
Deploy: https://luisy-sara-bachatango-2k7nsxgfs-ivangs23s-projects.vercel.app/

## Resultados por página

### / (Homepage)

| Categoría | Score |
|---|---|
| Performance | 74 |
| Accessibility | 100 |
| Best Practices | 92 |
| SEO | 69 |

**Core Web Vitals:**
- FCP: 1.3 s
- LCP: 12.8 s (FAIL — hero video poster image de 1.9 MB sin comprimir)
- CLS: 0
- TBT: 10 ms
- Speed Index: 3.3 s

### /courses

| Categoría | Score |
|---|---|
| Performance | 92 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 69 |

**Core Web Vitals:**
- FCP: 1.0 s
- LCP: 3.4 s
- CLS: 0
- TBT: 0 ms
- Speed Index: 2.5 s

## Highlights

### Logros (score ≥ 90)
- **Accessibility 100/100 en ambas páginas** — estructura semántica correcta, contraste, labels.
- **Best Practices 100/100 en /courses** y 92/100 en home (CSP activa, HTTPS, sin APIs deprecadas).
- **CLS perfecto (0)** en ambas páginas — cero layout shift.
- **TBT mínimo** (10 ms home, 0 ms courses) — main thread desocupado.
- **/courses Performance 92** — FCP 1.0 s, LCP 3.4 s, velocidad de carga excelente.

### Áreas a mejorar (score < 90)

**Performance homepage (74)**
- LCP de 12.8 s causado por `/hero-bg.png` (1.9 MB, 963×1920 px). Es el póster del `<video>` de fondo del Hero y es el LCP element real (los archivos de vídeo `/hero-video.mp4` y `/hero-video.webm` dan 404).
- Unused JavaScript: ~110 KiB potencialmente eliminables (savings ~300 ms en home, ~600 ms en courses).

**SEO 69/100 en ambas páginas**
- `x-robots-tag: noindex` en las respuestas HTTP — Vercel/Next.js emite este header en preview deployments por defecto. En producción real (dominio propio) este header no debería estar presente.

**Best Practices home (92)**
- CSP bloquea `instagram.com/embed.js` (script-src no incluye instagram.com).
- `/hero-video.mp4` y `/hero-video.webm` dan 404 — errores en consola.

**Accesibilidad /courses (100 → warning)**
- `label-content-name-mismatch` en las tarjetas de curso: el `aria-label="CURSO BACHATANGO"` no incluye el texto visible interno ("01 COMPLETO BACHATANGO … €199 COMPRAR →"). Lighthouse no penaliza el score pero DevTools lo reporta.

## Recomendaciones top 3

### 1. Optimizar `/hero-bg.png` (impacto: LCP 12.8 s → <3 s)
El póster del vídeo del Hero es 1.9 MB en PNG (963×1920 px). Acciones:
- Convertir a WebP/AVIF: ahorro estimado ~1.7 MB.
- Redimensionar a las dimensiones máximas de visualización (~810×1440 px): ahorro adicional ~750 KB.
- Usar `<Image>` de Next.js con `priority` y `sizes` en lugar del atributo `poster` directo en `<video>`, o al menos añadir un `<link rel="preload">` para el póster en el `<head>`.

### 2. Subir los archivos de vídeo faltantes o eliminar las referencias (impacto: errores de consola + Best Practices)
`/hero-video.mp4` y `/hero-video.webm` devuelven 404. Opciones:
- Subir los archivos a `/public/` (o usar una CDN y actualizar las `src`).
- Si el vídeo ya no se usa, eliminar el elemento `<video>` del Hero y sustituir por imagen estática con `<Image priority>`.
- Esto también resolvería el LCP degradado ya que el poster sería el único recurso grande.

### 3. Añadir `instagram.com` a la CSP o reemplazar el embed (impacto: Best Practices home)
El script `instagram.com/embed.js` es bloqueado por la CSP actual. Opciones:
- Añadir `https://www.instagram.com` a `script-src` en el header CSP de `next.config.ts`.
- O reemplazar el embed nativo de Instagram por una solución sin JS externo (oembed estático, imagen con enlace).

## Nota sobre SEO 69/100

El `x-robots-tag: noindex` es emitido automáticamente por Vercel en deployments con URL de preview (`*.vercel.app`). En el dominio de producción real (`luisysara.com` o similar) este header no estaría presente y el SEO score subiría a ~92+. No requiere acción en el código.

## Reproducción

HTML reports en `tmp/lighthouse/*.report.html` (NO commiteados — ver `.gitignore`).

Para regenerar (con SSO desactivado temporalmente):
```bash
BASE=https://luisy-sara-bachatango-2k7nsxgfs-ivangs23s-projects.vercel.app
npx lighthouse "$BASE/" --output=json,html --output-path=./tmp/lighthouse/home \
  --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
npx lighthouse "$BASE/courses" --output=json,html --output-path=./tmp/lighthouse/courses \
  --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
```

## Notas

- SSO (Vercel Deployment Protection) temporalmente desactivado durante la auditoría y restaurado al final. Estado final verificado: HTTP 401 restaurado correctamente.
- Audit corrido desde agente local (macOS Darwin 25.3.0, Lighthouse via `npx --yes`, Chrome headless).
- Lighthouse version: instalado on-demand vía npx en el momento de la auditoría.
