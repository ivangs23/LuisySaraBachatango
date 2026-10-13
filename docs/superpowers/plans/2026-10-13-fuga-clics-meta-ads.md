# Fuga de clics y medición de Meta Ads — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la landing `/curso-bachatango` cargue en menos de 2,5 s de LCP en 4G dentro del navegador de Instagram, que Meta vea las visitas y las conversiones que de verdad ocurren dentro de lo que permite el RGPD, y dejar la Conversions API desplegada y verificada.

**Architecture:** Siete cambios independientes sobre la rama actual, ordenados por impacto/riesgo. Tres son de infraestructura y configuración (región de función, iconos, Sentry), tres de código de producto (portada con `next/image`, caché de las tres lecturas de la landing, `cacheControl` al subir portadas) y uno de superficie legal (banner de cookies, solo copy y compacidad — nunca prominencia relativa de los botones). No se toca el modelo de renderizado del sitio: la migración a Cache Components/PPR queda fuera de alcance.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Supabase (`@supabase/ssr` + service role), Stripe, Mux, Sentry, Vitest 4 + Testing Library, CSS Modules, Vercel.

**Spec:** [docs/superpowers/specs/2026-10-13-fuga-clics-meta-ads.md](../specs/2026-10-13-fuga-clics-meta-ads.md)

## Global Constraints

- Suite completa en verde al final de cada tarea: `npm test` → 1030 tests, 126 ficheros, 0 fallos como línea base. Ninguna tarea puede bajar ese número.
- `npm run lint` y `npx tsc --noEmit` limpios. CI los ejecuta en cada push junto con `npm run build`.
- Un commit por tarea, al final, con los ficheros de esa tarea y nada más.
- Comentarios y mensajes de usuario en español; nombres de símbolos en el idioma que ya use el fichero que se toca.
- Tests en `__tests__/` replicando la ruta del fuente. Entorno `node` por defecto; los de componente abren con el docblock `// @vitest-environment jsdom` en la primera línea.
- **Nada se despliega a producción sin confirmación explícita del usuario.** Las tareas llegan hasta el commit en la rama.
- El precio que llega a Stripe sale siempre de una lectura fresca de la base de datos en `app/curso-bachatango/comprar/actions.ts:85`. Ningún cambio de caché puede tocar esa ruta.
- Prominencia visual idéntica entre *Aceptar todo* y *Rechazar* en el banner de consentimiento. Es requisito AEPD, no preferencia de diseño.
- El píxel y la CAPI usan el **mismo** `NEXT_PUBLIC_META_PIXEL_ID` (941883441913782) o Meta no deduplica.

## Review Focus

Cinco cosas que la spec da por hechas y que ninguna tarea testearía si no se dice aquí. Cada línea tiene ya su test asignado a la tarea que posee el código.

1. **`image_url` de un host que no está en `remotePatterns`.** `next/image` lanza `Invalid src prop` en render y la landing devuelve 500 — la página que vende, caída. Un admin que pegue una URL de otro dominio en el formulario de curso basta para provocarlo. Esperado: la portada se omite y la landing sigue vendiendo. → Tarea 3, pasos 1-2 y 9.
2. **Precio rancio tras editar el curso.** Con las lecturas cacheadas 5 minutos, la landing podría anunciar 119 € mientras Stripe cobra 129 €. Esperado: editar el curso invalida la caché en el acto. → Tarea 6, pasos 7-10.
3. **Región de función movida a Europa con la base de datos en EE. UU.** Sería una regresión, no una mejora: cada consulta cruzaría el Atlántico. Esperado: no se toca la región sin confirmar antes la región real del proyecto Supabase. → Prerrequisito P2, bloqueante de la Tarea 1.
4. **`image_url` a null o cadena vacía.** La landing ya se renderiza sin portada hoy; al meter `next/image` es fácil romperlo. Esperado: hero sin imagen, con su color de fondo. → Tarea 3, paso 9.
5. **Supabase sin responder con las lecturas cacheadas.** `getCurriculum` y `getFreeLesson` devuelven `null` y la landing debe seguir vendiendo sin temario ni vídeo; con `unstable_cache` de por medio, un `null` podría quedar cacheado 5 minutos. Esperado: el fallo no se cachea. → Tarea 6, pasos 3-6.

---

## Prerrequisitos (los hace el usuario, sin código)

Ninguna tarea de código depende de P1, P3 ni P4. **P2 bloquea la Tarea 1.**

- [ ] **P1 — Leer el dato propio.** Entrar en `/admin/landing`, rango desde el 9-oct, y anotar los visitantes únicos de `/curso-bachatango`. Si rondan 300-400, el 77 % es medición (D1). Si rondan 100, pesa más la velocidad (D2). Las dos ramas del plan se ejecutan igual; el número decide qué se le cuenta al cliente.

- [ ] **P2 — Confirmar la región de Supabase.** Panel de Supabase → *Settings* → *General* → *Region*. Anotarla. La medición desde España (62-80 ms de TTFB con 34 ms de TLS) dice Europa, pero esto hay que verlo, no deducirlo: si saliera `us-east-1`, la Tarea 1 se cancela y se anota por qué.

- [ ] **P3 — Pegar aquí la URL exacta de los dos anuncios.** Tal cual está en Meta. Si lleva barra final antes de la `?` o lleva `www.`, cada clic paga una redirección completa (D7) y se corrige en la cuenta de ads, no en el repositorio.

- [ ] **P4 — Variables de entorno en Vercel** (*Settings → Environment Variables*):
  - `META_CAPI_TOKEN` — token de *Events Manager → Settings → Generate access token*. Solo entorno **Production**.
  - `META_TEST_EVENT_CODE` — solo mientras se verifica. **Vaciar antes de dar producción por buena.**

---

## Tarea 1: Función en Europa

Mueve la ejecución de las funciones de `iad1` (Washington) a `cdg1` (París). Es el único cambio que acerca a la vez el visitante y la base de datos, y no toca una línea de producto. **Requiere P2 confirmado como región europea.**

**Files:**
- Modify: `vercel.json`
- Test: `__tests__/config/vercel-region.test.ts` (crear)

**Interfaces:**
- Consumes: nada.
- Produces: nada que consuma otra tarea.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/config/vercel-region.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El público y la base de datos están en Europa. Con la función en us-east-1
 * cada render cruzaba el Atlántico dos veces: una por el visitante y otra por
 * cada consulta a Supabase. Se midió `x-vercel-id: cdg1::iad1::…` en 5 de 5
 * peticiones y un TTFB de 0,56-1,30 s desde Madrid por fibra.
 *
 * Regiones europeas de Vercel. Si algún día el proyecto de Supabase se mueve
 * fuera de Europa, este test debe cambiar a la vez que `vercel.json` — no al
 * revés.
 */
const REGIONES_EUROPEAS = ['cdg1', 'fra1', 'arn1', 'dub1', 'lhr1']

describe('vercel.json', () => {
  const config = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { regions?: string[]; crons?: unknown[] }

  it('fija una única región europea para las funciones', () => {
    expect(config.regions).toHaveLength(1)
    expect(REGIONES_EUROPEAS).toContain(config.regions?.[0])
  })

  it('no pierde el cron de purga de pendientes', () => {
    expect(config.crons).toEqual([
      { path: '/api/cron/purge-pending', schedule: '0 4 * * *' },
    ])
  })
})
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npx vitest run __tests__/config/vercel-region.test.ts`
Expected: FAIL — `expected undefined to have a length of 1`.

- [ ] **Step 3: Implementar**

Reemplazar el contenido completo de `vercel.json`:

```json
{
  "regions": ["cdg1"],
  "crons": [
    { "path": "/api/cron/purge-pending", "schedule": "0 4 * * *" }
  ]
}
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

Run: `npx vitest run __tests__/config/vercel-region.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Suite completa**

Run: `npm test`
Expected: PASS, 1032 tests (los 1030 de base + 2).

- [ ] **Step 6: Commit**

```bash
git add vercel.json __tests__/config/vercel-region.test.ts
git commit -m "perf(vercel): ejecutar las funciones en cdg1 en vez de us-east-1"
```

- [ ] **Step 7: Verificación tras el despliegue** (no antes; requiere OK del usuario)

```bash
curl -sSI https://luisysarabachatango.com/curso-bachatango | grep -i x-vercel-id
```

Esperado: el **segundo** segmento es una región europea, p. ej. `cdg1::cdg1::…`. Si sigue saliendo `iad1`, el plan Hobby puede estar ignorando `vercel.json`: fijarlo entonces en *Settings → Functions → Function Region* del panel y dejar el test como guardia documental.

---

## Tarea 2: Iconos de 136 KB a menos de 20 KB

`app/favicon.ico` pesa 82 KB y `app/icon.png` 55 KB, y ambos se revalidan en cada visita. Son 136 KB que el móvil descarga antes de ver nada útil.

**Files:**
- Modify: `app/favicon.ico` (regenerar), `app/icon.png` (regenerar)
- Modify: `next.config.ts:38-74` (bloque `headers()`)
- Test: `__tests__/config/icon-budget.test.ts` (crear)

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/config/icon-budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Presupuesto de iconos. Antes pesaban 82 KB (favicon.ico) y 55 KB (icon.png)
 * y se descargaban en cada carga móvil de la landing de pago: 136 KB por
 * delante del contenido. Un favicon correcto no pasa de unos pocos KB.
 *
 * Si alguien vuelve a exportar el logo a tamaño completo sobre estos ficheros,
 * este test lo para antes del despliegue.
 */
const PRESUPUESTO_BYTES: Record<string, number> = {
  'app/favicon.ico': 15_000,
  'app/icon.png': 10_000,
  'app/apple-icon.png': 25_000,
}

describe('presupuesto de iconos', () => {
  for (const [ruta, maximo] of Object.entries(PRESUPUESTO_BYTES)) {
    it(`${ruta} pesa menos de ${Math.round(maximo / 1000)} KB`, () => {
      const bytes = statSync(join(process.cwd(), ruta)).size
      expect(bytes).toBeLessThan(maximo)
    })
  }
})
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npx vitest run __tests__/config/icon-budget.test.ts`
Expected: FAIL en `app/favicon.ico` (82480) y `app/icon.png` (54744). `app/apple-icon.png` (19839) pasa.

- [ ] **Step 3: Regenerar `icon.png` a 192×192**

`sips` viene con macOS. Se parte del original de mayor calidad, que es el propio `icon.png` antes de tocarlo:

```bash
cp app/icon.png /tmp/icon-original.png
sips -Z 192 /tmp/icon-original.png --out app/icon.png
ls -l app/icon.png
```

Esperado: por debajo de 10 KB. Si se pasara, bajar a `-Z 180`.

- [ ] **Step 4: Regenerar `favicon.ico` multi-tamaño**

```bash
sips -Z 32 /tmp/icon-original.png --out /tmp/favicon-32.png
sips -Z 16 /tmp/icon-original.png --out /tmp/favicon-16.png
npx --yes png-to-ico /tmp/favicon-32.png /tmp/favicon-16.png > app/favicon.ico
ls -l app/favicon.ico
```

Esperado: por debajo de 15 KB (lo normal son 2-5 KB).

- [ ] **Step 5: Ejecutar el test y comprobar que pasa**

Run: `npx vitest run __tests__/config/icon-budget.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Comprobar a ojo que los iconos siguen siendo el logo**

```bash
open app/icon.png app/favicon.ico
```

Esperado: el logo de Luis y Sara, nítido, sin recortes ni fondo roto. Si se ve borroso o mal recortado, rehacer desde el original a mayor resolución antes de seguir.

- [ ] **Step 7: Cachear los iconos en el CDN**

En `next.config.ts`, dentro de `async headers()`, añadir una segunda entrada **después** del bloque `source: '/(.*)'` que ya existe, sin tocarlo:

```ts
      {
        // Los iconos no cambian entre despliegues y hoy se revalidaban en cada
        // visita (`max-age=0, must-revalidate`). Next sirve `/favicon.ico` con
        // un hash en la query, así que un cacheado largo no deja iconos viejos
        // pegados: al cambiar el fichero cambia la URL.
        source: '/:icon(favicon.ico|icon.png|apple-icon.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
```

- [ ] **Step 8: Comprobar que el build sigue limpio**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 9: Suite completa**

Run: `npm test`
Expected: PASS, 1035 tests.

- [ ] **Step 10: Commit**

```bash
git add app/favicon.ico app/icon.png next.config.ts __tests__/config/icon-budget.test.ts
git commit -m "perf(iconos): 136 KB a menos de 20 KB y cacheado largo en el CDN"
```

---

## Tarea 3: La portada del hero, por `next/image`

El cambio que mueve el LCP. Hoy la portada es un `background-image` en un `style` en línea: el navegador no puede descubrirla hasta parsear el CSS y maquetar, y se midieron **3,55 s** solo de espera antes de empezar a descargar, más 1,15 s de descarga de un PNG de 383 KB. Con `next/image` y `priority` el preload sale en el `<head>`, la imagen se sirve en AVIF/WebP ya redimensionada y el objeto pasa por la caché de imágenes de Vercel (`minimumCacheTTL: 86400`), que neutraliza el `cache-control: no-cache` que manda Supabase.

**Files:**
- Create: `utils/images/optimizable.ts`
- Create: `__tests__/utils/optimizable-image.test.ts`
- Modify: `app/curso-bachatango/_components/LandingHero.tsx:1-26`
- Modify: `app/curso-bachatango/page.module.css:21-31` (bloque `.hero`)
- Modify: `next.config.ts:16-18` (bloque `images`)
- Test: `__tests__/components/landing-hero.test.tsx`

**Interfaces:**
- Consumes: `sanitizeUrl` de `@/utils/sanitize`.
- Produces: `isOptimizableImageUrl(raw: string | null | undefined): boolean` desde `@/utils/images/optimizable`. La Tarea 4 no lo usa; ninguna otra tarea depende de él.

- [ ] **Step 1: Escribir el test que falla del guardián de host**

Crear `__tests__/utils/optimizable-image.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isOptimizableImageUrl } from '@/utils/images/optimizable'

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
})
afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL
})

describe('isOptimizableImageUrl', () => {
  it('acepta un objeto público del bucket de Supabase', () => {
    expect(isOptimizableImageUrl(
      'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/course-covers/a.png',
    )).toBe(true)
  })

  it('rechaza otro host aunque sea https', () => {
    expect(isOptimizableImageUrl('https://evil.example.com/a.png')).toBe(false)
  })

  it('rechaza http', () => {
    expect(isOptimizableImageUrl(
      'http://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/a.png',
    )).toBe(false)
  })

  it('rechaza una ruta privada del mismo host', () => {
    expect(isOptimizableImageUrl(
      'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/sign/thumbnails/a.png',
    )).toBe(false)
  })

  it('rechaza null, vacío y basura', () => {
    expect(isOptimizableImageUrl(null)).toBe(false)
    expect(isOptimizableImageUrl('')).toBe(false)
    expect(isOptimizableImageUrl('no-es-una-url')).toBe(false)
  })

  it('rechaza todo si falta NEXT_PUBLIC_SUPABASE_URL', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(isOptimizableImageUrl(
      'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/a.png',
    )).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run __tests__/utils/optimizable-image.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/images/optimizable"`.

- [ ] **Step 3: Implementar el guardián**

Crear `utils/images/optimizable.ts`:

```ts
/**
 * ¿Puede `next/image` optimizar esta URL?
 *
 * Importa porque `<Image>` LANZA en render si el `src` no casa con
 * `images.remotePatterns` de next.config.ts. En la landing eso no sería una
 * imagen rota: sería un 500 en la página que vende, provocable por un admin
 * que pegue en el formulario de curso una URL de cualquier otro dominio.
 *
 * Esta función es el espejo exacto del `remotePatterns` de Supabase que hay en
 * next.config.ts. Si allí se añade un host, aquí también — y al revés.
 *
 * No sustituye a `sanitizeUrl()`: aquella valida la forma, esta la pertenencia.
 * El hero llama a las dos.
 */
export function isOptimizableImageUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string' || !raw) return false

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Fail-closed: sin la variable no se puede saber qué host es legítimo, así
  // que no se optimiza nada y la landing sale sin portada en vez de caerse.
  if (!base) return false

  let host: string
  try {
    host = new URL(base).host
  } catch {
    return false
  }

  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      url.host === host &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run __tests__/utils/optimizable-image.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit intermedio**

```bash
git add utils/images/optimizable.ts __tests__/utils/optimizable-image.test.ts
git commit -m "feat(imagenes): guardian de host optimizable por next/image"
```

- [ ] **Step 6: Escribir los tests que fallan del hero**

Añadir al final del `describe('LandingHero', …)` de `__tests__/components/landing-hero.test.tsx`:

```tsx
  const PORTADA =
    'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/course-covers/a.png'

  it('pinta la portada como <img> con prioridad, no como background-image', () => {
    const { container } = render(
      <LandingHero copy={COPY} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={PORTADA} />,
    )
    // El elemento LCP tiene que ser descubrible en el HTML: con una
    // background-image el navegador esperaba 3,55 s a parsear el CSS.
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('fetchpriority', 'high')
    // Decorativa: el titular ya dice lo que hay que leer.
    expect(img).toHaveAttribute('alt', '')
    expect(container.querySelector('section')?.getAttribute('style') ?? '')
      .not.toContain('background-image')
  })

  it('omite la portada —sin romper la página— si el host no es optimizable', () => {
    const { container } = render(
      <LandingHero
        copy={COPY}
        courseId="c1"
        isAuthed={false}
        offer={OFFER}
        imageUrl="https://evil.example.com/a.png"
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('se renderiza sin portada cuando imageUrl es null', () => {
    const { container } = render(
      <LandingHero copy={COPY} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
```

Y al principio del fichero, **después** del `vi.mock('next/navigation', …)` existente, fijar la variable que lee el guardián:

```tsx
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
```

- [ ] **Step 7: Ejecutar y comprobar que falla**

Run: `npx vitest run __tests__/components/landing-hero.test.tsx`
Expected: FAIL — `expected null not to be null` en el primer test nuevo; los 3 originales siguen pasando.

- [ ] **Step 8: Implementar el hero**

Reemplazar las líneas 1-26 de `app/curso-bachatango/_components/LandingHero.tsx` (desde `'use client';` hasta la apertura de `<section>` incluida) por:

```tsx
'use client';

import Image from 'next/image';
import { sanitizeUrl } from '@/utils/sanitize';
import { isOptimizableImageUrl } from '@/utils/images/optimizable';
import { formatSpotsLeft, type CourseOffer } from '@/utils/courses/offer';
import OfferPrice from '@/components/OfferPrice';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface HeroProps {
  copy: LandingCopy;
  courseId: string;
  isAuthed: boolean;
  offer: CourseOffer;
  imageUrl: string | null;
}

export default function LandingHero({ courseId, isAuthed, offer, imageUrl, copy }: HeroProps) {
  const c = copy.hero;
  // Dos filtros, no uno: `sanitizeUrl` valida la forma (https, sin
  // `javascript:`) y `isOptimizableImageUrl` la pertenencia al bucket que
  // declara `remotePatterns`. Sin el segundo, una portada de otro dominio
  // haría LANZAR a <Image> y la landing devolvería 500.
  const safeBg = imageUrl ? sanitizeUrl(imageUrl) : null;
  const bg = isOptimizableImageUrl(safeBg) ? safeBg : null;
  const spotsText = formatSpotsLeft(copy.offer.spotsLeft, offer.spotsLeft);
  return (
    <section className={styles.hero}>
      {/* El fondo deja de ser una background-image de CSS: así `priority`
          emite el <link rel="preload"> en el <head> y el navegador empieza a
          bajar la portada sin esperar a maquetar. Era el elemento LCP y la
          espera a descubrirla costaba 3,55 s. */}
      {bg && (
        <div className={styles.heroBg} aria-hidden="true">
          <Image src={bg} alt="" fill priority sizes="100vw" className={styles.heroBgImage} />
          <div className={styles.heroScrim} />
        </div>
      )}
```

El resto del fichero se queda igual, pero el `<div className={styles.heroInner}>` necesita quedar por encima del fondo: eso lo resuelve el CSS del paso siguiente, no el TSX.

- [ ] **Step 9: Ajustar el CSS**

En `app/curso-bachatango/page.module.css`, reemplazar el bloque `.hero` y añadir los tres nuevos justo detrás:

```css
.hero {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-2xl) var(--page-pad);
  background-color: #050505;
  overflow: hidden;
}
.heroBg { position: absolute; inset: 0; z-index: 0; }
.heroBgImage { object-fit: cover; object-position: center; }
/* El mismo degradado que antes iba en la background-image en línea: mantiene
   el contraste del titular sobre cualquier portada. */
.heroScrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(rgba(5, 5, 5, 0.6), rgba(5, 5, 5, 0.85));
}
.heroInner { position: relative; z-index: 1; max-width: 720px; }
```

(La regla `.heroInner` ya existía con `max-width: 720px`; esta la sustituye.)

- [ ] **Step 10: Servir AVIF además de WebP**

En `next.config.ts`, dentro del objeto `images`, justo encima de `minimumCacheTTL`:

```ts
    // AVIF pesa ~20 % menos que WebP en fotografía y el navegador de Instagram
    // en iOS 16+ y Android lo soporta. Next cae a WebP solo donde haga falta.
    formats: ['image/avif', 'image/webp'],
```

- [ ] **Step 11: Ejecutar y comprobar que pasa**

Run: `npx vitest run __tests__/components/landing-hero.test.tsx`
Expected: PASS, 6 tests (3 originales + 3 nuevos).

- [ ] **Step 12: Comprobarlo en el navegador de verdad**

```bash
npm run build && npm start
```

Abrir `http://localhost:3000/curso-bachatango` con las DevTools en emulación móvil. Comprobar:
- En el `<head>` hay un `<link rel="preload" as="image" imagesrcset="/_next/image?url=…">`.
- La portada se ve igual que antes: misma posición, mismo oscurecido, titular legible.
- El titular y el CTA quedan por encima de la imagen, no detrás.

- [ ] **Step 13: Suite completa y tipos**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS, 1044 tests (1035 + 6 del guardián + 3 del hero); sin errores de tipos ni de lint.

- [ ] **Step 14: Commit**

```bash
git add app/curso-bachatango/_components/LandingHero.tsx \
        app/curso-bachatango/page.module.css \
        next.config.ts \
        __tests__/components/landing-hero.test.tsx
git commit -m "perf(landing): portada del hero por next/image con preload

Era el elemento LCP y se descubría solo tras parsear el CSS: 3,55 s de
espera mas 1,15 s bajando un PNG de 383 KB. Ahora sale preload en el head,
en AVIF/WebP y redimensionada."
```

---

## Tarea 4: `cacheControl` al subir portadas

Supabase devuelve `cache-control: no-cache` en la portada actual, así que ni el navegador ni ningún CDN intermedio la guardan. La Tarea 3 ya tapa el agujero para el visitante (la imagen pasa por `/_next/image`, que Vercel cachea 24 h), pero el origen sigue mal y cualquier consumo directo del objeto vuelve a pagarlo.

**Files:**
- Modify: `app/courses/actions.ts:128-130`
- Test: `__tests__/actions/courses.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: nada.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `__tests__/actions/courses.test.ts`. Reutiliza los mocks hoisted que ya tiene el fichero (`mockCreateClient`, `mockRequireAdmin`) y replica el `storage` del `beforeEach` de `describe('createCourse')` (líneas 915-923), pero quedándose con una referencia al espía de `upload`, que hoy es anónimo:

```ts
// ── cacheControl de las portadas ──────────────────────────────────────────────

describe('uploadCourseImage (vía createCourse)', () => {
  let uploadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
    uploadMock = vi.fn().mockResolvedValue({ error: null })

    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: uploadMock,
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage/img.jpg' } }),
        }),
      },
    })
  })

  it('sube la portada con cacheControl de un año', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    // `fd()` solo mete cadenas, así que el File va a mano.
    const archivo = new File([new Uint8Array([1, 2, 3])], 'portada.png', { type: 'image/png' })
    const formData = new FormData()
    formData.append('title', 'Curso')
    formData.append('description', 'd')
    formData.append('courseType', 'membership')
    formData.append('image', archivo)

    await createCourse(formData)

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^course-covers\//),
      archivo,
      expect.objectContaining({ cacheControl: '31536000' }),
    )
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run __tests__/actions/courses.test.ts`
Expected: FAIL — `upload` se llamó con 2 argumentos, sin el tercero.

- [ ] **Step 3: Implementar**

En `app/courses/actions.ts`, en `uploadCourseImage`:

```ts
  const { error: uploadError } = await supabase.storage
    .from('thumbnails')
    .upload(filePath, imageFile, {
      // El nombre lleva un UUID, así que el objeto es inmutable: nunca se
      // sobrescribe, se sube uno nuevo. Sin esto Supabase servía la portada
      // con `cache-control: no-cache` y se volvía a descargar en cada visita.
      cacheControl: '31536000',
    })
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run __tests__/actions/courses.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite completa**

Run: `npm test`
Expected: PASS, 1045 tests.

- [ ] **Step 6: Commit**

```bash
git add app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "perf(portadas): subirlas con cacheControl de un ano"
```

- [ ] **Step 7: Nota para el usuario, no para el código**

La portada **ya subida** conserva su `no-cache`: el header se fija al subir. Para arreglarla, volver a subir la misma imagen desde el formulario de edición del curso una vez desplegado esto. No es urgente —la Tarea 3 la sirve por `/_next/image`— pero conviene dejarlo anotado.

---

## Tarea 5: Banner de cookies más corto

La palanca que más visitas recupera para Meta, y la de superficie más delicada. **Solo se tocan la longitud del texto y la compacidad del panel.** La prominencia relativa de *Aceptar todo* y *Rechazar* no se toca: igualarlas es requisito AEPD, y esconder el rechazo invalidaría el consentimiento, con lo que la medición dejaría de ser legal además de incompleta.

**Files:**
- Modify: `utils/i18n/dictionaries/es.ts:30` (y el mismo campo `consent.body` en `en.ts`, `fr.ts`, `de.ts`, `it.ts`, `ja.ts`)
- Modify: `components/CookieConsent.module.css:11-18` (bloque `.panel`)
- Test: `__tests__/components/cookie-consent.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al `describe('CookieConsent', …)` de `__tests__/components/cookie-consent.test.tsx`:

```tsx
  it('el texto del banner cabe en una pantalla de móvil', async () => {
    renderBanner()
    const dialogo = await screen.findByRole('dialog', { name: /tu privacidad/i })
    const cuerpo = dialogo.querySelector('p')
    // 180 caracteres son ~3 líneas a 390 px. Por encima, los botones caen por
    // debajo del pliegue en el navegador de Instagram y la decisión se aplaza
    // —y sin decisión el píxel no carga y Meta no cuenta la visita.
    expect(cuerpo?.textContent?.length ?? 0).toBeLessThanOrEqual(180)
  })

  it('aceptar y rechazar siguen siendo dos botones igual de alcanzables', async () => {
    renderBanner()
    const aceptar = await screen.findByRole('button', { name: /aceptar todo/i })
    const rechazar = screen.getByRole('button', { name: /^rechazar$/i })
    expect(aceptar).toBeEnabled()
    expect(rechazar).toBeEnabled()
    expect(rechazar).not.toHaveAttribute('aria-hidden')
  })
```

Y, en un fichero aparte, la guardia de verdad sobre la prominencia. `.primary` y `.secondary` son clases distintas, así que comparar `className` no diría nada: lo que garantiza la paridad es el bloque compartido de `CookieConsent.module.css:97-111`, que da a las tres el mismo tamaño de letra, el mismo padding y el mismo `min-width`. Eso es lo que hay que fijar. Crear `__tests__/config/consent-button-parity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Requisito AEPD: denegar no puede costar más que aceptar. Hoy lo garantiza un
 * único bloque compartido por `.primary`, `.secondary` y `.tertiary`; lo que
 * las separa es solo el color.
 *
 * Es un test sobre el CSS porque jsdom no calcula los estilos de un CSS
 * Module. Lo que hay que impedir es que alguien saque `.secondary` del bloque
 * compartido o le dé reglas propias que la encojan.
 */
const CSS = readFileSync(
  join(process.cwd(), 'components/CookieConsent.module.css'),
  'utf8',
)

describe('paridad visual entre aceptar y rechazar', () => {
  it('las tres acciones comparten el bloque de tamaño', () => {
    expect(CSS).toMatch(/\.primary,\s*\n\.secondary,\s*\n\.tertiary\s*\{/)
  })

  it('.secondary no se encoge por su cuenta', () => {
    const bloque = CSS.match(/\n\.secondary\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(bloque).not.toMatch(/font-size|padding|min-width|display\s*:\s*none|opacity|order/)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run __tests__/components/cookie-consent.test.tsx __tests__/config/consent-button-parity.test.ts`
Expected: FAIL **solo** en «el texto del banner cabe en una pantalla de móvil» — el cuerpo actual tiene 231 caracteres. Los otros tres pasan desde el principio: son guardias de regresión, y eso es lo correcto. Si alguno de ellos fallara, **no relajarlo**: significa que la paridad ya está rota y hay que arreglar el CSS antes de seguir.

- [ ] **Step 3: Acortar el copy en español**

En `utils/i18n/dictionaries/es.ts`, sustituir el valor de `consent.body`:

```ts
    body: "Usamos cookies necesarias para que la web funcione. Con tu permiso, también de análisis y marketing para medir campañas y mostrarte Instagram.",
```

(148 caracteres.)

- [ ] **Step 4: Acortar el mismo campo en los otros cinco idiomas**

Mismo recorte en `en.ts`, `fr.ts`, `de.ts`, `it.ts` y `ja.ts`: dejar «cookies necesarias para que funcione» + «con tu permiso, análisis y marketing para medir campañas y mostrar Instagram», por debajo de 180 caracteres en cada idioma. Comprobar el conteo de los seis de una vez:

```bash
for f in es en fr de it ja; do
  awk '/consent: \{/,/\}/' "utils/i18n/dictionaries/$f.ts" \
    | grep -m1 'body:' \
    | sed 's/.*body: *"//; s/",*$//' \
    | awk -v idioma="$f" '{ print idioma, length($0) }'
done
```

Esperado: los seis por debajo de 180. El test del paso 1 solo cubre el español (es el idioma que renderiza `LanguageProvider initialLocale="es"`), así que este conteo es la única red para los otros cinco.

- [ ] **Step 5: Compactar el panel**

En `components/CookieConsent.module.css`, en el bloque `.panel`:

```css
.panel {
  pointer-events: auto;
  width: min(46rem, 100%);
  /* 80vh dejaba los botones por debajo del pliegue en un movil de 844 px de
     alto dentro del navegador de Instagram: la decision se aplazaba y el
     pixel no llegaba a cargar nunca. */
  max-height: min(70vh, 32rem);
  overflow-y: auto;
  background: #0b0b0b;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: clamp(1rem, 3vw, 1.75rem);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.9);
}
```

- [ ] **Step 6: Ejecutar y comprobar que pasa**

Run: `npx vitest run __tests__/components/cookie-consent.test.tsx`
Expected: PASS, todos.

- [ ] **Step 7: Comprobarlo en móvil de verdad**

Con `npm run build && npm start`, abrir `/curso-bachatango` en DevTools con viewport **390×844** y cookies borradas. Comprobar que *Aceptar todo*, *Rechazar* y *Configurar* se ven **los tres sin hacer scroll** dentro del panel, y que los dos primeros se ven igual de llamativos.

- [ ] **Step 8: Suite completa**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, 1049 tests (1045 + 2 de componente + 2 de paridad).

- [ ] **Step 9: Commit**

```bash
git add utils/i18n/dictionaries/ components/CookieConsent.module.css \
        __tests__/components/cookie-consent.test.tsx \
        __tests__/config/consent-button-parity.test.ts
git commit -m "fix(consentimiento): banner mas corto, decision sin scroll en movil

Sin pulsar una opcion el pixel no carga y Meta no cuenta la visita. Se
acorta el texto y se compacta el panel; la equivalencia visual entre
aceptar y rechazar no se toca (requisito AEPD)."
```

---

## Tarea 6: Cachear las tres lecturas de la landing

Cada clic de anuncio paga tres consultas a Supabase: curso, temario y clase gratis. Las tres devuelven datos públicos idénticos para todo el mundo. Esto no convierte la página en estática —el layout raíz sigue leyendo cookies— pero le quita el trabajo de base de datos al camino crítico.

`getLandingCourse` usa hoy el cliente con sesión, que lee cookies y por tanto no puede vivir dentro de `unstable_cache`. Pasa al service role igual que ya hacen sus dos hermanas (`curriculum.ts:62-68`, `free-lesson.ts:27-33`) y por el mismo motivo documentado allí: la página es pública, no hay cookies que respetar y así el resultado no depende de la RLS de `courses`. Solo expone id, título, portada y precio de un curso **publicado**, que es información que ya está en el HTML público.

**Files:**
- Modify: `utils/courses/landing-course.ts:1-36`
- Modify: `utils/courses/curriculum.ts:61-68`
- Modify: `utils/courses/free-lesson.ts:26-33`
- Modify: `app/courses/actions.ts:262-263` (`updateCourse`)
- Test: `__tests__/utils/landing-course.test.ts`, `__tests__/utils/curriculum.test.ts`, `__tests__/utils/free-lesson.test.ts`, `__tests__/actions/courses.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: la etiqueta de caché `'landing-course'`, que `updateCourse` invalida. Ninguna tarea posterior la usa.

- [ ] **Step 1: Escribir el test que falla de la etiqueta**

Crear `__tests__/utils/landing-cache-tags.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El precio de la landing pasa a estar cacheado. Si editar el curso no
 * invalidara esa caché, la landing podria anunciar 119 EUR durante cinco
 * minutos mientras el checkout cobra 129: el precio de Stripe sale de una
 * lectura fresca en comprar/actions.ts:85, no de aqui.
 *
 * Este test fija el contrato entre quien cachea y quien invalida.
 */
function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), 'utf8')
}

describe('etiqueta de caché de la landing', () => {
  it('landing-course.ts etiqueta su caché', () => {
    expect(leer('utils/courses/landing-course.ts')).toContain("'landing-course'")
  })

  it('updateCourse invalida esa etiqueta', () => {
    expect(leer('app/courses/actions.ts')).toContain("revalidateTag('landing-course'")
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run __tests__/utils/landing-cache-tags.test.ts`
Expected: FAIL en los dos.

- [ ] **Step 3: Cachear `getLandingCourse`**

Reemplazar el cuerpo de `utils/courses/landing-course.ts` desde el `import` inicial:

```ts
import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { selectWithOfferColumns } from '@/utils/courses/offer';
```

y la función:

```ts
/**
 * Lee el curso fijo de la landing (publicado). Devuelve null si no existe
 * o no está publicado. Lo consumen el Server Component de `/` y el de
 * `/curso-bachatango`, que es la única fuente de verdad del precio.
 *
 * Service role en vez del cliente con sesión, por los dos motivos que ya
 * documentan `curriculum.ts` y `free-lesson.ts`: la página es pública y no hay
 * cookies que respetar, y así el curso no depende de la RLS de `courses`.
 * Además es lo que permite cachearlo — `unstable_cache` no puede llamar a
 * `cookies()` por dentro.
 *
 * Solo salen id, título, portada y precio de un curso ya publicado: lo mismo
 * que cualquiera lee en el HTML de la landing.
 *
 * La caché dura 5 minutos Y se invalida en el acto al editar el curso
 * (`revalidateTag('landing-course')` en app/courses/actions.ts). Lo segundo no
 * es un extra: sin ello la landing podría anunciar un precio viejo mientras el
 * checkout cobra el nuevo.
 */
async function leerCursoDeLaLanding(): Promise<LandingCourse | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  const { data, error } = await selectWithOfferColumns<LandingCourse>((offerColumns) =>
    supabase
      .from('courses')
      .select(`id, title, image_url, ${offerColumns}`)
      .eq('id', COURSE_ID)
      .eq('is_published', true)
      .single(),
  );

  if (error || !data) return null;
  return data as LandingCourse;
}

const leerCacheado = unstable_cache(leerCursoDeLaLanding, ['landing-course'], {
  revalidate: 300,
  tags: ['landing-course'],
});

export async function getLandingCourse(): Promise<LandingCourse | null> {
  const curso = await leerCacheado();
  // Un fallo de base de datos NO se queda cacheado cinco minutos: si la
  // lectura cacheada vino vacía se reintenta en directo. Lo normal es que el
  // curso exista, así que esto solo corre en el caso malo.
  return curso ?? leerCursoDeLaLanding();
}
```

- [ ] **Step 4: Invalidar al editar el curso**

En `app/courses/actions.ts`, en `updateCourse`, junto a los `revalidatePath` de las líneas 262-263:

```ts
  // La landing y la home leen el curso desde una caché de 5 minutos. Sin esto,
  // un cambio de precio tardaría hasta 5 minutos en verse mientras el checkout
  // ya cobraría el nuevo.
  revalidateTag('landing-course', 'max')
```

- [ ] **Step 5: Actualizar el test de `getLandingCourse`**

El mock de `__tests__/utils/landing-course.test.ts` apunta a `@/utils/supabase/server`, que ya no se usa. Sustituir el bloque `vi.mock` de las líneas 3-14 por uno de `@supabase/supabase-js`, y fijar la service key:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const single = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ single }),
        }),
      }),
    }),
  })),
}))

vi.mock('next/cache', () => ({
  // La caché se prueba por su contrato (la etiqueta) en
  // landing-cache-tags.test.ts; aquí interesa la consulta, así que
  // `unstable_cache` es la identidad.
  unstable_cache: (fn: unknown) => fn,
}))

process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-de-test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
```

Los cuatro `it` existentes se quedan tal cual. Añadir uno:

```ts
  it('devuelve null sin SUPABASE_SERVICE_ROLE_KEY', async () => {
    const original = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(await getLandingCourse()).toBeNull()
    process.env.SUPABASE_SERVICE_ROLE_KEY = original
  })
```

- [ ] **Step 6: Ejecutar y comprobar que pasan**

Run: `npx vitest run __tests__/utils/landing-course.test.ts __tests__/utils/landing-cache-tags.test.ts`
Expected: PASS, 5 + 2 tests.

- [ ] **Step 7: Cachear `getCurriculum`**

Tres ediciones puntuales en `utils/courses/curriculum.ts`; **el cuerpo de la función no se toca**, solo su firma y lo que la envuelve.

1. Añadir el import, bajo el `import 'server-only'` de la línea 1:

```ts
import { unstable_cache } from 'next/cache'
```

2. En la línea 61, cambiar la firma de pública a interna. Es un renombrado de una línea; el docstring de las líneas 48-60 se queda donde está:

```ts
async function leerTemario(): Promise<Curriculum | null> {
```

3. Al final del fichero, después del `}` que cierra esa función, añadir el envoltorio:

```ts
const temarioCacheado = unstable_cache(leerTemario, ['landing-curriculum'], {
  revalidate: 300,
  tags: ['landing-curriculum'],
})

/**
 * El temario solo cambia cuando un admin edita lecciones, y la landing lo pide
 * en cada clic de anuncio. Se cachea 5 minutos.
 *
 * El `?? leerTemario()` no es un cinturón de más: sin él, un hipo de red de
 * Supabase dejaría la landing sin temario durante los 5 minutos completos.
 */
export async function getCurriculum(): Promise<Curriculum | null> {
  return (await temarioCacheado()) ?? leerTemario()
}
```

4. En `app/courses/actions.ts`, donde ya se hace ``revalidateTag(`course:${courseId}:lessons`, 'max')`` (líneas 53 y 109), añadir justo debajo, en **las dos**:

```ts
  revalidateTag('landing-curriculum', 'max')
```

- [ ] **Step 8: Cachear `getFreeLesson`**

Mismo patrón de cuatro ediciones en `utils/courses/free-lesson.ts`, con la etiqueta `'landing-free-lesson'`:

1. `import { unstable_cache } from 'next/cache'` bajo el `import 'server-only'`.
2. Línea 26: `async function leerClaseGratis(): Promise<FreeLesson | null> {`.
3. Al final del fichero:

```ts
const claseGratisCacheada = unstable_cache(leerClaseGratis, ['landing-free-lesson'], {
  revalidate: 300,
  tags: ['landing-free-lesson'],
})

/** Ver `getCurriculum`: mismo motivo para cachear y mismo reintento en directo. */
export async function getFreeLesson(): Promise<FreeLesson | null> {
  return (await claseGratisCacheada()) ?? leerClaseGratis()
}
```

4. `revalidateTag('landing-free-lesson', 'max')` junto a las dos líneas del paso anterior en `app/courses/actions.ts`.

> El `mux_playback_id` sí se cachea; los **tokens** no. Se siguen firmando en cada render en `app/curso-bachatango/page.tsx:64-67`, que es lo que exige el comentario de `utils/mux/public-token.ts:6-21`. No mover esa firma dentro de la caché bajo ningún concepto: dejaría tokens caducados embebidos en el HTML.

- [ ] **Step 9: Ejecutar los tests de las tres lecturas**

Run: `npx vitest run __tests__/utils/curriculum.test.ts __tests__/utils/free-lesson.test.ts`
Expected: PASS. Si fallan por el `unstable_cache` real, añadir a cada fichero el mismo `vi.mock('next/cache', …)` identidad del paso 5.

- [ ] **Step 10: Test de que el fallo no se cachea**

Añadir dentro del `describe('getCurriculum', …)` de `__tests__/utils/curriculum.test.ts`, que ya tiene el espía `orderMock` y las filas de ejemplo `ROWS`:

```ts
  it('reintenta en directo si la lectura cacheada vino vacía', async () => {
    // Primera llamada: la BD falla. Segunda: responde. La landing no puede
    // quedarse cinco minutos sin temario por un hipo de red.
    orderMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    orderMock.mockResolvedValueOnce({ data: ROWS, error: null })
    const temario = await getCurriculum()
    expect(temario).not.toBeNull()
    expect(temario?.moduleCount).toBe(2)
  })
```

Y el equivalente en `__tests__/utils/free-lesson.test.ts`, cuyo espía es `limitMock` y cuya fila de ejemplo es `ROW`:

```ts
  it('reintenta en directo si la lectura cacheada vino vacía', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    limitMock.mockResolvedValueOnce({ data: [ROW], error: null })
    expect(await getFreeLesson()).not.toBeNull()
  })
```

- [ ] **Step 11: Suite completa y build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS, 1054 tests (1049 + 2 de etiquetas + 1 de service key + 2 de reintento). El build es obligatorio aquí: `unstable_cache` falla en build si se llama desde un contexto que lee cookies.

- [ ] **Step 12: Commit**

```bash
git add utils/courses/landing-course.ts utils/courses/curriculum.ts utils/courses/free-lesson.ts \
        app/courses/actions.ts \
        __tests__/utils/landing-course.test.ts __tests__/utils/curriculum.test.ts \
        __tests__/utils/free-lesson.test.ts __tests__/utils/landing-cache-tags.test.ts \
        __tests__/actions/courses.test.ts
git commit -m "perf(landing): cachear curso, temario y clase gratis 5 minutos

Cada clic de anuncio pagaba tres consultas a Supabase para datos publicos
identicos. Se invalidan al editar el curso para que el precio anunciado no
se separe del que cobra Stripe."
```

---

## Tarea 7: Sentry sin Replay en el navegador

`replaysOnErrorSampleRate: 0.1` arrastra el bundle de Session Replay a todas las páginas, incluida la landing de pago. Se conserva el reporte de errores y el tracing, que es lo que de verdad se usa.

**Files:**
- Modify: `instrumentation-client.ts:12-13`
- Test: `__tests__/config/sentry-client-budget.test.ts` (crear)

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/config/sentry-client-budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Session Replay arrastra su propio bundle a TODAS las paginas, la landing de
 * pago incluida, y nunca se ha usado para diagnosticar nada. Los errores y el
 * tracing se conservan.
 *
 * Es un test sobre el fuente, no sobre el comportamiento, porque lo que se
 * quiere fijar es una decision de presupuesto de bytes: si alguien reactiva
 * Replay, que sea a sabiendas y cambiando este test.
 */
describe('Sentry en navegador', () => {
  const fuente = readFileSync(join(process.cwd(), 'instrumentation-client.ts'), 'utf8')

  it('no graba sesiones', () => {
    expect(fuente).toMatch(/replaysSessionSampleRate:\s*0\b/)
  })

  it('no graba sesiones al fallar', () => {
    expect(fuente).toMatch(/replaysOnErrorSampleRate:\s*0\b/)
  })

  it('sigue reportando errores en produccion', () => {
    expect(fuente).toContain("enabled: process.env.NODE_ENV === 'production'")
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run __tests__/config/sentry-client-budget.test.ts`
Expected: FAIL en «no graba sesiones al fallar» (vale `0.1`).

- [ ] **Step 3: Implementar**

En `instrumentation-client.ts`, sustituir las dos líneas de replay:

```ts
  // Session Replay apagado a propósito: arrastraba su bundle a todas las
  // páginas, la landing de pago incluida, y nunca se usó para diagnosticar
  // nada. Los errores y el tracing siguen llegando.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run __tests__/config/sentry-client-budget.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Medir el ahorro real**

```bash
npm run build 2>&1 | tail -40
```

Anotar el *First Load JS* de `/curso-bachatango` antes y después. Si no bajara nada, Replay ya estaba fuera del bundle por tree-shaking: dejar el cambio igualmente (la configuración queda honesta) y anotarlo en el commit.

- [ ] **Step 6: Suite completa**

Run: `npm test`
Expected: PASS, 1057 tests (1054 tras la Tarea 6 + 3).

- [ ] **Step 7: Commit**

```bash
git add instrumentation-client.ts __tests__/config/sentry-client-budget.test.ts
git commit -m "perf(sentry): apagar Session Replay en navegador"
```

---

## Tarea 8: Medir, documentar y verificar en Meta

No añade código de producto: cierra el ciclo con la evidencia. **Requiere que el usuario haya autorizado el despliegue.**

**Files:**
- Create: `docs/lighthouse-2026-10-results.md`

**Interfaces:**
- Consumes: todas las tareas anteriores, ya desplegadas.
- Produces: nada.

- [ ] **Step 1: Línea base, ya tomada** (2026-10-13, producción, antes de todo esto)

| Métrica | Valor |
|---|---|
| Performance | 76 |
| FCP | 1,0 s |
| **LCP** | **6,8 s** |
| TBT | 80 ms |
| CLS | 0 |
| Speed Index | 2,4 s |
| JS comprimido | 454 KB |
| Iconos | 136 KB |
| TTFB (Madrid, fibra) | 0,56-1,30 s |
| Región de función | `iad1` |

- [ ] **Step 2: Pedir el OK de despliegue**

No desplegar sin confirmación explícita. Con ella: merge de la rama y despliegue a producción.

- [ ] **Step 3: Volver a medir, mismo comando que la línea base**

```bash
npx --yes lighthouse@12 "https://luisysarabachatango.com/curso-bachatango?utm_source=meta&utm_medium=paid&utm_campaign=bachatango&utm_content=carrusel" \
  --form-factor=mobile --throttling-method=simulate \
  --only-categories=performance --output=json --output-path=/tmp/lh-despues.json --quiet \
  --chrome-flags="--headless=new --no-sandbox"
```

Objetivo: **LCP < 2,5 s** y **Performance > 90**. TBT y CLS ya estaban bien y no deben empeorar.

- [ ] **Step 4: Comprobar región, iconos y cabeceras**

```bash
curl -sSI https://luisysarabachatango.com/curso-bachatango | grep -i 'x-vercel-id'
curl -sSI https://luisysarabachatango.com/favicon.ico | grep -iE 'content-length|cache-control'
curl -sSI https://luisysarabachatango.com/icon.png   | grep -iE 'content-length|cache-control'
```

Esperado: segundo segmento europeo en `x-vercel-id`; los dos iconos por debajo de 15 KB con `max-age=31536000, immutable`.

- [ ] **Step 5: Probar eventos en el Administrador de eventos de Meta**

Con `META_TEST_EVENT_CODE` puesto en Vercel y el código pegado en *Administrador de eventos → Probar eventos*, **en este orden**:

1. Abrir `/curso-bachatango` con los parámetros del anuncio y **aceptar marketing** en el banner. Debe aparecer `PageView`.
2. Pulsar comprar, rellenar el formulario y pulsar *Continuar al pago*. Debe aparecer `InitiateCheckout` con `value: 119` y `currency: EUR`.
3. Pagar con la tarjeta de prueba de Stripe. En `/gracias` debe aparecer `Purchase` **(Navegador)** con `value: 119` y su `eventID`.
4. Segundos después debe aparecer `Purchase` **(Servidor)** con el **mismo** `event_id`, y Meta debe marcar la pareja como **deduplicada**. Si cuenta dos ventas, los `event_id` no coinciden: ahí es donde hay que mirar.
5. Recargar `/gracias`: **no** debe salir un segundo `Purchase` (lo frena el guard de `localStorage` en `app/gracias/PurchaseTracking.tsx:22-38`).

- [ ] **Step 6: Vaciar `META_TEST_EVENT_CODE` en Vercel**

Es lo que separa los eventos de prueba de los reales. Dejarlo puesto ensucia el píxel de producción.

- [ ] **Step 7: Escribir el documento de resultados**

Crear `docs/lighthouse-2026-10-results.md` siguiendo el formato de `docs/lighthouse-2026-08-results.md`: tabla antes/después, una sección «Qué explica los cambios» con una línea por tarea, y una nota sobre el reparto real entre medición (D1) y velocidad (D2) según el número de `/admin/landing` del prerrequisito P1.

- [ ] **Step 8: Commit**

```bash
git add docs/lighthouse-2026-10-results.md
git commit -m "docs: resultados de Lighthouse tras la remediacion de octubre"
```

---

## Lo que este plan deja sin hacer, a propósito

- **Landing estática.** La ganancia estructural mayor: `cache-control: private, no-cache, no-store` y `x-vercel-cache: MISS` en toda petición, incluida `/`, que declara `revalidate = 300` y lo pierde porque el layout raíz lee cookies (`app/layout.tsx:97-99`). Arreglarlo de verdad es migrar a Cache Components/PPR de Next 16, que toca el layout de todo el sitio. Aquí se recorta el coste por petición (Tarea 6) sin tocar el modelo de renderizado. Recupera además el bfcache, que hoy está desactivado y encarece el «volver atrás» desde Stripe.
- **Header y Footer en la landing.** `Header` devuelve `null` en las rutas del embudo (`components/Header.tsx:93`) **después** de que el layout haya resuelto usuario, perfil y diccionario. Para tráfico anónimo el coste real es casi cero (sin cookie `sb-`, `getUser()` no sale a la red), así que no compensa tocarlo fuera de la migración anterior.
- **Las URL de los anuncios.** D7 se corrige en la cuenta de Meta, no en el repositorio (prerrequisito P3).
- **Recuperar los LPV de quien rechaza marketing.** No tiene solución legítima bajo RGPD. La salida es optimizar la campaña hacia `Purchase` —que ya se reporta por CAPI— y vigilar el embudo propio de `/admin/landing`, que lo ve todo.
