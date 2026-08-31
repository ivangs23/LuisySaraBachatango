# Landing Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la home `/` en un puente medible y legal hacia el funnel de venta `/curso-bachatango`, entregando de verdad la clase gratis y el email de bienvenida que el copy ya promete.

**Architecture:** La home mantiene su tono editorial pero pasa a ser un Server Component que lee el curso de la landing (precio real desde la BD) y añade un bloque de oferta que enlaza al funnel. Un `ConsentContext` de cliente controla qué scripts de terceros se cargan (GA4, Meta Pixel, Instagram embed); Vercel Analytics y Speed Insights van siempre porque no usan cookies. Una nueva ruta pública `/clase-gratis` sirve una lección `is_free` con un JWT de Mux anónimo y de vida corta, sin exigir login.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS Modules, Supabase (PostgreSQL + RLS), Mux, Resend, Vitest + Testing Library.

## Global Constraints

- **Sin Tailwind, sin Shadcn.** Todo el estilo va en CSS Modules junto al componente.
- **Diccionarios: paridad obligatoria.** `Dictionary = typeof es` (`utils/i18n/types.ts`). Toda clave nueva debe añadirse a los 6 ficheros de `utils/i18n/dictionaries/` (`es`, `en`, `fr`, `de`, `it`, `ja`) o `tsc --noEmit` falla. `es.ts` es el canónico y no lleva anotación de tipo; los otros 5 declaran `: Dictionary`.
- **Verificación i18n:** `npm run i18n:check` debe pasar tras cualquier cambio de diccionario.
- **Tests:** Vitest en entorno `node` por defecto. Los tests de componente necesitan el docblock `// @vitest-environment jsdom` en la primera línea. Los tests viven en `__tests__/` replicando la estructura de origen.
- **CI (`.github/workflows/ci.yml`):** lint + `tsc --noEmit` + vitest + build. Antes de cada commit: `npm run lint && npx tsc --noEmit && npm test`.
- **Dependencias nuevas permitidas, solo estas dos:** `@vercel/analytics`, `@vercel/speed-insights`. Nada más.
- **Commit al final de cada tarea.** Mensajes en formato Conventional Commits, en inglés.
- **Rama:** trabajar en `feat/landing-remediation` a partir de `main`.
- **Nunca romper el funnel existente.** `/curso-bachatango`, `/curso-bachatango/comprar` y `/gracias` son chromeless (`utils/nav/chromeless-routes.ts`) y siguen siéndolo.
- **Precio: una sola fuente de verdad.** Siempre `courses.price_eur` desde la BD. Nunca hardcodear un importe en copy ni en JSX.

---

## Fases

| Fase | Tareas | Entregable |
|---|---|---|
| 1. Conectar el funnel | 1–4 | La home enlaza y muestra la oferta con precio real |
| 2. Consentimiento + analítica | 5–8 | Banner de cookies, GA4/Pixel gateados, Vercel Analytics |
| 3. Clase gratis pública | 9–11 | `/clase-gratis` reproducible sin login |
| 4. Email de bienvenida + baja | 12–14 | Newsletter cumple lo que promete y es legal |
| 5. SEO + copy | 15–17 | OG image correcta, FAQPage, cifras coherentes |
| 6. Limpieza + LCP | 18–20 | Código muerto fuera, hero optimizado |

---

## Estructura de ficheros

**Fase 1**
- Crear: `utils/courses/landing-course.ts` — `COURSE_ID` + `getLandingCourse()`, compartido entre home y funnel
- Crear: `components/HomeOffer.tsx` + `components/HomeOffer.module.css` — bloque de oferta de la home
- Modificar: `app/curso-bachatango/copy.ts` (quitar `COURSE_ID`), `app/curso-bachatango/get-landing-course.ts` (borrar), `app/curso-bachatango/_components/LandingSections.tsx`, `app/curso-bachatango/page.tsx`
- Modificar: `app/page.tsx`, `components/Hero.tsx`, `components/Header.tsx`, `components/FooterClient.tsx`
- Modificar: los 6 diccionarios (`home.*`, `header.buyCourse`, `footer.buyCourse`)

**Fase 2**
- Crear: `utils/consent/categories.ts`, `context/ConsentContext.tsx`, `components/CookieConsent.tsx` + `.module.css`, `components/ThirdPartyScripts.tsx`
- Modificar: `app/layout.tsx`, `components/InstagramGallery.tsx`, `next.config.ts`, los 6 diccionarios (`consent.*`)

**Fase 3**
- Crear: `utils/mux/public-token.ts`, `utils/courses/free-lesson.ts`, `app/clase-gratis/page.tsx` + `page.module.css`, `components/FreeClassPlayer.tsx`
- Modificar: `components/Hero.tsx`, `app/curso-bachatango/_components/LandingSections.tsx`, `app/sitemap.ts`, los 6 diccionarios (`freeClass.*`)

**Fase 4**
- Crear: `utils/newsletter/unsubscribe-token.ts`, `utils/email/newsletter-welcome.ts`, `app/unsubscribe/page.tsx` + `actions.ts` + `page.module.css`, `supabase/2026_08_newsletter_consent.sql`
- Modificar: `app/actions/newsletter.ts`, los 6 diccionarios (`newsletter.*`)

**Fase 5**
- Crear: `app/opengraph-image.tsx`, `app/curso-bachatango/opengraph-image.tsx`, `utils/seo/faq-jsonld.ts`
- Modificar: `app/layout.tsx`, `app/page.tsx`, `app/curso-bachatango/page.tsx`, `components/Hero.tsx`, los 6 diccionarios (FAQ q1)

**Fase 6**
- Modificar: `components/Hero.tsx`, `components/Hero.module.css`, `app/page.module.css`, `app/manifest.ts`
- Borrar: `public/hero-bg.png`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`, `public/file.svg`, `public/globe.svg`

---

## FASE 1 — Conectar el funnel

### Task 1: Extraer `COURSE_ID` y `getLandingCourse` a `utils/courses/`

Hoy `COURSE_ID` vive en `app/curso-bachatango/copy.ts` y `getLandingCourse()` en `app/curso-bachatango/get-landing-course.ts`. La home los necesita, y una home que importa de la carpeta de otra ruta es frágil. Los movemos a `utils/`.

**Files:**
- Create: `utils/courses/landing-course.ts`
- Delete: `app/curso-bachatango/get-landing-course.ts`
- Modify: `app/curso-bachatango/copy.ts` (línea 1: quitar `export const COURSE_ID`)
- Modify: `app/curso-bachatango/page.tsx:3` (import)
- Modify: `app/curso-bachatango/_components/LandingSections.tsx:2` (import)
- Test: `__tests__/utils/landing-course.test.ts`

**Interfaces:**
- Produces:
  - `export const COURSE_ID: string`
  - `export interface LandingCourse { id: string; title: string; price_eur: number; image_url: string | null }`
  - `export async function getLandingCourse(): Promise<LandingCourse | null>`

- [ ] **Step 1: Localizar todos los importadores actuales**

```bash
grep -rn "COURSE_ID\|get-landing-course" app/ components/ __tests__/ --include="*.ts" --include="*.tsx"
```

Anota cada fichero. Todos deben quedar apuntando al módulo nuevo al final de esta tarea.

- [ ] **Step 2: Escribir el test que falla**

Crear `__tests__/utils/landing-course.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const singleMock = vi.fn()
const eqMock = vi.fn(() => ({ eq: eqMock, single: singleMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ from: fromMock }),
}))

import { getLandingCourse, COURSE_ID } from '@/utils/courses/landing-course'

describe('getLandingCourse', () => {
  beforeEach(() => {
    singleMock.mockReset()
    fromMock.mockClear()
  })

  it('expone un COURSE_ID con forma de uuid', () => {
    expect(COURSE_ID).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('devuelve el curso cuando existe y está publicado', async () => {
    singleMock.mockResolvedValue({
      data: { id: 'c1', title: 'Curso', price_eur: 97, image_url: null },
      error: null,
    })
    const r = await getLandingCourse()
    expect(r).toEqual({ id: 'c1', title: 'Curso', price_eur: 97, image_url: null })
    expect(fromMock).toHaveBeenCalledWith('courses')
  })

  it('devuelve null cuando la query falla', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'no rows' } })
    expect(await getLandingCourse()).toBeNull()
  })

  it('devuelve null cuando no hay datos', async () => {
    singleMock.mockResolvedValue({ data: null, error: null })
    expect(await getLandingCourse()).toBeNull()
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/utils/landing-course.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/courses/landing-course"`

- [ ] **Step 4: Crear el módulo**

Crear `utils/courses/landing-course.ts`. Copiar el uuid real desde `app/curso-bachatango/copy.ts:1` — **no inventarlo**:

```ts
import { createClient } from '@/utils/supabase/server';

/** Curso fijo que vende el funnel `/curso-bachatango` y anuncia la home. */
export const COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92';

export interface LandingCourse {
  id: string;
  title: string;
  price_eur: number;
  image_url: string | null;
}

/**
 * Lee el curso fijo de la landing (publicado). Devuelve null si no existe
 * o no está publicado. Lo consumen el Server Component de `/` y el de
 * `/curso-bachatango`, que es la única fuente de verdad del precio.
 */
export async function getLandingCourse(): Promise<LandingCourse | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, price_eur, image_url')
    .eq('id', COURSE_ID)
    .eq('is_published', true)
    .single();

  if (error || !data) return null;
  return data as LandingCourse;
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/utils/landing-course.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Migrar los importadores y borrar el módulo viejo**

En `app/curso-bachatango/copy.ts`, borrar la línea 1 completa (`export const COURSE_ID = '...';`) y la línea en blanco que la sigue. El fichero debe empezar por `export const LANDING_COPY = {`.

En `app/curso-bachatango/_components/LandingSections.tsx`, cambiar la línea 2:

```tsx
// antes
import { LANDING_COPY, COURSE_ID } from '../copy';
// después
import { LANDING_COPY } from '../copy';
import { COURSE_ID } from '@/utils/courses/landing-course';
```

En `app/curso-bachatango/page.tsx`, cambiar la línea 3:

```tsx
// antes
import { getLandingCourse } from './get-landing-course';
// después
import { getLandingCourse } from '@/utils/courses/landing-course';
```

Borrar el fichero viejo:

```bash
rm app/curso-bachatango/get-landing-course.ts
```

Arreglar cualquier otro importador que saliera en el Step 1.

- [ ] **Step 7: Verificar que no queda ninguna referencia colgando**

```bash
grep -rn "get-landing-course" app/ components/ utils/ __tests__/ ; echo "exit=$?"
```
Expected: sin resultados (`exit=1`)

- [ ] **Step 8: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: lint sin errores nuevos, tsc limpio, toda la suite en verde

- [ ] **Step 9: Commit**

```bash
git add utils/courses/landing-course.ts __tests__/utils/landing-course.test.ts app/curso-bachatango/
git commit -m "refactor(courses): move COURSE_ID and getLandingCourse to utils/courses

The home page needs the landing course price, and importing it from another
route's folder is brittle. Single source of truth for both consumers."
```

---

### Task 2: Claves de diccionario para la oferta de la home

Todo el copy nuevo de la Fase 1 entra en los 6 diccionarios de golpe. Si se añade solo a `es.ts`, `tsc --noEmit` falla en los otros 5 — así que esta tarea es atómica por diseño.

**Files:**
- Modify: `utils/i18n/dictionaries/es.ts` (añadir bloque `home`, y `buyCourse` en `header` y `footer`)
- Modify: `utils/i18n/dictionaries/en.ts`, `fr.ts`, `de.ts`, `it.ts`, `ja.ts` (lo mismo)

**Interfaces:**
- Produces: `t.home.offer.{chapter,label,title,lead,includes,priceNote,cta,micro}`, `t.header.buyCourse`, `t.footer.buyCourse`

- [ ] **Step 1: Añadir el bloque a `es.ts` (canónico)**

En `utils/i18n/dictionaries/es.ts`, dentro de `header:` añadir tras `dancer: "Bailarín"` (ojo con la coma):

```ts
    dancer: "Bailarín",
    buyCourse: "Ver el curso"
```

Dentro de `footer:` añadir tras `blog: "Blog"`:

```ts
    blog: "Blog",
    buyCourse: "El curso"
```

Y un bloque nuevo `home` justo después del bloque `hero` (tras la línea `},` que cierra `hero`):

```ts
  home: {
    offer: {
      chapter: "04",
      label: "LA OFERTA",
      title: "El método completo, en un solo curso",
      lead: "Toda la progresión de Luis y Sara: técnica, conexión y musicalidad, desglosadas paso a paso para que avances sin frustrarte.",
      includes: [
        "Acceso de por vida a todas las lecciones",
        "Progresión guiada de iniciación a avanzado",
        "Práctica en solitario y en pareja",
        "Comunidad privada de bailarines"
      ],
      priceNote: "Pago único · Acceso de por vida",
      cta: "Ver el curso",
      micro: "Pago seguro con Stripe"
    }
  },
```

- [ ] **Step 2: Ejecutar tsc y verificar que falla en los otros 5 locales**

Run: `npx tsc --noEmit`
Expected: FAIL — 5 errores del tipo `Property 'home' is missing in type ... but required in type 'Dictionary'`, uno por cada fichero `en/fr/de/it/ja`

- [ ] **Step 3: Añadir las traducciones a `en.ts`**

`header.buyCourse: "View the course"`, `footer.buyCourse: "The course"`, y tras el bloque `hero`:

```ts
  home: {
    offer: {
      chapter: "04",
      label: "THE OFFER",
      title: "The complete method, in one course",
      lead: "Luis and Sara's full progression: technique, connection and musicality, broken down step by step so you improve without getting stuck.",
      includes: [
        "Lifetime access to every lesson",
        "Guided progression from beginner to advanced",
        "Solo and partner practice",
        "Private community of dancers"
      ],
      priceNote: "One-time payment · Lifetime access",
      cta: "View the course",
      micro: "Secure payment with Stripe"
    }
  },
```

- [ ] **Step 4: Añadir las traducciones a `fr.ts`**

`header.buyCourse: "Voir le cours"`, `footer.buyCourse: "Le cours"`, y:

```ts
  home: {
    offer: {
      chapter: "04",
      label: "L'OFFRE",
      title: "La méthode complète, en un seul cours",
      lead: "Toute la progression de Luis et Sara : technique, connexion et musicalité, décomposées pas à pas pour progresser sans frustration.",
      includes: [
        "Accès à vie à toutes les leçons",
        "Progression guidée du débutant à l'avancé",
        "Pratique en solo et en couple",
        "Communauté privée de danseurs"
      ],
      priceNote: "Paiement unique · Accès à vie",
      cta: "Voir le cours",
      micro: "Paiement sécurisé avec Stripe"
    }
  },
```

- [ ] **Step 5: Añadir las traducciones a `de.ts`**

`header.buyCourse: "Kurs ansehen"`, `footer.buyCourse: "Der Kurs"`, y:

```ts
  home: {
    offer: {
      chapter: "04",
      label: "DAS ANGEBOT",
      title: "Die komplette Methode, in einem Kurs",
      lead: "Der gesamte Aufbau von Luis und Sara: Technik, Verbindung und Musikalität, Schritt für Schritt erklärt, damit du ohne Frust vorankommst.",
      includes: [
        "Lebenslanger Zugang zu allen Lektionen",
        "Geführter Aufbau vom Einstieg bis Fortgeschritten",
        "Übungen allein und zu zweit",
        "Private Community von Tanzenden"
      ],
      priceNote: "Einmalzahlung · Lebenslanger Zugang",
      cta: "Kurs ansehen",
      micro: "Sichere Zahlung mit Stripe"
    }
  },
```

- [ ] **Step 6: Añadir las traducciones a `it.ts`**

`header.buyCourse: "Vedi il corso"`, `footer.buyCourse: "Il corso"`, y:

```ts
  home: {
    offer: {
      chapter: "04",
      label: "L'OFFERTA",
      title: "Il metodo completo, in un solo corso",
      lead: "Tutta la progressione di Luis e Sara: tecnica, connessione e musicalità, spiegate passo dopo passo per migliorare senza frustrazione.",
      includes: [
        "Accesso a vita a tutte le lezioni",
        "Progressione guidata da principiante ad avanzato",
        "Pratica da solo e in coppia",
        "Comunità privata di ballerini"
      ],
      priceNote: "Pagamento unico · Accesso a vita",
      cta: "Vedi il corso",
      micro: "Pagamento sicuro con Stripe"
    }
  },
```

- [ ] **Step 7: Añadir las traducciones a `ja.ts`**

`header.buyCourse: "コースを見る"`, `footer.buyCourse: "コース"`, y:

```ts
  home: {
    offer: {
      chapter: "04",
      label: "オファー",
      title: "完全なメソッドを、ひとつのコースに",
      lead: "ルイスとサラのカリキュラムのすべて。テクニック、コネクション、音楽性を一歩ずつ分解し、つまずかずに上達できます。",
      includes: [
        "全レッスンに永久アクセス",
        "初心者から上級者までの段階的カリキュラム",
        "ソロとペア、両方の練習",
        "ダンサー限定コミュニティ"
      ],
      priceNote: "買い切り · 永久アクセス",
      cta: "コースを見る",
      micro: "Stripeによる安全な決済"
    }
  },
```

- [ ] **Step 8: Verificar paridad y tipos**

Run: `npx tsc --noEmit && npm run i18n:check`
Expected: ambos limpios, 0 errores

- [ ] **Step 9: Commit**

```bash
git add utils/i18n/dictionaries/
git commit -m "i18n: add home offer block and buyCourse nav labels in 6 locales"
```

---

### Task 3: Componente `HomeOffer`

Bloque de oferta de la home. Server Component puro (sin `'use client'`) — el precio viene por props y no hay interactividad, solo un `<Link>`. Sigue el lenguaje visual de las demás secciones: número de capítulo + línea + etiqueta, como en `AboutSection` (01), `Features` (02) y `Testimonials` (03). Este es el 04.

**Files:**
- Create: `components/HomeOffer.tsx`
- Create: `components/HomeOffer.module.css`
- Test: `__tests__/components/home-offer.test.tsx`

**Interfaces:**
- Consumes: `t.home.offer.*` (Task 2), `LandingCourse` (Task 1)
- Produces: `export default function HomeOffer(props: { price: number }): JSX.Element`

Nota: recibe solo `price`. El destino es siempre `/curso-bachatango` (la página del funnel), no el checkout directo — queremos que el visitante lea la página de venta completa.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/components/home-offer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import HomeOffer from '@/components/HomeOffer'

function renderOffer(price: number) {
  return render(
    <LanguageProvider initialLocale="es">
      <HomeOffer price={price} />
    </LanguageProvider>,
  )
}

describe('HomeOffer', () => {
  it('muestra el precio recibido por props', () => {
    renderOffer(97)
    expect(screen.getByText('97 €')).toBeInTheDocument()
  })

  it('enlaza al funnel de venta', () => {
    renderOffer(97)
    expect(screen.getByRole('link', { name: /ver el curso/i }))
      .toHaveAttribute('href', '/curso-bachatango')
  })

  it('lista los cuatro puntos incluidos', () => {
    renderOffer(97)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('renderiza un h2 accesible', () => {
    renderOffer(97)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/home-offer.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/HomeOffer"`

- [ ] **Step 3: Escribir el componente**

Crear `components/HomeOffer.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import Reveal from './Reveal';
import styles from './HomeOffer.module.css';

/**
 * Bloque de oferta de la home. El precio llega desde `courses.price_eur`
 * (Server Component padre) — nunca se hardcodea. El CTA lleva al funnel
 * completo, no al checkout: queremos que el visitante lea la venta entera.
 */
export default function HomeOffer({ price }: { price: number }) {
  const { t } = useLanguage();
  const c = t.home.offer;

  return (
    <section className={styles.offer} aria-labelledby="home-offer-title">
      <Reveal direction="left" distance={48}>
        <div className={styles.chapter} aria-hidden="true">
          <span className={styles.chapterNum}>{c.chapter}</span>
          <span className={styles.chapterLine} />
          <span className={styles.chapterLabel}>{c.label}</span>
        </div>
      </Reveal>

      <div className={styles.card}>
        <Reveal delay={0.06}>
          <h2 id="home-offer-title" className={styles.title}>{c.title}</h2>
        </Reveal>

        <Reveal delay={0.12}>
          <p className={styles.lead}>{c.lead}</p>
        </Reveal>

        <Reveal delay={0.18}>
          <ul className={styles.includes}>
            {c.includes.map((item) => (
              <li key={item}>
                <span className={styles.tick} aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.24}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{price} €</span>
            <span className={styles.priceNote}>{c.priceNote}</span>
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <div className={styles.ctaWrap}>
            <Link href="/curso-bachatango" className={styles.cta}>
              <span>{c.cta}</span>
              <span className={styles.ctaArrow} aria-hidden="true">→</span>
            </Link>
            <p className={styles.micro}>{c.micro}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Escribir el CSS**

Crear `components/HomeOffer.module.css`. Usa los tokens de `app/globals.css` (`--primary`, `--primary-rgb`, `--text-main`, `--text-muted`, `--border-subtle`, `--font-serif`, `--font-sans`, `--radius-pill`):

```css
.offer {
  padding-block: clamp(4rem, 12vh, 8rem);
  padding-inline: clamp(1.5rem, 6vw, 6rem);
  position: relative;
}

/* ---------- Capítulo (coherente con About 01 / Features 02 / Testimonials 03) ---------- */

.chapter {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: clamp(2rem, 5vh, 3.5rem);
}

.chapterNum {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  color: var(--primary);
  letter-spacing: 0.1em;
}

.chapterLine {
  display: block;
  width: clamp(2.5rem, 8vw, 5rem);
  height: 1px;
  background: linear-gradient(90deg, var(--primary) 0%, transparent 100%);
}

.chapterLabel {
  font-family: var(--font-sans);
  font-size: 0.7rem;
  letter-spacing: 0.28em;
  color: var(--text-muted);
  font-weight: 600;
}

/* ---------- Tarjeta ---------- */

.card {
  max-width: 760px;
  margin-inline: auto;
  padding: clamp(2rem, 5vw, 3.5rem);
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at top left, rgba(var(--primary-rgb), 0.08) 0%, transparent 60%),
    rgba(255, 255, 255, 0.02);
  text-align: center;
}

.title {
  font: var(--h2);
  font-size: clamp(1.8rem, 3.6vw, 2.75rem);
  line-height: 1.15;
  letter-spacing: -0.015em;
  color: var(--text-main);
  margin: 0;
}

.lead {
  color: var(--text-muted);
  font-size: clamp(1rem, 1.3vw, 1.1rem);
  line-height: 1.6;
  max-width: 52ch;
  margin: 1rem auto 0;
}

.includes {
  list-style: none;
  padding: 0;
  margin: clamp(1.75rem, 4vh, 2.5rem) 0 0;
  display: grid;
  gap: 0.75rem;
  text-align: left;
  max-width: 26rem;
  margin-inline: auto;
}

.includes li {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  color: var(--text-main);
  font-size: 0.95rem;
  line-height: 1.45;
}

.tick {
  color: var(--primary);
  font-weight: 700;
  line-height: 1.45;
  flex-shrink: 0;
}

/* ---------- Precio ---------- */

.priceRow {
  margin-top: clamp(1.75rem, 4vh, 2.5rem);
  padding-top: clamp(1.5rem, 3vh, 2rem);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.price {
  font-family: var(--font-serif);
  font-size: clamp(2.6rem, 6vw, 3.6rem);
  color: var(--primary);
  line-height: 1;
  letter-spacing: -0.02em;
}

.priceNote {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* ---------- CTA ---------- */

.ctaWrap {
  margin-top: clamp(1.5rem, 3vh, 2rem);
}

.cta {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  background: linear-gradient(135deg, var(--primary) 0%, #e6c885 100%);
  color: #000;
  padding: 1rem 2.25rem;
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.85rem;
  border-radius: var(--radius-pill);
  text-decoration: none;
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.25s ease;
  box-shadow: 0 10px 30px -10px rgba(var(--primary-rgb), 0.5);
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px -12px rgba(var(--primary-rgb), 0.65);
  color: #000;
}

.ctaArrow {
  display: inline-block;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.cta:hover .ctaArrow {
  transform: translateX(4px);
}

.micro {
  margin: 0.9rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

@media (prefers-reduced-motion: reduce) {
  .cta,
  .ctaArrow {
    transition: none;
  }
  .cta:hover {
    transform: none;
  }
}

@media (max-width: 768px) {
  .cta {
    width: 100%;
    justify-content: center;
  }
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/home-offer.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde

- [ ] **Step 7: Commit**

```bash
git add components/HomeOffer.tsx components/HomeOffer.module.css __tests__/components/home-offer.test.tsx
git commit -m "feat(home): add offer block with real course price"
```

---

### Task 4: Cablear la home, el header y el footer al funnel

Aquí es donde se cierra el cul-de-sac. `app/page.tsx` pasa a ser `async` y lee el curso; el CTA primario del hero, un enlace del header y otro del footer apuntan al funnel.

El CTA **secundario** del hero (`t.hero.sampleClass`) se deja como está en esta tarea — se redirige a `/clase-gratis` en la Task 11, cuando esa ruta exista.

**Files:**
- Modify: `app/page.tsx` (fichero completo)
- Modify: `components/Hero.tsx:171-174` (CTA primario)
- Modify: `components/Header.tsx` (nav desktop + drawer móvil)
- Modify: `components/FooterClient.tsx:48-57` (`exploreLinks`)
- Test: `__tests__/components/hero-ctas.test.tsx`

**Interfaces:**
- Consumes: `getLandingCourse()` (Task 1), `HomeOffer` (Task 3), `t.header.buyCourse` / `t.footer.buyCourse` (Task 2)

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/components/hero-ctas.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

import Hero from '@/components/Hero'

describe('Hero CTAs', () => {
  it('el CTA primario lleva al funnel de venta', () => {
    render(
      <LanguageProvider initialLocale="es">
        <Hero />
      </LanguageProvider>,
    )
    expect(screen.getByRole('link', { name: /descubre nuestros cursos/i }))
      .toHaveAttribute('href', '/curso-bachatango')
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/hero-ctas.test.tsx`
Expected: FAIL — el href actual es `/courses`, no `/curso-bachatango`

- [ ] **Step 3: Cambiar el CTA primario del hero**

En `components/Hero.tsx`, línea 171, cambiar solo el `href`:

```tsx
// antes
<Link href="/courses" className={styles.ctaPrimary}>
// después
<Link href="/curso-bachatango" className={styles.ctaPrimary}>
```

Dejar el `ctaSecondary` de la línea 175 intacto por ahora.

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/hero-ctas.test.tsx`
Expected: PASS

- [ ] **Step 5: Convertir `app/page.tsx` en Server Component async**

Reemplazar el fichero entero por:

```tsx
import styles from "./page.module.css";
import Hero from "@/components/Hero";
import AboutSection from "@/components/AboutSection";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import HomeOffer from "@/components/HomeOffer";
import FAQ from "@/components/FAQ";
import Newsletter from "@/components/Newsletter";
import InstagramGallery from "@/components/InstagramGallery";
import { getLandingCourse } from "@/utils/courses/landing-course";

// ISR: el precio del curso se relee como mucho cada 5 minutos.
export const revalidate = 300;

export default async function Home() {
  const course = await getLandingCourse();

  return (
    <div className={styles.container}>
      {/* Hero cinemático con imagen de fondo y animaciones de entrada */}
      <Hero />

      {/* Quiénes somos — bloque cinemático con parallax */}
      <AboutSection />

      {/* Features (con anchor para el scroll-indicator del hero) */}
      <div id="features">
        <Features />
      </div>

      {/* Testimonials */}
      <Testimonials />

      {/* Oferta — solo si el curso existe y está publicado */}
      {course && <HomeOffer price={course.price_eur} />}

      {/* Gallery */}
      <InstagramGallery />

      {/* FAQ */}
      <FAQ />

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
```

Nota: la oferta va **después** de los testimonios (prueba social antes de pedir dinero) y **antes** de Instagram/FAQ. Y el comentario del hero ya no miente sobre un vídeo que no existe.

- [ ] **Step 6: Añadir el CTA del funnel al header**

En `components/Header.tsx`, dentro de `NAV_LINKS` (líneas 67-72), añadir el curso como **primer** elemento:

```tsx
  const NAV_LINKS = [
    { href: '/curso-bachatango', label: t.header.buyCourse },
    { href: '/courses', label: t.header.courses },
    { href: '/events', label: t.header.events },
    { href: '/music', label: t.header.music },
    { href: '/community', label: t.header.community },
    { href: '/sobre-nosotros', label: t.header.about },
  ] as const;
```

`NAV_LINKS` alimenta tanto la nav de escritorio como el drawer móvil, así que un solo cambio cubre ambos. Verificar leyendo el resto de `Header.tsx` que no haya una segunda lista hardcodeada para móvil:

```bash
grep -n "NAV_LINKS" components/Header.tsx
```

Si aparece en dos sitios, bien. Si el drawer tiene su propia lista, actualizarla igual.

- [ ] **Step 7: Añadir el enlace al footer**

En `components/FooterClient.tsx`, en `exploreLinks` (líneas 48-57), añadir como primer elemento:

```tsx
  const exploreLinks = [
    { href: '/curso-bachatango', label: t.footer.buyCourse },
    { href: '/', label: t.footer.home },
    { href: '/courses', label: t.header.courses },
    { href: '/events', label: t.header.events },
    { href: '/music', label: t.header.music },
    { href: '/blog', label: t.footer.blog },
    { href: '/community', label: t.header.community },
    { href: '/contact', label: t.footer.contact },
    { href: '/sobre-nosotros', label: t.header.about },
  ];
```

- [ ] **Step 8: Comprobar visualmente en el navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000` y verificar:
- El bloque de oferta aparece tras los testimonios con el precio real de la BD (no `undefined €`, no `NaN €`).
- El CTA primario del hero y el del bloque de oferta llevan a `/curso-bachatango`.
- El curso aparece el primero en la nav del header y en la columna "Explorar" del footer.
- En `/curso-bachatango` **no** aparece header ni footer (sigue chromeless).

Si el bloque de oferta no aparece, el curso no está publicado o el `COURSE_ID` no coincide con producción — comprobar la fila en Supabase antes de tocar código.

- [ ] **Step 9: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde. El `build` importa aquí porque `page.tsx` pasó a `async` y ahora hace I/O.

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx components/Hero.tsx components/Header.tsx components/FooterClient.tsx __tests__/components/hero-ctas.test.tsx
git commit -m "feat(home): wire landing to the sales funnel

The /curso-bachatango funnel had no inbound link from anywhere in the site —
only sitemap.xml. Home hero CTA, header nav and footer now point to it, and
the home renders an offer block with the real price from the DB."
```

**Fin de la Fase 1.** La home ya vende. Antes de seguir, merece la pena desplegar a preview y confirmar el precio contra producción.

---

## FASE 2 — Consentimiento + analítica

Orden deliberado: **primero el consentimiento, después los scripts.** Meter GA4 o el Pixel antes del banner sería añadir la infracción antes que el remedio.

Modelo de consentimiento (dos categorías, ninguna activa por defecto):

| Categoría | Qué desbloquea |
|---|---|
| `analytics` | GA4 |
| `marketing` | Meta Pixel, embeds de Instagram |

Vercel Analytics y Speed Insights quedan **fuera del banner**: no usan cookies ni identificadores persistentes, así que se cargan siempre.

### Task 5: Estado de consentimiento (módulo puro + contexto)

**Files:**
- Create: `utils/consent/categories.ts`
- Create: `context/ConsentContext.tsx`
- Test: `__tests__/utils/consent.test.ts`

**Interfaces:**
- Produces desde `utils/consent/categories.ts`:
  - `export const CONSENT_COOKIE = 'ls_consent'`
  - `export const CONSENT_VERSION = 1`
  - `export const CONSENT_MAX_AGE_DAYS = 180`
  - `export interface ConsentState { v: number; analytics: boolean; marketing: boolean; at: string }`
  - `export function parseConsent(raw: string | null | undefined): ConsentState | null`
  - `export function serializeConsent(s: ConsentState): string`
  - `export function makeConsent(analytics: boolean, marketing: boolean, now: Date): ConsentState`
- Produces desde `context/ConsentContext.tsx`:
  - `export function ConsentProvider({ children }: { children: React.ReactNode })`
  - `export function useConsent(): { state: ConsentState | null; hydrated: boolean; save: (analytics: boolean, marketing: boolean) => void; reopen: () => void; isOpen: boolean }`

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/utils/consent.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  parseConsent,
  serializeConsent,
  makeConsent,
} from '@/utils/consent/categories'

describe('consent state', () => {
  it('el nombre de cookie es estable', () => {
    expect(CONSENT_COOKIE).toBe('ls_consent')
  })

  it('makeConsent sella versión y fecha', () => {
    const s = makeConsent(true, false, new Date('2026-08-11T10:00:00Z'))
    expect(s).toEqual({
      v: CONSENT_VERSION,
      analytics: true,
      marketing: false,
      at: '2026-08-11T10:00:00.000Z',
    })
  })

  it('serializar y parsear es un round-trip', () => {
    const s = makeConsent(true, true, new Date('2026-08-11T10:00:00Z'))
    expect(parseConsent(serializeConsent(s))).toEqual(s)
  })

  it('devuelve null con entrada vacía', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent(undefined)).toBeNull()
    expect(parseConsent('')).toBeNull()
  })

  it('devuelve null con JSON corrupto', () => {
    expect(parseConsent('no-es-json')).toBeNull()
    expect(parseConsent('%7Broto')).toBeNull()
  })

  it('devuelve null si la versión no coincide (re-preguntar)', () => {
    const stale = encodeURIComponent(JSON.stringify({ v: 0, analytics: true, marketing: true, at: 'x' }))
    expect(parseConsent(stale)).toBeNull()
  })

  it('devuelve null si faltan campos booleanos', () => {
    const bad = encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, analytics: 'yes', at: 'x' }))
    expect(parseConsent(bad)).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/utils/consent.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/consent/categories"`

- [ ] **Step 3: Escribir el módulo puro**

Crear `utils/consent/categories.ts`:

```ts
/**
 * Estado de consentimiento de cookies. Dos categorías, ambas denegadas por
 * defecto (RGPD art. 6.1.a: el consentimiento es opt-in explícito).
 *
 * - `analytics`  → GA4
 * - `marketing`  → Meta Pixel, embeds de Instagram
 *
 * Vercel Analytics y Speed Insights NO pasan por aquí: no usan cookies ni
 * identificadores persistentes, así que no requieren consentimiento previo.
 *
 * Se guarda en una cookie legible por JS (no httpOnly) para que el cliente
 * decida qué cargar sin esperar al servidor. No contiene datos personales.
 */
export const CONSENT_COOKIE = 'ls_consent'

/**
 * Subir esta versión invalida todos los consentimientos guardados y hace que
 * el banner vuelva a aparecer. Hacerlo cada vez que se añada una categoría o
 * un proveedor nuevo — el consentimiento anterior no cubre lo nuevo.
 */
export const CONSENT_VERSION = 1

export const CONSENT_MAX_AGE_DAYS = 180

export interface ConsentState {
  v: number
  analytics: boolean
  marketing: boolean
  /** ISO 8601. Prueba de cuándo se dio el consentimiento (RGPD art. 7.1). */
  at: string
}

export function makeConsent(analytics: boolean, marketing: boolean, now: Date): ConsentState {
  return { v: CONSENT_VERSION, analytics, marketing, at: now.toISOString() }
}

export function serializeConsent(s: ConsentState): string {
  return encodeURIComponent(JSON.stringify(s))
}

/**
 * Parsea el valor de la cookie. Devuelve null —y por tanto vuelve a preguntar—
 * ante cualquier duda: vacío, JSON corrupto, versión antigua o forma inválida.
 * Fail-closed: sin consentimiento válido no se carga nada de terceros.
 */
export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof parsed !== 'object' || parsed === null) return null
    const c = parsed as Record<string, unknown>
    if (c.v !== CONSENT_VERSION) return null
    if (typeof c.analytics !== 'boolean') return null
    if (typeof c.marketing !== 'boolean') return null
    if (typeof c.at !== 'string') return null
    return { v: CONSENT_VERSION, analytics: c.analytics, marketing: c.marketing, at: c.at }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/utils/consent.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Escribir el contexto**

Crear `context/ConsentContext.tsx`:

```tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  makeConsent,
  parseConsent,
  serializeConsent,
  type ConsentState,
} from '@/utils/consent/categories';

type ConsentContextType = {
  state: ConsentState | null;
  /** false durante el primer render en servidor y hasta leer la cookie. */
  hydrated: boolean;
  isOpen: boolean;
  save: (analytics: boolean, marketing: boolean) => void;
  reopen: () => void;
};

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // La cookie se lee tras montar, nunca durante el render: leerla en el render
  // provocaría un desajuste de hidratación (el servidor no la ve).
  useEffect(() => {
    const existing = parseConsent(readCookie(CONSENT_COOKIE));
    setState(existing);
    setHydrated(true);
    if (!existing) setIsOpen(true);
  }, []);

  const save = useCallback((analytics: boolean, marketing: boolean) => {
    const next = makeConsent(analytics, marketing, new Date());
    const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie =
      `${CONSENT_COOKIE}=${serializeConsent(next)}; path=/; max-age=${maxAge}${secure}; samesite=lax`;
    setState(next);
    setIsOpen(false);
  }, []);

  const reopen = useCallback(() => setIsOpen(true), []);

  return (
    <ConsentContext.Provider value={{ state, hydrated, isOpen, save, reopen }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextType {
  const ctx = useContext(ConsentContext);
  if (ctx === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return ctx;
}
```

- [ ] **Step 6: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde

- [ ] **Step 7: Commit**

```bash
git add utils/consent/ context/ConsentContext.tsx __tests__/utils/consent.test.ts
git commit -m "feat(consent): add consent state module and React context

Two opt-in categories (analytics, marketing), both denied by default.
Fail-closed parsing: any malformed or stale cookie re-prompts."
```

---

### Task 6: Claves de diccionario del banner de cookies

**Files:**
- Modify: los 6 ficheros de `utils/i18n/dictionaries/`

**Interfaces:**
- Produces: `t.consent.{title,body,accept,reject,configure,save,analyticsLabel,analyticsDesc,marketingLabel,marketingDesc,necessaryLabel,necessaryDesc,policyLink,manage}`

- [ ] **Step 1: Añadir el bloque a `es.ts`**

Insertar un bloque `consent` tras el bloque `common` (el que acaba con `skipToContent`):

```ts
  consent: {
    title: "Tu privacidad",
    body: "Usamos cookies propias necesarias para que la web funcione. Con tu permiso, también usaremos cookies de análisis y de marketing para entender qué te interesa y mostrarte contenido de Instagram.",
    accept: "Aceptar todo",
    reject: "Rechazar",
    configure: "Configurar",
    save: "Guardar preferencias",
    necessaryLabel: "Necesarias",
    necessaryDesc: "Imprescindibles para la sesión, el idioma y la seguridad. No se pueden desactivar.",
    analyticsLabel: "Análisis",
    analyticsDesc: "Nos dicen qué páginas se visitan para mejorar la web. Google Analytics.",
    marketingLabel: "Marketing",
    marketingDesc: "Permiten medir campañas y ver las publicaciones de Instagram integradas. Meta.",
    policyLink: "Política de cookies",
    manage: "Preferencias de cookies"
  },
```

- [ ] **Step 2: Ejecutar tsc y verificar que falla en los otros 5**

Run: `npx tsc --noEmit`
Expected: FAIL — 5 errores `Property 'consent' is missing`

- [ ] **Step 3: `en.ts`**

```ts
  consent: {
    title: "Your privacy",
    body: "We use first-party cookies that are needed for the site to work. With your permission, we will also use analytics and marketing cookies to understand what interests you and to show you Instagram content.",
    accept: "Accept all",
    reject: "Reject",
    configure: "Customise",
    save: "Save preferences",
    necessaryLabel: "Necessary",
    necessaryDesc: "Required for your session, language and security. These cannot be turned off.",
    analyticsLabel: "Analytics",
    analyticsDesc: "Tell us which pages get visited so we can improve the site. Google Analytics.",
    marketingLabel: "Marketing",
    marketingDesc: "Let us measure campaigns and display embedded Instagram posts. Meta.",
    policyLink: "Cookie policy",
    manage: "Cookie preferences"
  },
```

- [ ] **Step 4: `fr.ts`**

```ts
  consent: {
    title: "Votre vie privée",
    body: "Nous utilisons des cookies internes nécessaires au fonctionnement du site. Avec votre accord, nous utiliserons aussi des cookies d'analyse et de marketing pour comprendre ce qui vous intéresse et afficher du contenu Instagram.",
    accept: "Tout accepter",
    reject: "Refuser",
    configure: "Personnaliser",
    save: "Enregistrer mes préférences",
    necessaryLabel: "Nécessaires",
    necessaryDesc: "Indispensables à votre session, votre langue et la sécurité. Non désactivables.",
    analyticsLabel: "Analyse",
    analyticsDesc: "Nous indiquent quelles pages sont visitées afin d'améliorer le site. Google Analytics.",
    marketingLabel: "Marketing",
    marketingDesc: "Permettent de mesurer les campagnes et d'afficher les publications Instagram intégrées. Meta.",
    policyLink: "Politique de cookies",
    manage: "Préférences de cookies"
  },
```

- [ ] **Step 5: `de.ts`**

```ts
  consent: {
    title: "Deine Privatsphäre",
    body: "Wir setzen eigene Cookies ein, die für den Betrieb der Website nötig sind. Mit deiner Zustimmung nutzen wir zusätzlich Analyse- und Marketing-Cookies, um zu verstehen, was dich interessiert, und dir Instagram-Inhalte zu zeigen.",
    accept: "Alle akzeptieren",
    reject: "Ablehnen",
    configure: "Anpassen",
    save: "Einstellungen speichern",
    necessaryLabel: "Notwendig",
    necessaryDesc: "Erforderlich für Sitzung, Sprache und Sicherheit. Nicht abwählbar.",
    analyticsLabel: "Analyse",
    analyticsDesc: "Zeigen uns, welche Seiten besucht werden, damit wir die Website verbessern können. Google Analytics.",
    marketingLabel: "Marketing",
    marketingDesc: "Ermöglichen die Messung von Kampagnen und die Anzeige eingebetteter Instagram-Beiträge. Meta.",
    policyLink: "Cookie-Richtlinie",
    manage: "Cookie-Einstellungen"
  },
```

- [ ] **Step 6: `it.ts`**

```ts
  consent: {
    title: "La tua privacy",
    body: "Usiamo cookie di prima parte necessari al funzionamento del sito. Con il tuo consenso useremo anche cookie di analisi e di marketing per capire cosa ti interessa e mostrarti contenuti di Instagram.",
    accept: "Accetta tutto",
    reject: "Rifiuta",
    configure: "Personalizza",
    save: "Salva preferenze",
    necessaryLabel: "Necessari",
    necessaryDesc: "Indispensabili per sessione, lingua e sicurezza. Non disattivabili.",
    analyticsLabel: "Analisi",
    analyticsDesc: "Ci dicono quali pagine vengono visitate per migliorare il sito. Google Analytics.",
    marketingLabel: "Marketing",
    marketingDesc: "Permettono di misurare le campagne e di mostrare i post di Instagram incorporati. Meta.",
    policyLink: "Informativa sui cookie",
    manage: "Preferenze cookie"
  },
```

- [ ] **Step 7: `ja.ts`**

```ts
  consent: {
    title: "プライバシーについて",
    body: "サイトの動作に必要な自社クッキーを使用しています。同意いただける場合は、関心を把握するための分析クッキーと、Instagramのコンテンツを表示するためのマーケティングクッキーも使用します。",
    accept: "すべて許可",
    reject: "拒否する",
    configure: "設定する",
    save: "設定を保存",
    necessaryLabel: "必須",
    necessaryDesc: "セッション、言語、セキュリティに必要です。無効にできません。",
    analyticsLabel: "分析",
    analyticsDesc: "どのページが閲覧されたかを把握し、サイト改善に役立てます。Google Analytics。",
    marketingLabel: "マーケティング",
    marketingDesc: "キャンペーンの計測と、埋め込みInstagram投稿の表示に使用します。Meta。",
    policyLink: "クッキーポリシー",
    manage: "クッキー設定"
  },
```

- [ ] **Step 8: Verificar paridad y tipos**

Run: `npx tsc --noEmit && npm run i18n:check`
Expected: ambos limpios

- [ ] **Step 9: Commit**

```bash
git add utils/i18n/dictionaries/
git commit -m "i18n: add cookie consent banner copy in 6 locales"
```

---

### Task 7: Banner de consentimiento

Banner de tres botones (Aceptar todo / Rechazar / Configurar) con un panel desplegable de dos interruptores. Rechazar y Aceptar tienen el mismo peso visual — la AEPD considera patrón oscuro esconder el rechazo o dejarlo a un clic más de distancia.

**Files:**
- Create: `components/CookieConsent.tsx`
- Create: `components/CookieConsent.module.css`
- Modify: `app/layout.tsx` (montar `ConsentProvider` + `CookieConsent`)
- Modify: `components/FooterClient.tsx` (enlace "Preferencias de cookies")
- Test: `__tests__/components/cookie-consent.test.tsx`

**Interfaces:**
- Consumes: `useConsent()` (Task 5), `t.consent.*` (Task 6)
- Produces: `export default function CookieConsent(): JSX.Element | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/components/cookie-consent.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/context/LanguageContext'
import { ConsentProvider } from '@/context/ConsentContext'
import { CONSENT_COOKIE, parseConsent } from '@/utils/consent/categories'
import CookieConsent from '@/components/CookieConsent'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

function renderBanner() {
  return render(
    <LanguageProvider initialLocale="es">
      <ConsentProvider>
        <CookieConsent />
      </ConsentProvider>
    </LanguageProvider>,
  )
}

function currentConsent() {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))
  return parseConsent(m ? m[1] : null)
}

describe('CookieConsent', () => {
  beforeEach(() => {
    document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`
  })

  it('se muestra cuando no hay decisión guardada', async () => {
    renderBanner()
    expect(await screen.findByRole('dialog', { name: /tu privacidad/i })).toBeInTheDocument()
  })

  it('"Aceptar todo" concede ambas categorías y cierra', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /aceptar todo/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentConsent()).toMatchObject({ analytics: true, marketing: true })
  })

  it('"Rechazar" deniega ambas categorías y cierra', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentConsent()).toMatchObject({ analytics: false, marketing: false })
  })

  it('"Configurar" permite guardar solo análisis', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /configurar/i }))
    await user.click(screen.getByRole('checkbox', { name: /análisis/i }))
    await user.click(screen.getByRole('button', { name: /guardar preferencias/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentConsent()).toMatchObject({ analytics: true, marketing: false })
  })

  it('no se muestra si ya hay una decisión guardada', async () => {
    const user = userEvent.setup()
    const { unmount } = renderBanner()
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }))
    unmount()

    renderBanner()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/cookie-consent.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/CookieConsent"`

- [ ] **Step 3: Escribir el componente**

Crear `components/CookieConsent.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useConsent } from '@/context/ConsentContext';
import { useLanguage } from '@/context/LanguageContext';
import styles from './CookieConsent.module.css';

/**
 * Banner de consentimiento. Los tres botones tienen el mismo peso visual:
 * esconder el rechazo o exigir clics extra para denegar es un patrón oscuro
 * y la AEPD lo trata como consentimiento no válido.
 *
 * Devuelve null hasta que el contexto ha leído la cookie, para no parpadear
 * en cada carga de página para quien ya decidió.
 */
export default function CookieConsent() {
  const { t } = useLanguage();
  const { hydrated, isOpen, save } = useConsent();
  const [showDetail, setShowDetail] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const c = t.consent;

  if (!hydrated || !isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="false"
      aria-label={c.title}
    >
      <div className={styles.panel}>
        <h2 className={styles.title}>{c.title}</h2>
        <p className={styles.body}>{c.body}</p>

        {showDetail && (
          <ul className={styles.categories}>
            <li className={styles.category}>
              <div className={styles.categoryHead}>
                <span className={styles.categoryName}>{c.necessaryLabel}</span>
                <span className={styles.always}>✓</span>
              </div>
              <p className={styles.categoryDesc}>{c.necessaryDesc}</p>
            </li>

            <li className={styles.category}>
              <label className={styles.categoryHead}>
                <span className={styles.categoryName}>{c.analyticsLabel}</span>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className={styles.toggle}
                />
              </label>
              <p className={styles.categoryDesc}>{c.analyticsDesc}</p>
            </li>

            <li className={styles.category}>
              <label className={styles.categoryHead}>
                <span className={styles.categoryName}>{c.marketingLabel}</span>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className={styles.toggle}
                />
              </label>
              <p className={styles.categoryDesc}>{c.marketingDesc}</p>
            </li>
          </ul>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => save(true, true)}>
            {c.accept}
          </button>
          <button type="button" className={styles.secondary} onClick={() => save(false, false)}>
            {c.reject}
          </button>
          {showDetail ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => save(analytics, marketing)}
            >
              {c.save}
            </button>
          ) : (
            <button
              type="button"
              className={styles.tertiary}
              onClick={() => setShowDetail(true)}
            >
              {c.configure}
            </button>
          )}
        </div>

        <Link href="/legal/cookies" className={styles.policy}>
          {c.policyLink}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Escribir el CSS**

Crear `components/CookieConsent.module.css`:

```css
.overlay {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  pointer-events: none;
}

.panel {
  pointer-events: auto;
  width: min(46rem, 100%);
  max-height: 80vh;
  overflow-y: auto;
  background: #0b0b0b;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: clamp(1.25rem, 3vw, 1.75rem);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.9);
}

.title {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  color: var(--text-main);
  margin: 0 0 0.5rem;
}

.body {
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.55;
  margin: 0;
}

/* ---------- Detalle por categoría ---------- */

.categories {
  list-style: none;
  padding: 0;
  margin: 1.25rem 0 0;
  display: grid;
  gap: 0.9rem;
}

.category {
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.9rem;
}

.categoryHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
}

.categoryName {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}

.always {
  color: var(--primary);
  font-size: 0.85rem;
}

.toggle {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
}

.categoryDesc {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-muted);
}

/* ---------- Acciones ---------- */

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.primary,
.secondary,
.tertiary {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 0.7rem 1.25rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  flex: 1 1 auto;
  min-width: 8rem;
}

.primary {
  background: var(--primary);
  color: #000;
}

.primary:hover {
  background: var(--primary-hover);
}

/* Mismo tamaño y prominencia que "aceptar": denegar no puede costar más. */
.secondary {
  background: transparent;
  border-color: var(--border-subtle);
  color: var(--text-main);
}

.secondary:hover {
  border-color: var(--primary);
}

.tertiary {
  background: transparent;
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.tertiary:hover {
  color: var(--text-main);
}

.policy {
  display: inline-block;
  margin-top: 0.9rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.policy:hover {
  color: var(--primary);
}

@media (max-width: 560px) {
  .actions {
    flex-direction: column;
  }
  .primary,
  .secondary,
  .tertiary {
    width: 100%;
  }
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/cookie-consent.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 6: Montar en el layout**

En `app/layout.tsx`, añadir los imports junto a los demás de componentes:

```tsx
import { ConsentProvider } from '@/context/ConsentContext';
import CookieConsent from '@/components/CookieConsent';
```

Y envolver el contenido del `<body>`. `ConsentProvider` va **dentro** de `LanguageProvider` porque `CookieConsent` usa `useLanguage`:

```tsx
      <body className={inter.className}>
        <LanguageProvider initialLocale={locale}>
          <ConsentProvider>
            <a href="#main-content" className="skip-link">
              {dict.common.skipToContent}
            </a>
            {(await isTestPurchaseMode()) && <DemoBanner />}
            <Header user={user} profile={profile} />
            <main id="main-content" tabIndex={-1} style={{ minHeight: '80vh' }}>
              {children}
            </main>
            <Footer />
            <FunnelLegalFooter />
            <CookieConsent />
          </ConsentProvider>
        </LanguageProvider>
      </body>
```

- [ ] **Step 7: Añadir el reabridor al footer**

El usuario debe poder cambiar de opinión (RGPD art. 7.3: retirar el consentimiento tan fácil como darlo).

En `components/FooterClient.tsx`, importar el hook:

```tsx
import { useConsent } from '@/context/ConsentContext';
```

Dentro del componente, junto a los demás hooks:

```tsx
  const { reopen } = useConsent();
```

Y en la lista `legalLinks` renderizada (líneas 182-192), añadir un `<li>` extra **después** del `.map()` de `legalLinks`, dentro del mismo `<ul>`:

```tsx
                <li>
                  <button type="button" onClick={reopen} className={styles.link}>
                    {t.consent.manage}
                  </button>
                </li>
```

`FooterClient` ya es `'use client'`, así que el hook funciona. Comprobar que `styles.link` da un aspecto aceptable a un `<button>`; si hereda fondo o borde del navegador, añadir en `Footer.module.css`:

```css
button.link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  text-align: left;
}
```

- [ ] **Step 8: Comprobar en el navegador**

```bash
npm run dev
```

En una ventana de incógnito, en `http://localhost:3000`:
- El banner aparece abajo en la primera visita.
- "Rechazar" lo cierra y no reaparece al navegar ni al recargar.
- El enlace "Preferencias de cookies" del footer lo vuelve a abrir.
- Con el teclado: se puede tabular hasta los tres botones y activarlos con Enter.
- El banner no tapa el CTA del hero en móvil (375 px de ancho).

- [ ] **Step 9: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 10: Commit**

```bash
git add components/CookieConsent.tsx components/CookieConsent.module.css app/layout.tsx components/FooterClient.tsx components/Footer.module.css __tests__/components/cookie-consent.test.tsx
git commit -m "feat(consent): add cookie consent banner

Accept/Reject/Customise with equal visual weight. Footer link reopens it so
consent can be withdrawn as easily as it was given (GDPR art. 7.3)."
```

---

### Task 8: Cargar analítica y terceros bajo consentimiento

Tres cosas a la vez porque comparten la misma verdad (`useConsent()`) y la misma CSP:
1. Vercel Analytics + Speed Insights, siempre (sin cookies).
2. GA4 y Meta Pixel, solo con su categoría concedida.
3. El embed de Instagram, hoy incondicional, pasa a exigir `marketing`.

**Files:**
- Create: `components/ThirdPartyScripts.tsx`
- Modify: `components/InstagramGallery.tsx` (fichero completo)
- Modify: `components/InstagramGallery.module.css` (añadir estilos del placeholder)
- Modify: `app/layout.tsx`
- Modify: `next.config.ts:54-62` (CSP)
- Modify: los 6 diccionarios (`consent.embedBlocked`, `consent.enableEmbed`)
- Modify: `CLAUDE.md` (documentar las variables de entorno nuevas)
- Test: `__tests__/components/third-party-scripts.test.tsx`

**Interfaces:**
- Consumes: `useConsent()` (Task 5)
- Produces: `export default function ThirdPartyScripts(): JSX.Element | null`
- Variables de entorno nuevas, ambas opcionales y fail-closed (si faltan, el script no se carga):
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID` (formato `G-XXXXXXXXXX`)
  - `NEXT_PUBLIC_META_PIXEL_ID` (numérico)

- [ ] **Step 1: Instalar las dependencias de Vercel**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

- [ ] **Step 2: Añadir las dos claves de diccionario del embed bloqueado**

En los 6 ficheros, **dentro** del bloque `consent` que creaste en la Task 6, añadir dos claves:

`es.ts`:
```ts
    embedBlocked: "Para ver las publicaciones de Instagram necesitamos tu permiso para cookies de marketing.",
    enableEmbed: "Activar y ver"
```
`en.ts`:
```ts
    embedBlocked: "To show Instagram posts we need your permission for marketing cookies.",
    enableEmbed: "Enable and view"
```
`fr.ts`:
```ts
    embedBlocked: "Pour afficher les publications Instagram, nous avons besoin de votre accord pour les cookies marketing.",
    enableEmbed: "Activer et voir"
```
`de.ts`:
```ts
    embedBlocked: "Um Instagram-Beiträge anzuzeigen, brauchen wir deine Zustimmung für Marketing-Cookies.",
    enableEmbed: "Aktivieren und ansehen"
```
`it.ts`:
```ts
    embedBlocked: "Per mostrare i post di Instagram ci serve il tuo consenso per i cookie di marketing.",
    enableEmbed: "Attiva e guarda"
```
`ja.ts`:
```ts
    embedBlocked: "Instagramの投稿を表示するには、マーケティングクッキーへの同意が必要です。",
    enableEmbed: "許可して表示"
```

Run: `npx tsc --noEmit && npm run i18n:check`
Expected: limpio

- [ ] **Step 3: Escribir el test que falla**

Crear `__tests__/components/third-party-scripts.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const consentMock = vi.fn()
vi.mock('@/context/ConsentContext', () => ({
  useConsent: () => consentMock(),
}))

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) =>
    <script data-testid={id ?? 'inline'} data-src={src ?? ''} />,
}))

import ThirdPartyScripts from '@/components/ThirdPartyScripts'

const OLD_ENV = { ...process.env }

describe('ThirdPartyScripts', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123'
    process.env.NEXT_PUBLIC_META_PIXEL_ID = '99999'
  })
  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('no carga nada sin consentimiento', () => {
    consentMock.mockReturnValue({ state: null, hydrated: true })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelectorAll('script')).toHaveLength(0)
  })

  it('no carga nada antes de hidratar', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: true, marketing: true, at: 'x' },
      hydrated: false,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelectorAll('script')).toHaveLength(0)
  })

  it('carga GA4 solo con analytics concedido', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: true, marketing: false, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="ga4-src"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="meta-pixel"]')).toBeNull()
  })

  it('carga el Pixel solo con marketing concedido', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: false, marketing: true, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="meta-pixel"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="ga4-src"]')).toBeNull()
  })

  it('no carga GA4 si falta el measurement id (fail-closed)', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    consentMock.mockReturnValue({
      state: { v: 1, analytics: true, marketing: false, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="ga4-src"]')).toBeNull()
  })
})
```

- [ ] **Step 4: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/third-party-scripts.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ThirdPartyScripts"`

- [ ] **Step 5: Escribir el componente**

Crear `components/ThirdPartyScripts.tsx`:

```tsx
'use client';

import Script from 'next/script';
import { useConsent } from '@/context/ConsentContext';

/**
 * Scripts de terceros que solo se cargan con su categoría de consentimiento
 * concedida. Fail-closed en dos sentidos: sin decisión guardada no se carga
 * nada, y sin la variable de entorno correspondiente tampoco.
 *
 * Vercel Analytics y Speed Insights NO están aquí — no usan cookies, se
 * montan directamente en el layout.
 */
export default function ThirdPartyScripts() {
  const { state, hydrated } = useConsent();

  if (!hydrated || !state) return null;

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  const loadGa = state.analytics && !!gaId;
  const loadPixel = state.marketing && !!pixelId;

  return (
    <>
      {loadGa && (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {loadPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/third-party-scripts.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 7: Gatear el embed de Instagram**

Reemplazar `components/InstagramGallery.tsx` entero:

```tsx
'use client';

import { useEffect } from 'react';
import { useConsent } from '@/context/ConsentContext';
import { useLanguage } from '@/context/LanguageContext';
import styles from './InstagramGallery.module.css';

// Reemplaza estos enlaces con los de tus publicaciones reales de Instagram
const POST_URLS = [
  "https://www.instagram.com/p/DHBozg5IaNB/",
  "https://www.instagram.com/p/DFaFP82tusq/",
  "https://www.instagram.com/p/C_N0Vy9I9aJ/"
];

export default function InstagramGallery() {
  const { t } = useLanguage();
  const { state, hydrated, reopen } = useConsent();
  const allowed = hydrated && state?.marketing === true;

  useEffect(() => {
    // embed.js de Meta deja cookies de terceros: solo se carga con la
    // categoría `marketing` concedida.
    if (!allowed) return;

    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    document.body.appendChild(script);

    // Instagram inyecta los iframes sin atributo title, lo que rompe la
    // comprobación `frame-title` de Lighthouse.
    const observer = new MutationObserver(() => {
      document
        .querySelectorAll<HTMLIFrameElement>('iframe.instagram-media-rendered, iframe.instagram-media')
        .forEach((iframe) => {
          if (!iframe.title) iframe.title = 'Instagram';
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [allowed]);

  return (
    <section className={styles.gallery}>
      <h2 className={styles.title}>
        <span>Instagram</span>
        <a
          href="https://www.instagram.com/luisysaradance/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          @luisysaradance
        </a>
      </h2>

      {allowed ? (
        <div className={styles.embedGrid}>
          {POST_URLS.map((url, i) => (
            <div key={i} className={styles.embedContainer}>
              <blockquote
                className="instagram-media"
                data-instgrm-permalink={url}
                data-instgrm-version="14"
                style={{
                  background: '#FFF',
                  border: '0',
                  borderRadius: '3px',
                  boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                  margin: '1px',
                  maxWidth: '540px',
                  minWidth: '326px',
                  padding: '0',
                  width: '100%'
                }}
              >
              </blockquote>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.blocked}>
          <p className={styles.blockedText}>{t.consent.embedBlocked}</p>
          <button type="button" className={styles.blockedCta} onClick={reopen}>
            {t.consent.enableEmbed}
          </button>
        </div>
      )}
    </section>
  );
}
```

Nota: el `<h2>` pasa de `Síguenos en Instagram` (hardcodeado en español) a `Instagram`, que funciona en los 6 idiomas sin traducir. El texto largo en español se elimina.

- [ ] **Step 8: Estilos del placeholder**

Añadir al final de `components/InstagramGallery.module.css`:

```css
.blocked {
  max-width: 34rem;
  margin-inline: auto;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border: 1px dashed var(--border-subtle);
  border-radius: 14px;
  text-align: center;
}

.blockedText {
  margin: 0 0 1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

.blockedCta {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 0.65rem 1.4rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--primary);
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.blockedCta:hover {
  background: var(--primary);
  color: #000;
}
```

- [ ] **Step 9: Montar en el layout**

En `app/layout.tsx`, añadir imports:

```tsx
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ThirdPartyScripts from '@/components/ThirdPartyScripts';
```

Dentro de `<ConsentProvider>`, justo después de `<CookieConsent />`:

```tsx
            <CookieConsent />
            <ThirdPartyScripts />
            <Analytics />
            <SpeedInsights />
```

- [ ] **Step 10: Ampliar la CSP**

En `next.config.ts`, sustituir las cuatro directivas afectadas (líneas 54, 56, 61, 62). Mantén el resto tal cual:

```ts
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://js.stripe.com https://*.mux.com https://www.instagram.com https://platform.instagram.com https://www.gstatic.com https://www.googletagmanager.com https://connect.facebook.net https://va.vercel-scripts.com`,
```

```ts
              `img-src 'self' data: blob: https://${SUPABASE_HOST} https://image.mux.com https://*.googleusercontent.com https://flagcdn.com https://*.cdninstagram.com https://*.fbcdn.net https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com`,
```

```ts
              `connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.mux.com https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://*.vercel-insights.com https://www.instagram.com https://graph.instagram.com`,
```

```ts
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://open.spotify.com https://www.instagram.com https://www.facebook.com",
```

> **Aviso de seguridad:** cada host añadido a `script-src` puede ejecutar JavaScript en el dominio con plena confianza. Los cinco de arriba son los mínimos para GA4 (`googletagmanager.com`), Meta Pixel (`connect.facebook.net`) y Vercel Analytics (`va.vercel-scripts.com`). No añadas más "por si acaso": si en el futuro un proveedor no carga, comprueba primero el error exacto de CSP en la consola antes de ampliar la lista.

- [ ] **Step 11: Documentar las variables de entorno**

En `CLAUDE.md`, en el bloque "Required Environment Variables", añadir tras `RESEND_API_KEY`:

```
NEXT_PUBLIC_GA_MEASUREMENT_ID  # Opcional. GA4 (G-XXXXXXXXXX). Fail-closed: sin él, GA4 no se carga nunca, aun con consentimiento de análisis.
NEXT_PUBLIC_META_PIXEL_ID      # Opcional. ID numérico del Meta Pixel. Fail-closed: sin él, el Pixel no se carga nunca, aun con consentimiento de marketing.
```

Y darlos de alta en Vercel (Production + Preview) antes de desplegar:

```bash
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID production
vercel env add NEXT_PUBLIC_META_PIXEL_ID production
```

- [ ] **Step 12: Comprobar en el navegador**

```bash
npm run dev
```

En incógnito, con la pestaña Network abierta y filtrando por `googletagmanager|facebook|instagram`:
- Antes de decidir: **cero** peticiones a esos tres dominios. La galería muestra el placeholder.
- Tras "Rechazar": siguen en cero. Placeholder sigue.
- Tras "Aceptar todo" (recargar): aparecen las peticiones y los embeds se renderizan.
- La consola no muestra ningún error `Refused to load ... violates the following Content Security Policy directive`. Si aparece alguno, apunta el host exacto y añádelo solo a la directiva que lo pide.

- [ ] **Step 13: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 14: Commit**

```bash
git add components/ThirdPartyScripts.tsx components/InstagramGallery.tsx components/InstagramGallery.module.css app/layout.tsx next.config.ts CLAUDE.md package.json package-lock.json utils/i18n/dictionaries/ __tests__/components/third-party-scripts.test.tsx
git commit -m "feat(analytics): load GA4, Meta Pixel and Instagram embeds behind consent

Instagram embed.js used to drop Meta cookies on every visit with no prior
consent. Now gated on the marketing category. Vercel Analytics and Speed
Insights load unconditionally — no cookies, no consent needed."
```

**Fin de la Fase 2.** A partir de aquí hay datos de conversión. Dejar correr una semana antes de juzgar el efecto de la Fase 1.

---

## FASE 3 — Clase gratis pública

Hoy `app/courses/[courseId]/[lessonId]/page.tsx:35-37` hace `redirect('/login')` para anónimos **antes** de mirar `is_free`. No tocamos esa ruta: es la del área privada y el redirect es correcto allí. Creamos una ruta nueva y separada, `/clase-gratis`, con su propio control de acceso: una única lección, elegida en servidor, siempre `is_free`.

### Task 9: Token público de Mux y selección de la lección gratis

**Files:**
- Create: `utils/mux/public-token.ts`
- Create: `utils/courses/free-lesson.ts`
- Test: `__tests__/utils/free-lesson.test.ts`

**Interfaces:**
- Produces desde `utils/mux/public-token.ts`:
  - `export async function signPublicPlaybackToken(playbackId: string): Promise<string>`
  - `export async function signPublicThumbnailToken(playbackId: string): Promise<string>`
- Produces desde `utils/courses/free-lesson.ts`:
  - `export interface FreeLesson { id: string; title: string; description: string | null; thumbnail_url: string | null; mux_playback_id: string; course_id: string }`
  - `export async function getFreeLesson(): Promise<FreeLesson | null>`

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/utils/free-lesson.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const limitMock = vi.fn()
const orderMock = vi.fn(() => ({ limit: limitMock }))
const eqMock = vi.fn(function chain() { return { eq: eqMock, order: orderMock } })
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

import { getFreeLesson } from '@/utils/courses/free-lesson'

const ROW = {
  id: 'l1',
  title: 'Clase 1',
  description: 'Intro',
  thumbnail_url: null,
  mux_playback_id: 'pb1',
  course_id: 'c1',
}

describe('getFreeLesson', () => {
  beforeEach(() => {
    limitMock.mockReset()
    fromMock.mockClear()
  })

  it('devuelve la primera lección gratuita lista', async () => {
    limitMock.mockResolvedValue({ data: [ROW], error: null })
    expect(await getFreeLesson()).toEqual(ROW)
    expect(fromMock).toHaveBeenCalledWith('lessons')
  })

  it('devuelve null cuando no hay ninguna lección gratuita', async () => {
    limitMock.mockResolvedValue({ data: [], error: null })
    expect(await getFreeLesson()).toBeNull()
  })

  it('devuelve null cuando la query falla', async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getFreeLesson()).toBeNull()
  })

  it('descarta filas sin mux_playback_id', async () => {
    limitMock.mockResolvedValue({ data: [{ ...ROW, mux_playback_id: null }], error: null })
    expect(await getFreeLesson()).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/utils/free-lesson.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/courses/free-lesson"`

- [ ] **Step 3: Escribir el selector de lección**

Crear `utils/courses/free-lesson.ts`:

```ts
import 'server-only'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { COURSE_ID } from './landing-course'

export interface FreeLesson {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  mux_playback_id: string
  course_id: string
}

/**
 * Lección de muestra que sirve `/clase-gratis`. Es la lección `is_free` de
 * menor `order` del curso de la landing que ya tenga vídeo listo en Mux.
 *
 * Usa el service role porque las RLS de `lessons` no dejan leer a un
 * visitante anónimo. Es seguro: el filtro `is_free = true` está fijado aquí,
 * en servidor, y no llega ningún parámetro desde el cliente — no hay forma de
 * pedir otra lección.
 */
export async function getFreeLesson(): Promise<FreeLesson | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  )

  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, description, thumbnail_url, mux_playback_id, course_id')
    .eq('course_id', COURSE_ID)
    .eq('is_free', true)
    .eq('mux_status', 'ready')
    .order('order', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) return null

  const row = data[0] as Partial<FreeLesson>
  if (!row.mux_playback_id) return null

  return row as FreeLesson
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/utils/free-lesson.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Escribir el firmador de tokens públicos**

Crear `utils/mux/public-token.ts`:

```ts
import 'server-only'
import { unstable_cache } from 'next/cache'
import { signPlaybackToken, signThumbnailToken } from './server'

/**
 * JWT de reproducción para la clase gratis pública. A diferencia de
 * `signPlaybackTokenForUser`, no va ligado a ningún usuario porque el
 * espectador puede ser anónimo.
 *
 * TTL 15 min, caché 10 min: la caché siempre expira antes que el token, así
 * que nunca se sirve un JWT ya caducado. Al no depender del usuario, todos
 * los visitantes comparten la misma entrada de caché.
 *
 * Compromiso asumido: durante esos 15 minutos la URL firmada es compartible.
 * Es aceptable — la lección es deliberadamente gratuita y pública.
 */
export async function signPublicPlaybackToken(playbackId: string): Promise<string> {
  return unstable_cache(
    () => signPlaybackToken(playbackId, '15m'),
    ['mux-public-playback', playbackId],
    { revalidate: 60 * 10 },
  )()
}

export async function signPublicThumbnailToken(playbackId: string): Promise<string> {
  return unstable_cache(
    () => signThumbnailToken(playbackId, '15m'),
    ['mux-public-thumb', playbackId],
    { revalidate: 60 * 10 },
  )()
}
```

- [ ] **Step 6: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde

- [ ] **Step 7: Commit**

```bash
git add utils/mux/public-token.ts utils/courses/free-lesson.ts __tests__/utils/free-lesson.test.ts
git commit -m "feat(free-class): add public Mux token signer and free lesson selector

The is_free flag exists but no route ever served a lesson to an anonymous
visitor. These two modules are the server-side half of that."
```

---

### Task 10: Ruta `/clase-gratis`

**Files:**
- Create: `app/clase-gratis/page.tsx`
- Create: `app/clase-gratis/page.module.css`
- Create: `components/FreeClassPlayer.tsx`
- Modify: los 6 diccionarios (`freeClass.*`)
- Test: `__tests__/components/free-class-player.test.tsx`

**Interfaces:**
- Consumes: `getFreeLesson()`, `signPublicPlaybackToken()`, `signPublicThumbnailToken()` (Task 9), `getLandingCourse()` (Task 1)
- Produces: ruta pública `/clase-gratis`; `export default function FreeClassPlayer(props: { playbackId: string; playbackToken: string; thumbnailToken: string; posterUrl: string | null; title: string })`

Nota: `components/LessonPlayer.tsx` **no** vale aquí — llama a `markLessonAsCompleted()` en `onEnded`, que necesita sesión. Hace falta un player propio, más simple.

- [ ] **Step 1: Añadir las claves de diccionario**

En los 6 ficheros, tras el bloque `home` (Task 2):

`es.ts`:
```ts
  freeClass: {
    eyebrow: "CLASE GRATUITA",
    title: "Pruébalo antes de decidir",
    lead: "Una clase completa del curso, íntegra y sin recortes. Sin tarjeta, sin cuenta, sin compromiso.",
    ctaTitle: "¿Te ha gustado?",
    ctaBody: "Esto es una clase de muchas. El curso completo te lleva paso a paso desde la base hasta bailar con seguridad.",
    cta: "Ver el curso completo",
    unavailable: "La clase de muestra no está disponible ahora mismo. Vuelve en un rato o escríbenos.",
    unavailableCta: "Ver los cursos"
  },
```
`en.ts`:
```ts
  freeClass: {
    eyebrow: "FREE CLASS",
    title: "Try it before you decide",
    lead: "A full class from the course, complete and uncut. No card, no account, no strings.",
    ctaTitle: "Enjoyed it?",
    ctaBody: "This is one class out of many. The full course takes you step by step from the basics to dancing with confidence.",
    cta: "See the full course",
    unavailable: "The sample class is not available right now. Check back shortly or get in touch.",
    unavailableCta: "Browse the courses"
  },
```
`fr.ts`:
```ts
  freeClass: {
    eyebrow: "COURS GRATUIT",
    title: "Essayez avant de décider",
    lead: "Un cours complet tiré du programme, intégral et sans coupure. Sans carte, sans compte, sans engagement.",
    ctaTitle: "Ça vous a plu ?",
    ctaBody: "C'est un cours parmi beaucoup d'autres. Le programme complet vous mène pas à pas des bases jusqu'à danser en confiance.",
    cta: "Voir le cours complet",
    unavailable: "Le cours d'essai n'est pas disponible pour le moment. Revenez bientôt ou écrivez-nous.",
    unavailableCta: "Voir les cours"
  },
```
`de.ts`:
```ts
  freeClass: {
    eyebrow: "GRATIS-STUNDE",
    title: "Probier es aus, bevor du dich entscheidest",
    lead: "Eine komplette Stunde aus dem Kurs, ungekürzt. Ohne Karte, ohne Konto, ohne Verpflichtung.",
    ctaTitle: "Hat es dir gefallen?",
    ctaBody: "Das ist eine von vielen Stunden. Der komplette Kurs führt dich Schritt für Schritt von den Grundlagen bis zum sicheren Tanzen.",
    cta: "Den kompletten Kurs ansehen",
    unavailable: "Die Probestunde ist gerade nicht verfügbar. Schau später wieder vorbei oder schreib uns.",
    unavailableCta: "Kurse ansehen"
  },
```
`it.ts`:
```ts
  freeClass: {
    eyebrow: "LEZIONE GRATUITA",
    title: "Provala prima di decidere",
    lead: "Una lezione completa del corso, integrale e senza tagli. Senza carta, senza account, senza impegno.",
    ctaTitle: "Ti è piaciuta?",
    ctaBody: "Questa è una lezione fra tante. Il corso completo ti porta passo dopo passo dalle basi fino a ballare con sicurezza.",
    cta: "Vedi il corso completo",
    unavailable: "La lezione di prova non è disponibile in questo momento. Torna più tardi o scrivici.",
    unavailableCta: "Vedi i corsi"
  },
```
`ja.ts`:
```ts
  freeClass: {
    eyebrow: "無料レッスン",
    title: "決める前に、試してみてください",
    lead: "コースの1レッスンを、カットなしで丸ごと公開。カード不要、アカウント不要、条件なし。",
    ctaTitle: "気に入りましたか？",
    ctaBody: "これは数あるレッスンのひとつです。コース全体では、基礎から自信を持って踊れるようになるまで段階的に進みます。",
    cta: "コース全体を見る",
    unavailable: "現在、体験レッスンはご利用いただけません。しばらくしてからもう一度お試しいただくか、ご連絡ください。",
    unavailableCta: "コース一覧を見る"
  },
```

Run: `npx tsc --noEmit && npm run i18n:check`
Expected: limpio

- [ ] **Step 2: Escribir el test del player**

Crear `__tests__/components/free-class-player.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@mux/mux-player-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="mux-player"
      data-playback-id={String(props.playbackId)}
      data-has-token={String(Boolean((props.tokens as Record<string, string>)?.playback))}
    />
  ),
}))

import FreeClassPlayer from '@/components/FreeClassPlayer'

describe('FreeClassPlayer', () => {
  it('pasa playbackId y token al reproductor', () => {
    render(
      <FreeClassPlayer
        playbackId="pb1"
        playbackToken="tok"
        thumbnailToken="thumb"
        posterUrl={null}
        title="Clase 1"
      />,
    )
    const player = screen.getByTestId('mux-player')
    expect(player).toHaveAttribute('data-playback-id', 'pb1')
    expect(player).toHaveAttribute('data-has-token', 'true')
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/free-class-player.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/FreeClassPlayer"`

- [ ] **Step 4: Escribir el player**

Crear `components/FreeClassPlayer.tsx`:

```tsx
'use client'

import MuxPlayer from '@mux/mux-player-react'
import styles from './LessonPlayer.module.css'

interface Props {
  playbackId: string
  playbackToken: string
  thumbnailToken: string
  posterUrl: string | null
  title: string
}

/**
 * Reproductor de la clase gratis pública. No es `LessonPlayer` porque aquel
 * llama a `markLessonAsCompleted()` al terminar, y eso requiere sesión: aquí
 * el espectador puede ser anónimo. Sin `viewer_user_id` en metadata por la
 * misma razón.
 *
 * Reutiliza `LessonPlayer.module.css` — el envoltorio y el ratio son idénticos.
 */
export default function FreeClassPlayer({
  playbackId, playbackToken, thumbnailToken, posterUrl, title,
}: Props) {
  return (
    <div className={styles.wrapper}>
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback: playbackToken, thumbnail: thumbnailToken }}
        poster={posterUrl || undefined}
        metadata={{ video_title: title }}
        className={styles.player}
      />
    </div>
  )
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/free-class-player.test.tsx`
Expected: PASS

- [ ] **Step 6: Escribir la página**

Crear `app/clase-gratis/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getDict } from '@/utils/get-dict';
import { getFreeLesson } from '@/utils/courses/free-lesson';
import { getLandingCourse } from '@/utils/courses/landing-course';
import { signPublicPlaybackToken, signPublicThumbnailToken } from '@/utils/mux/public-token';
import FreeClassPlayer from '@/components/FreeClassPlayer';
import styles from './page.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com';

// El JWT vive 15 min y la caché de tokens 10; regenerar el HTML cada 5 min
// garantiza que el token embebido nunca está próximo a caducar.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Clase gratis de Bachatango',
  description: 'Una clase completa del curso de Bachatango de Luis y Sara, gratis y sin registro. Pruébala antes de decidir.',
  alternates: { canonical: `${BASE_URL}/clase-gratis` },
  openGraph: {
    title: 'Clase gratis de Bachatango | Luis y Sara',
    description: 'Una clase completa del curso, gratis y sin registro.',
    url: `${BASE_URL}/clase-gratis`,
    type: 'website',
    siteName: 'Luis y Sara Bachatango',
    locale: 'es_ES',
  },
};

export default async function FreeClassPage() {
  const dict = await getDict();
  const c = dict.freeClass;

  const [lesson, course] = await Promise.all([getFreeLesson(), getLandingCourse()]);

  if (!lesson) {
    return (
      <div className={styles.page}>
        <section className={styles.unavailable}>
          <h1 className={styles.title}>{c.title}</h1>
          <p className={styles.lead}>{c.unavailable}</p>
          <Link href="/courses" className={styles.cta}>{c.unavailableCta}</Link>
        </section>
      </div>
    );
  }

  const [playbackToken, thumbnailToken] = await Promise.all([
    signPublicPlaybackToken(lesson.mux_playback_id),
    signPublicThumbnailToken(lesson.mux_playback_id),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{c.eyebrow}</span>
        <h1 className={styles.title}>{c.title}</h1>
        <p className={styles.lead}>{c.lead}</p>
      </header>

      <FreeClassPlayer
        playbackId={lesson.mux_playback_id}
        playbackToken={playbackToken}
        thumbnailToken={thumbnailToken}
        posterUrl={lesson.thumbnail_url}
        title={lesson.title}
      />

      <h2 className={styles.lessonTitle}>{lesson.title}</h2>
      {lesson.description && <p className={styles.lessonDesc}>{lesson.description}</p>}

      <section className={styles.upsell}>
        <h2 className={styles.upsellTitle}>{c.ctaTitle}</h2>
        <p className={styles.upsellBody}>{c.ctaBody}</p>
        {course && <p className={styles.upsellPrice}>{course.price_eur} €</p>}
        <Link href="/curso-bachatango" className={styles.cta}>{c.cta}</Link>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Escribir el CSS de la página**

Crear `app/clase-gratis/page.module.css`:

```css
.page {
  max-width: 60rem;
  margin-inline: auto;
  padding: clamp(5rem, 12vh, 8rem) clamp(1.25rem, 5vw, 3rem) clamp(4rem, 10vh, 6rem);
}

.header {
  text-align: center;
  margin-bottom: clamp(2rem, 5vh, 3rem);
}

.eyebrow {
  display: inline-block;
  font-family: var(--font-sans);
  font-size: 0.7rem;
  letter-spacing: 0.28em;
  color: var(--primary);
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.title {
  font: var(--h1);
  font-size: clamp(2rem, 5vw, 3.25rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-main);
  margin: 0;
}

.lead {
  color: var(--text-muted);
  font-size: clamp(0.98rem, 1.3vw, 1.1rem);
  line-height: 1.6;
  max-width: 46ch;
  margin: 0.85rem auto 0;
}

.lessonTitle {
  font-family: var(--font-serif);
  font-size: clamp(1.3rem, 2.4vw, 1.7rem);
  color: var(--text-main);
  margin: clamp(1.5rem, 4vh, 2.25rem) 0 0;
}

.lessonDesc {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0.6rem 0 0;
  max-width: 60ch;
}

/* ---------- Upsell ---------- */

.upsell {
  margin-top: clamp(3rem, 8vh, 5rem);
  padding: clamp(1.75rem, 4vw, 2.75rem);
  border: 1px solid var(--border-subtle);
  border-radius: 18px;
  background: radial-gradient(ellipse at top, rgba(var(--primary-rgb), 0.08) 0%, transparent 65%);
  text-align: center;
}

.upsellTitle {
  font-family: var(--font-serif);
  font-size: clamp(1.4rem, 2.8vw, 1.9rem);
  color: var(--text-main);
  margin: 0;
}

.upsellBody {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
  max-width: 46ch;
  margin: 0.75rem auto 0;
}

.upsellPrice {
  font-family: var(--font-serif);
  font-size: clamp(2.2rem, 5vw, 3rem);
  color: var(--primary);
  line-height: 1;
  margin: 1.25rem 0 0;
}

.unavailable {
  text-align: center;
  padding-block: clamp(3rem, 10vh, 6rem);
}

/* ---------- CTA ---------- */

.cta {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, #e6c885 100%);
  color: #000;
  padding: 1rem 2.25rem;
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.85rem;
  border-radius: var(--radius-pill);
  text-decoration: none;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
  box-shadow: 0 10px 30px -10px rgba(var(--primary-rgb), 0.5);
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px -12px rgba(var(--primary-rgb), 0.65);
  color: #000;
}

@media (prefers-reduced-motion: reduce) {
  .cta { transition: none; }
  .cta:hover { transform: none; }
}

@media (max-width: 768px) {
  .cta { width: 100%; justify-content: center; }
}
```

- [ ] **Step 8: Comprobar en el navegador**

```bash
npm run dev
```

En incógnito (sin sesión), abrir `http://localhost:3000/clase-gratis`:
- El vídeo carga y **reproduce** sin pedir login.
- Si sale la pantalla de "no disponible", significa que el curso de la landing no tiene ninguna lección con `is_free = true` y `mux_status = 'ready'`. **Márcala en el admin — no cambies el código para sortearlo.**
- El bloque de upsell muestra el precio real y lleva a `/curso-bachatango`.
- El header y el footer globales sí aparecen (esta ruta no es chromeless, a propósito: es una puerta de entrada desde SEO y queremos que se pueda navegar).

- [ ] **Step 9: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 10: Commit**

```bash
git add app/clase-gratis/ components/FreeClassPlayer.tsx utils/i18n/dictionaries/ __tests__/components/free-class-player.test.tsx
git commit -m "feat(free-class): add public /clase-gratis route

Serves one is_free lesson with a short-lived anonymous Mux token, no login.
Closes the gap where both landings promised a free class that always
dead-ended at /login."
```

---

### Task 11: Apuntar todas las promesas de "clase gratis" a la ruta nueva

Tres sitios prometen una clase de muestra y ninguno la entrega. Ahora existe.

**Files:**
- Modify: `components/Hero.tsx:175` (CTA secundario)
- Modify: `app/curso-bachatango/_components/LandingSections.tsx:78`
- Modify: `app/sitemap.ts` (añadir la ruta)
- Test: `__tests__/components/hero-ctas.test.tsx` (ampliar el de la Task 4)

- [ ] **Step 1: Ampliar el test existente**

En `__tests__/components/hero-ctas.test.tsx`, añadir dentro del `describe`:

```tsx
  it('el CTA secundario lleva a la clase gratis', () => {
    render(
      <LanguageProvider initialLocale="es">
        <Hero />
      </LanguageProvider>,
    )
    expect(screen.getByRole('link', { name: /ver clase de muestra/i }))
      .toHaveAttribute('href', '/clase-gratis')
  })
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/hero-ctas.test.tsx`
Expected: FAIL — el href actual es `/courses`

- [ ] **Step 3: Cambiar el CTA secundario del hero**

En `components/Hero.tsx`, línea 175:

```tsx
// antes
<Link href="/courses" className={styles.ctaSecondary}>
// después
<Link href="/clase-gratis" className={styles.ctaSecondary}>
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/hero-ctas.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 5: Arreglar el CTA del funnel**

En `app/curso-bachatango/_components/LandingSections.tsx`, línea 78:

```tsx
// antes
<a href={`/courses/${COURSE_ID}`} className={styles.ctaOutline}>{c.freeClass.cta}</a>
// después
<a href="/clase-gratis" className={styles.ctaOutline}>{c.freeClass.cta}</a>
```

Si `COURSE_ID` deja de usarse en ese fichero, quitar el import que añadiste en la Task 1. Verificar:

```bash
grep -n "COURSE_ID" app/curso-bachatango/_components/LandingSections.tsx
```

- [ ] **Step 6: Añadir la ruta al sitemap**

En `app/sitemap.ts`, dentro de `staticRoutes`, tras la entrada de `/curso-bachatango`:

```ts
    { url: `${BASE_URL}/clase-gratis`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
```

`robots.ts` no necesita cambios: `/clase-gratis` no está en la lista de `disallow` y es indexable a propósito.

- [ ] **Step 7: Comprobar en el navegador**

```bash
npm run dev
```

- Desde `/`: el botón "Ver clase de muestra" del hero abre la clase y reproduce.
- Desde `/curso-bachatango`: el CTA de la sección "Empieza sin riesgo" abre la clase.
- `http://localhost:3000/sitemap.xml` incluye `/clase-gratis`.

- [ ] **Step 8: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 9: Commit**

```bash
git add components/Hero.tsx app/curso-bachatango/_components/LandingSections.tsx app/sitemap.ts __tests__/components/hero-ctas.test.tsx
git commit -m "feat(free-class): point every free-class CTA at /clase-gratis"
```

**Fin de la Fase 3.** Las tres promesas de clase gratis se cumplen. Queda una: la de la newsletter.

---

## FASE 4 — Email de bienvenida y baja de la newsletter

Tres problemas que se arreglan juntos porque tocan la misma tabla y el mismo server action:
1. El copy promete "una clase gratuita al suscribirte" y no se manda ningún email.
2. No hay ruta de baja, aunque la columna `unsubscribed_at` existe desde la migración de mayo.
3. No se guarda prueba del consentimiento (IP, fecha, versión del texto) — RGPD art. 7.1.

### Task 12: Migración SQL de consentimiento y token de baja

**Files:**
- Create: `supabase/2026_08_newsletter_consent.sql`
- Create: `utils/newsletter/unsubscribe-token.ts`
- Modify: `supabase/MIGRATIONS.md` (registrar la migración nueva)
- Modify: `CLAUDE.md` (documentar `NEWSLETTER_UNSUBSCRIBE_SECRET`)
- Test: `__tests__/utils/unsubscribe-token.test.ts`

**Interfaces:**
- Produces:
  - `export function makeUnsubscribeToken(email: string): string | null`
  - `export function verifyUnsubscribeToken(email: string, token: string): boolean`
- Variable de entorno nueva: `NEWSLETTER_UNSUBSCRIBE_SECRET` (fail-closed: sin ella no se generan ni se aceptan tokens, y el email no se envía)

- [ ] **Step 1: Escribir la migración**

Crear `supabase/2026_08_newsletter_consent.sql`:

```sql
-- Newsletter: prueba de consentimiento (RGPD art. 7.1) y soporte de baja.
-- Idempotente: se puede reejecutar sin daño.

alter table public.newsletter_subscribers
  add column if not exists consent_ip text,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_source text;

-- Backfill: las filas existentes se suscribieron sin registro de prueba.
-- Se sella su consent_at con la fecha de alta y se marca el origen como
-- 'legacy' para poder distinguirlas en una auditoría.
update public.newsletter_subscribers
   set consent_at = coalesce(consent_at, subscribed_at),
       consent_source = coalesce(consent_source, 'legacy')
 where consent_source is null;

-- Las bajas se consultan por email en cada intento de alta.
create index if not exists newsletter_subscribers_unsubscribed_idx
  on public.newsletter_subscribers (unsubscribed_at)
  where unsubscribed_at is not null;
```

> **Aviso:** ejecutar esta migración contra producción es una acción sobre datos reales. Antes de aplicarla, confirma que hay backup reciente (Supabase Dashboard → Database → Backups). El `update` de backfill toca todas las filas sin `consent_source`, pero solo rellena columnas nuevas — no borra ni modifica ningún dato existente.

Aplicarla desde el SQL Editor de Supabase, y añadir una línea a `supabase/MIGRATIONS.md` en su tabla de orden de aplicación, indicando que es aditiva y segura de reejecutar.

- [ ] **Step 2: Escribir el test del token**

Crear `__tests__/utils/unsubscribe-token.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeUnsubscribeToken, verifyUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

const OLD = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET

describe('unsubscribe token', () => {
  beforeEach(() => { process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-secret' })
  afterEach(() => { process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = OLD })

  it('un token recién creado se verifica', () => {
    const tok = makeUnsubscribeToken('a@b.com')!
    expect(verifyUnsubscribeToken('a@b.com', tok)).toBe(true)
  })

  it('el token de un email no sirve para otro', () => {
    const tok = makeUnsubscribeToken('a@b.com')!
    expect(verifyUnsubscribeToken('otro@b.com', tok)).toBe(false)
  })

  it('rechaza un token manipulado', () => {
    expect(verifyUnsubscribeToken('a@b.com', 'deadbeef')).toBe(false)
  })

  it('rechaza un token vacío', () => {
    expect(verifyUnsubscribeToken('a@b.com', '')).toBe(false)
  })

  it('normaliza el email antes de firmar', () => {
    const tok = makeUnsubscribeToken('A@B.com')!
    expect(verifyUnsubscribeToken('a@b.com', tok)).toBe(true)
  })

  it('fail-closed sin secreto configurado', () => {
    delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
    expect(makeUnsubscribeToken('a@b.com')).toBeNull()
    expect(verifyUnsubscribeToken('a@b.com', 'cualquiera')).toBe(false)
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/utils/unsubscribe-token.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/newsletter/unsubscribe-token"`

- [ ] **Step 4: Escribir el módulo del token**

Crear `utils/newsletter/unsubscribe-token.ts`:

```ts
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token HMAC para el enlace de baja de la newsletter. Va en la URL del email,
 * así que debe poder verificarse sin sesión: quien se da de baja normalmente
 * no tiene cuenta.
 *
 * Sin caducidad a propósito — un enlace de baja que expira es un enlace de
 * baja roto, y el RGPD art. 7.3 exige que retirar el consentimiento sea tan
 * fácil como darlo.
 *
 * Fail-closed: sin NEWSLETTER_UNSUBSCRIBE_SECRET no se firma ni se acepta nada.
 */
function secret(): string | null {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || null
}

function normalise(email: string): string {
  return email.trim().toLowerCase()
}

export function makeUnsubscribeToken(email: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(normalise(email)).digest('hex')
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = makeUnsubscribeToken(email)
  if (!expected || !token) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(token, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/utils/unsubscribe-token.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Documentar la variable de entorno**

En `CLAUDE.md`, en el bloque de variables de entorno:

```
NEWSLETTER_UNSUBSCRIBE_SECRET  # HMAC key para los enlaces de baja de la newsletter. Fail-closed: si falta, no se envía el email de bienvenida (porque no podría llevar enlace de baja) y /unsubscribe rechaza cualquier token.
```

Generar un valor y darlo de alta:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
vercel env add NEWSLETTER_UNSUBSCRIBE_SECRET production
```

Y en `vitest.setup.ts`, junto a las demás env de test:

```ts
process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret'
```

- [ ] **Step 7: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde

- [ ] **Step 8: Commit**

```bash
git add supabase/2026_08_newsletter_consent.sql supabase/MIGRATIONS.md utils/newsletter/unsubscribe-token.ts __tests__/utils/unsubscribe-token.test.ts CLAUDE.md vitest.setup.ts
git commit -m "feat(newsletter): add consent-proof columns and unsubscribe token

GDPR art. 7.1 needs evidence of when and how consent was given; art. 7.3
needs withdrawal to be as easy as giving it. Neither existed."
```

---

### Task 13: Email de bienvenida y `subscribeNewsletter` reescrito

El action actual (`app/actions/newsletter.ts`) tiene tres fallos: no manda email, no registra prueba de consentimiento, y con `ignoreDuplicates: true` una persona que se dio de baja y vuelve a suscribirse recibe `success` pero sigue de baja.

**Files:**
- Create: `utils/email/newsletter-welcome.ts`
- Modify: `app/actions/newsletter.ts` (fichero completo)
- Modify: `__tests__/actions/newsletter.test.ts` (fichero completo)

**Interfaces:**
- Consumes: `makeUnsubscribeToken()` (Task 12), patrón de Resend de `utils/email/purchase-confirmation.ts`
- Produces: `export async function sendNewsletterWelcome(opts: { email: string }): Promise<void>`
- `subscribeNewsletter(formData)` mantiene su firma: `Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: Escribir el email de bienvenida**

Crear `utils/email/newsletter-welcome.ts`, siguiendo el patrón de `purchase-confirmation.ts` (mismo `FROM`, mismo `esc`, mismo "nunca lanza"):

```ts
import 'server-only'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

const FROM = 'Luis y Sara Bachatango <noreply@luisysarabachatango.com>'
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/**
 * Email de bienvenida. Entrega la clase gratis que promete el copy de la
 * newsletter e incluye el enlace de baja obligatorio (LSSI art. 21).
 *
 * Nunca lanza: un fallo de email no puede tumbar la suscripción, que ya está
 * comprometida en base de datos. No-op si falta RESEND_API_KEY.
 *
 * No-op también si falta NEWSLETTER_UNSUBSCRIBE_SECRET: sin enlace de baja no
 * se puede enviar comunicación comercial legalmente, así que es preferible no
 * enviar nada que enviar un email no conforme.
 */
export async function sendNewsletterWelcome(opts: { email: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const token = makeUnsubscribeToken(opts.email)
  if (!token) {
    console.error('[newsletter-welcome] NEWSLETTER_UNSUBSCRIBE_SECRET unset, refusing to send')
    return
  }

  const unsubUrl = `${BASE}/unsubscribe?email=${encodeURIComponent(opts.email)}&token=${token}`
  const html = `
    <h2>Bienvenido/a a la comunidad 💃🕺</h2>
    <p>Gracias por suscribirte. Como te prometimos, aquí tienes una clase completa del curso, gratis y sin condiciones:</p>
    <p><a href="${BASE}/clase-gratis">Ver la clase gratis</a></p>
    <p>De vez en cuando te escribiremos con consejos de técnica, novedades y fechas de talleres. Nada más.</p>
    <hr>
    <p style="font-size:12px;color:#888">
      Si no quieres volver a recibir nuestros emails,
      <a href="${esc(unsubUrl)}">date de baja aquí</a>.
    </p>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [opts.email],
        subject: 'Tu clase gratis de Bachatango',
        html,
      }),
    })
    if (!res.ok) {
      console.error('[newsletter-welcome] resend failed', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('[newsletter-welcome] resend threw', e)
  }
}
```

- [ ] **Step 2: Reescribir el test del action**

Reemplazar `__tests__/actions/newsletter.test.ts` entero. Los mocks cambian porque el action pasa de `.upsert()` a `.upsert().select()` y llama al email:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertSelectMock = vi.fn()
const upsertMock = vi.fn(() => ({ select: upsertSelectMock }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '127.0.0.1' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const sendWelcomeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utils/email/newsletter-welcome', () => ({
  sendNewsletterWelcome: (o: unknown) => sendWelcomeMock(o),
}))

import { subscribeNewsletter } from '@/app/actions/newsletter'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('subscribeNewsletter', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    upsertSelectMock.mockReset()
    sendWelcomeMock.mockClear()
    upsertSelectMock.mockResolvedValue({ data: [{ email: 'a@b.com' }], error: null })
  })

  it('rechaza email inválido', async () => {
    expect(await subscribeNewsletter(fd({ email: 'no' }))).toEqual({ error: 'invalid_email' })
  })

  it('rechaza email vacío', async () => {
    expect(await subscribeNewsletter(fd({ email: '' }))).toEqual({ error: 'invalid_email' })
  })

  it('normaliza a minúsculas y guarda prueba de consentimiento', async () => {
    await subscribeNewsletter(fd({ email: 'UPPER@CASE.COM' }))
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'upper@case.com',
        consent_ip: '127.0.0.1',
        consent_source: 'newsletter_form',
        unsubscribed_at: null,
      }),
      expect.objectContaining({ onConflict: 'email' }),
    )
  })

  it('reactiva a quien se había dado de baja', async () => {
    await subscribeNewsletter(fd({ email: 'a@b.com' }))
    const payload = upsertMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.unsubscribed_at).toBeNull()
    const opts = upsertMock.mock.calls[0][1] as Record<string, unknown>
    expect(opts.ignoreDuplicates).not.toBe(true)
  })

  it('envía el email de bienvenida al suscribirse', async () => {
    await subscribeNewsletter(fd({ email: 'a@b.com' }))
    expect(sendWelcomeMock).toHaveBeenCalledWith({ email: 'a@b.com' })
  })

  it('devuelve server_error si la BD falla y no envía email', async () => {
    upsertSelectMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'db error' } })
    expect(await subscribeNewsletter(fd({ email: 'a@b.com' }))).toEqual({ error: 'server_error' })
    expect(sendWelcomeMock).not.toHaveBeenCalled()
  })

  it('devuelve success aunque el email falle', async () => {
    sendWelcomeMock.mockRejectedValueOnce(new Error('resend down'))
    expect(await subscribeNewsletter(fd({ email: 'a@b.com' }))).toEqual({ success: true })
  })

  it('devuelve rate_limit cuando el limitador deniega', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    expect(await subscribeNewsletter(fd({ email: 'a@b.com' }))).toEqual({ error: 'rate_limit' })
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/actions/newsletter.test.ts`
Expected: FAIL — el action actual no llama a `.select()`, no guarda `consent_ip` y no envía email

- [ ] **Step 4: Reescribir el action**

Reemplazar `app/actions/newsletter.ts` entero:

```ts
'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { sendNewsletterWelcome } from '@/utils/email/newsletter-welcome'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function subscribeNewsletter(formData: FormData): Promise<{ success: true } | { error: string }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'newsletter']), 5, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'rate_limit' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email' }

  const now = new Date().toISOString()

  // Sin `ignoreDuplicates`: quien se dio de baja y vuelve debe reactivarse.
  // Antes, ese caso devolvía `success` pero dejaba `unsubscribed_at` puesto,
  // así que la persona nunca volvía a recibir nada.
  const { error } = await adminClient()
    .from('newsletter_subscribers')
    .upsert(
      {
        email,
        consent_ip: ip,
        consent_at: now,
        consent_source: 'newsletter_form',
        unsubscribed_at: null,
      },
      { onConflict: 'email' }
    )
    .select('email')

  if (error) {
    console.error('[subscribeNewsletter] db error', { code: error.code, message: error.message })
    return { error: 'server_error' }
  }

  // El email nunca puede tumbar la suscripción: ya está comprometida en BD.
  try {
    await sendNewsletterWelcome({ email })
  } catch (e) {
    console.error('[subscribeNewsletter] welcome email failed', e)
  }

  return { success: true }
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/actions/newsletter.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 6: Comprobar la política RLS de UPDATE**

El action ahora hace un `upsert` que puede **actualizar** filas (antes solo insertaba). La migración de mayo creó una política `"newsletter service UPDATE only"`, así que debería valer. Confirmar:

```bash
grep -n -A 4 "newsletter service UPDATE only" supabase/2026_05_audit4_contact_newsletter_tables.sql
```

Como el action usa el service role, salta la RLS de todos modos — pero conviene que la política exista por coherencia con el resto del esquema.

- [ ] **Step 7: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde

- [ ] **Step 8: Commit**

```bash
git add utils/email/newsletter-welcome.ts app/actions/newsletter.ts __tests__/actions/newsletter.test.ts
git commit -m "feat(newsletter): send welcome email and record consent proof

The copy promised a free class on signup and nothing was ever sent. Also
fixes resubscription: ignoreDuplicates meant an unsubscribed address got a
success response but stayed unsubscribed forever."
```

---

### Task 14: Ruta `/unsubscribe`

**Files:**
- Create: `app/unsubscribe/page.tsx`
- Create: `app/unsubscribe/actions.ts`
- Create: `app/unsubscribe/page.module.css`
- Modify: `app/robots.ts` (excluir del índice)
- Test: `__tests__/actions/unsubscribe.test.ts`

**Interfaces:**
- Consumes: `verifyUnsubscribeToken()` (Task 12)
- Produces: `export async function unsubscribeByToken(email: string, token: string): Promise<{ ok: true } | { error: 'invalid' | 'server_error' }>`

Diseño: la baja se ejecuta desde un `<form>` con botón, **no** al abrir el enlace. Los escáneres de enlaces de Outlook y Gmail visitan las URLs de los emails automáticamente; una baja por GET se dispararía sola.

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/actions/unsubscribe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const eqMock = vi.fn()
const updateMock = vi.fn(() => ({ eq: eqMock }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ update: updateMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))
vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '127.0.0.1' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import { unsubscribeByToken } from '@/app/unsubscribe/actions'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

describe('unsubscribeByToken', () => {
  beforeEach(() => {
    updateMock.mockClear()
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
  })

  it('da de baja con un token válido', async () => {
    const token = makeUnsubscribeToken('a@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribed_at: expect.any(String) }),
    )
    expect(eqMock).toHaveBeenCalledWith('email', 'a@b.com')
  })

  it('rechaza un token inválido sin tocar la BD', async () => {
    expect(await unsubscribeByToken('a@b.com', 'malo')).toEqual({ error: 'invalid' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rechaza el token de otro email', async () => {
    const token = makeUnsubscribeToken('otro@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ error: 'invalid' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rechaza un email con formato inválido', async () => {
    expect(await unsubscribeByToken('no-es-email', 'x')).toEqual({ error: 'invalid' })
  })

  it('devuelve server_error si la BD falla', async () => {
    eqMock.mockResolvedValue({ error: { message: 'boom' } })
    const token = makeUnsubscribeToken('a@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ error: 'server_error' })
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/actions/unsubscribe.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/unsubscribe/actions"`

- [ ] **Step 3: Escribir el action**

Crear `app/unsubscribe/actions.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { verifyUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Marca una dirección como dada de baja. Se autentica con el HMAC del enlace
 * del email, no con sesión: quien se da de baja normalmente no tiene cuenta.
 *
 * Idempotente: darse de baja dos veces sobreescribe la fecha y devuelve ok.
 */
export async function unsubscribeByToken(
  email: string,
  token: string,
): Promise<{ ok: true } | { error: 'invalid' | 'server_error' }> {
  const normalised = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalised)) return { error: 'invalid' }

  const h = await headers()
  const rl = await rateLimit(rateLimitKey([getClientIp(h), 'unsubscribe']), 20, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'invalid' }

  if (!verifyUnsubscribeToken(normalised, token)) return { error: 'invalid' }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', normalised)

  if (error) {
    console.error('[unsubscribe] db error', { message: error.message })
    return { error: 'server_error' }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/actions/unsubscribe.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Escribir la página**

Crear `app/unsubscribe/page.tsx`. Copy en español fijo — es una página transaccional a la que se llega desde un email en español:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import UnsubscribeForm from './UnsubscribeForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Darse de baja',
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage(
  props: { searchParams: Promise<{ email?: string; token?: string }> },
) {
  const { email, token } = await props.searchParams;

  if (!email || !token) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Enlace no válido</h1>
        <p className={styles.body}>
          Este enlace de baja está incompleto. Escríbenos a{' '}
          <a href="mailto:contacto@luisysarabachatango.com">contacto@luisysarabachatango.com</a>{' '}
          y te damos de baja a mano.
        </p>
        <Link href="/" className={styles.link}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>¿Darte de baja?</h1>
      <p className={styles.body}>
        Dejarás de recibir nuestros emails en <strong>{email}</strong>.
        Podrás volver a suscribirte cuando quieras desde la web.
      </p>
      <UnsubscribeForm email={email} token={token} />
    </div>
  );
}
```

Crear `app/unsubscribe/UnsubscribeForm.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { unsubscribeByToken } from './actions';
import styles from './page.module.css';

export default function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'invalid' | 'error'>('idle');

  // Baja por POST, nunca al abrir el enlace: los escáneres de enlaces de
  // Outlook y Gmail visitan las URLs de los emails automáticamente, y una
  // baja por GET se dispararía sola sin que nadie hiciera clic.
  function handle() {
    startTransition(async () => {
      const r = await unsubscribeByToken(email, token);
      if ('ok' in r) setStatus('ok');
      else setStatus(r.error === 'invalid' ? 'invalid' : 'error');
    });
  }

  if (status === 'ok') {
    return (
      <div>
        <p className={styles.success} role="status">
          Listo. No volverás a recibir nuestros emails.
        </p>
        <Link href="/" className={styles.link}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className={styles.button} onClick={handle} disabled={isPending}>
        {isPending ? 'Procesando...' : 'Confirmar baja'}
      </button>
      {status === 'invalid' && (
        <p className={styles.error} role="alert">
          El enlace no es válido o ha sido modificado. Escríbenos a
          contacto@luisysarabachatango.com y te damos de baja a mano.
        </p>
      )}
      {status === 'error' && (
        <p className={styles.error} role="alert">
          No hemos podido procesarlo. Inténtalo de nuevo en unos minutos.
        </p>
      )}
      <Link href="/" className={styles.link}>Cancelar</Link>
    </div>
  );
}
```

- [ ] **Step 6: Escribir el CSS**

Crear `app/unsubscribe/page.module.css`:

```css
.page {
  max-width: 34rem;
  margin-inline: auto;
  padding: clamp(6rem, 16vh, 10rem) 1.5rem 6rem;
  text-align: center;
}

.title {
  font-family: var(--font-serif);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  color: var(--text-main);
  margin: 0 0 0.9rem;
}

.body {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.65;
  margin: 0;
}

.button {
  margin-top: 1.75rem;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.85rem 2rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.button:disabled {
  opacity: 0.6;
  cursor: default;
}

.success {
  color: var(--text-main);
  font-size: 0.95rem;
  margin: 1.5rem 0 0;
}

.error {
  color: #e88;
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 1rem 0 0;
}

.link {
  display: inline-block;
  margin-top: 1.5rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.link:hover {
  color: var(--primary);
}
```

- [ ] **Step 7: Excluir del índice**

En `app/robots.ts`, añadir a la lista `disallow`:

```ts
          '/unsubscribe',
```

- [ ] **Step 8: Probar el circuito completo**

```bash
npm run dev
```

Con `RESEND_API_KEY` y `NEWSLETTER_UNSUBSCRIBE_SECRET` en `.env.local`:
1. Suscribirse desde la home con una dirección real.
2. Llega el email de bienvenida con el enlace a la clase gratis y el de baja.
3. El enlace de la clase gratis abre `/clase-gratis` y reproduce.
4. El enlace de baja abre la página con el email visible y **no** da de baja solo.
5. Pulsar "Confirmar baja" → mensaje de éxito. Comprobar `unsubscribed_at` en Supabase.
6. Volver a suscribirse con el mismo email → `unsubscribed_at` vuelve a `null`.

- [ ] **Step 9: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 10: Commit**

```bash
git add app/unsubscribe/ app/robots.ts __tests__/actions/unsubscribe.test.ts
git commit -m "feat(newsletter): add /unsubscribe route

HMAC-authenticated, POST-confirmed so email link scanners cannot trigger it.
The unsubscribed_at column has existed since May with no route to set it."
```

**Fin de la Fase 4.** La newsletter cumple lo que promete y es legal.

---

## FASE 5 — SEO y copy

### Task 15: Imágenes Open Graph generadas

`app/layout.tsx:39-46` declara `/luis-sara-about.jpg` como 1200×630, pero el archivo real es 682×1024 — retrato. WhatsApp, Facebook y Twitter recortan mal o descartan la imagen. Lo mismo en `app/curso-bachatango/page.tsx:21`.

En lugar de pedir un archivo nuevo al diseñador, las generamos con `next/og`: sin binarios que mantener y el título siempre cuadra con la página.

**Files:**
- Create: `app/opengraph-image.tsx`
- Create: `app/curso-bachatango/opengraph-image.tsx`
- Modify: `app/layout.tsx:39-53` (quitar `images` de `openGraph` y `twitter`)
- Modify: `app/curso-bachatango/page.tsx:16-30` (íd.)

Nota: cuando existe `opengraph-image.tsx` en un segmento, Next inyecta las etiquetas `og:image` y `twitter:image` automáticamente con las dimensiones correctas. Dejar además un `images:` manual en el objeto `metadata` produciría **dos** etiquetas y los scrapers elegirían una al azar — por eso hay que quitarlas.

- [ ] **Step 1: Crear la OG image de la home**

Crear `app/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og';

export const alt = 'Luis y Sara Bachatango — Cursos online de Bachata y Bachatango';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
          <div style={{ display: 'flex' }}>+25 AÑOS</div>
          <div style={{ display: 'flex' }}>+500 ALUMNOS</div>
          <div style={{ display: 'flex' }}>+30 PAÍSES</div>
        </div>
      </div>
    ),
    size,
  );
}
```

Ojo: `next/og` (Satori) exige `display: flex` explícito en cualquier elemento con más de un hijo, y no soporta `gap` sin flex. Los estilos de arriba ya cumplen. Si añades elementos, aplica la misma regla.

- [ ] **Step 2: Crear la OG image del funnel**

Crear `app/curso-bachatango/opengraph-image.tsx`. Mismo lenguaje visual, mensaje de venta:

```tsx
import { ImageResponse } from 'next/og';

export const alt = 'Curso de Bachatango online — Luis y Sara';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
```

No incluimos el precio: la imagen se cachea y quedaría desincronizada del valor real en cuanto cambie.

- [ ] **Step 3: Quitar las `images` manuales del layout**

En `app/layout.tsx`, en `openGraph` borrar el bloque `images: [...]` completo (líneas 39-46) y en `twitter` borrar la línea `images: [...]` (línea 52). El resto de ambos objetos se queda igual.

- [ ] **Step 4: Quitar las `images` manuales del funnel**

En `app/curso-bachatango/page.tsx`, borrar `images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630 }],` de `openGraph` (línea 21) y `images: ['/luis-sara-about.jpg'],` de `twitter` (línea 29).

- [ ] **Step 5: Comprobar que se generan**

```bash
npm run dev
```

Abrir directamente:
- `http://localhost:3000/opengraph-image` → PNG 1200×630
- `http://localhost:3000/curso-bachatango/opengraph-image` → PNG 1200×630

Y comprobar que el HTML de `/` tiene **una sola** etiqueta `og:image`:

```bash
curl -s http://localhost:3000 | grep -o 'og:image[^>]*'
```

Expected: una línea, apuntando a `/opengraph-image`, con `og:image:width` 1200 y `og:image:height` 630.

- [ ] **Step 6: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde. El `build` importa: `next/og` falla en build si Satori encuentra un elemento sin `display` explícito.

- [ ] **Step 7: Commit**

```bash
git add app/opengraph-image.tsx app/curso-bachatango/opengraph-image.tsx app/layout.tsx app/curso-bachatango/page.tsx
git commit -m "fix(seo): generate 1200x630 OG images instead of mislabelling a portrait photo

luis-sara-about.jpg is 682x1024 but was declared as 1200x630, so link
previews cropped it badly. Generated images always match the declared size."
```

---

### Task 16: FAQPage JSON-LD y `sameAs` completo

**Files:**
- Create: `utils/seo/faq-jsonld.ts`
- Modify: `app/page.tsx` (inyectar el JSON-LD)
- Modify: `app/layout.tsx:109-111` (`sameAs`)
- Test: `__tests__/utils/faq-jsonld.test.ts`

**Interfaces:**
- Produces: `export function buildFaqJsonLd(faqs: Array<{ q: string; a: string }>): object`

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/utils/faq-jsonld.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFaqJsonLd } from '@/utils/seo/faq-jsonld'

describe('buildFaqJsonLd', () => {
  it('produce un FAQPage con una entrada por pregunta', () => {
    const out = buildFaqJsonLd([
      { q: '¿Pregunta uno?', a: 'Respuesta uno.' },
      { q: '¿Pregunta dos?', a: 'Respuesta dos.' },
    ]) as Record<string, unknown>

    expect(out['@type']).toBe('FAQPage')
    expect(out['@context']).toBe('https://schema.org')
    const entities = out.mainEntity as Array<Record<string, unknown>>
    expect(entities).toHaveLength(2)
    expect(entities[0]).toEqual({
      '@type': 'Question',
      name: '¿Pregunta uno?',
      acceptedAnswer: { '@type': 'Answer', text: 'Respuesta uno.' },
    })
  })

  it('descarta entradas con pregunta o respuesta vacías', () => {
    const out = buildFaqJsonLd([
      { q: '¿Válida?', a: 'Sí.' },
      { q: '', a: 'Huérfana.' },
      { q: '¿Sin respuesta?', a: '   ' },
    ]) as Record<string, unknown>
    expect(out.mainEntity as unknown[]).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/utils/faq-jsonld.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/seo/faq-jsonld"`

- [ ] **Step 3: Escribir el módulo**

Crear `utils/seo/faq-jsonld.ts`:

```ts
/**
 * Construye el JSON-LD de tipo FAQPage a partir de las preguntas ya visibles
 * en la página. Google exige que el marcado refleje contenido realmente
 * visible: por eso se alimenta del mismo diccionario que renderiza el FAQ,
 * nunca de una lista aparte que pudiera divergir.
 *
 * Las entradas incompletas se descartan: un `Question` sin `acceptedAnswer`
 * invalida el bloque entero en Search Console.
 */
export function buildFaqJsonLd(faqs: Array<{ q: string; a: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
      .filter((f) => f.q.trim().length > 0 && f.a.trim().length > 0)
      .map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
  }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/utils/faq-jsonld.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Inyectarlo en la home**

En `app/page.tsx`, añadir imports:

```tsx
import { getDict } from "@/utils/get-dict";
import { buildFaqJsonLd } from "@/utils/seo/faq-jsonld";
import { safeJsonLd } from "@/utils/jsonld";
```

Dentro de `Home()`, tras leer el curso:

```tsx
  const dict = await getDict();
  const faqJsonLd = buildFaqJsonLd([
    { q: dict.faq.q1.q, a: dict.faq.q1.a },
    { q: dict.faq.q2.q, a: dict.faq.q2.a },
    { q: dict.faq.q3.q, a: dict.faq.q3.a },
  ]);
```

Y como primer hijo del `<div className={styles.container}>`:

```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
```

`safeJsonLd` es el mismo helper que ya usan `layout.tsx` y el funnel — escapa el contenido antes de inyectarlo, así que no abre un hueco de XSS aunque el copy venga del diccionario.

- [ ] **Step 6: Completar `sameAs`**

En `app/layout.tsx`, líneas 109-111, sustituir el array por los cuatro perfiles que ya enlaza el footer:

```tsx
    sameAs: [
      'https://www.instagram.com/luisysaradance',
      'https://www.facebook.com/luisysaradance',
      'https://www.tiktok.com/@luisysaradance',
      'https://www.youtube.com/@luisysaradance',
    ],
```

> **Verificar antes de commitear:** estas cuatro URLs deben ser los perfiles reales. `sameAs` con un perfil que no existe o que no pertenece a la marca perjudica el Knowledge Graph. Ábrelas una a una en el navegador; si alguna da 404 o pertenece a otra cuenta, quítala de la lista en vez de inventar la correcta.

- [ ] **Step 7: Validar el marcado**

```bash
npm run dev
curl -s http://localhost:3000 | grep -c 'application/ld+json'
```
Expected: `2` (Organization desde el layout + FAQPage desde la página)

Después, pegar el HTML de `/` en el Rich Results Test de Google (search.google.com/test/rich-results) y confirmar que detecta "Preguntas frecuentes" sin errores.

- [ ] **Step 8: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 9: Commit**

```bash
git add utils/seo/faq-jsonld.ts app/page.tsx app/layout.tsx __tests__/utils/faq-jsonld.test.ts
git commit -m "feat(seo): add FAQPage JSON-LD and complete sameAs profiles"
```

---

### Task 17: Arreglar el copy incoherente

Dos problemas de credibilidad, ambos de copy puro:
1. La respuesta a la primera pregunta del FAQ no responde a la pregunta, en los 6 idiomas.
2. El hero dice `+50 PAÍSES`; `/sobre-nosotros` dice `30+`. Uno de los dos miente.

**Files:**
- Modify: los 6 ficheros de `utils/i18n/dictionaries/` (`faq.q1.a`)
- Modify: `components/Hero.tsx:10-14` (`STATS`)

- [ ] **Step 1: Corregir la respuesta del FAQ en los 6 idiomas**

La pregunta es "¿Necesito tener experiencia previa en baile?" y la respuesta actual, "Conceptos básicos de bachata o tango.", no la responde: parece una nota interna que se quedó en el fichero.

`es.ts` (`faq.q1.a`):
```ts
      a: "No hace falta. El curso empieza desde cero y avanza paso a paso. Si ya bailas bachata o tango partirás con ventaja, pero no es un requisito: lo que damos por hecho es que quieres aprender."
```
`en.ts`:
```ts
      a: "No. The course starts from scratch and builds up step by step. If you already dance bachata or tango you will have a head start, but it is not a requirement — all we assume is that you want to learn."
```
`fr.ts`:
```ts
      a: "Non. Le cours part de zéro et progresse pas à pas. Si vous dansez déjà la bachata ou le tango, vous aurez une longueur d'avance, mais ce n'est pas obligatoire : la seule chose que nous supposons, c'est votre envie d'apprendre."
```
`de.ts`:
```ts
      a: "Nein. Der Kurs beginnt bei null und baut Schritt für Schritt auf. Wenn du schon Bachata oder Tango tanzt, hast du einen Vorsprung, aber Voraussetzung ist es nicht — wir setzen nur voraus, dass du lernen willst."
```
`it.ts`:
```ts
      a: "No. Il corso parte da zero e procede passo dopo passo. Se balli già bachata o tango partirai avvantaggiato, ma non è un requisito: l'unica cosa che diamo per scontata è la voglia di imparare."
```
`ja.ts`:
```ts
      a: "必要ありません。コースはゼロから始まり、一歩ずつ進みます。バチャータやタンゴの経験があれば有利ですが、必須ではありません。前提となるのは、学びたいという気持ちだけです。"
```

Ojo con la estructura: en `fr.ts` el FAQ está en una sola línea por pregunta (`q1: { q: "...", a: "..." },`), mientras que en `es.ts` y `en.ts` está en varias líneas. Respeta el formato de cada fichero.

- [ ] **Step 2: Verificar la paridad**

Run: `npx tsc --noEmit && npm run i18n:check`
Expected: limpio

- [ ] **Step 3: Reconciliar la cifra de países**

Decidir cuál es la cifra real. `app/sobre-nosotros/AboutClient.tsx:20` dice `30+` y el hero dice `+50`. **Pregunta a Luis y Sara cuál es la buena** — no elijas tú. Con la respuesta, alinea ambos sitios.

Asumiendo que la buena es 30 (la de la página "Sobre nosotros", más detallada y con cuatro métricas), en `components/Hero.tsx` líneas 10-14:

```tsx
const STATS = [
  { value: '+25', labelKey: 'years' },
  { value: '+500', labelKey: 'students' },
  { value: '+30', labelKey: 'countries' },
] as const;
```

Si además cambia, actualizar el `+30 PAÍSES` de `app/opengraph-image.tsx` (Task 15) para que coincida.

- [ ] **Step 4: Comprobar que no quedan cifras sueltas**

```bash
grep -rn "+50\|'50'\|+25\|'25'\|+500\|'500'" components/Hero.tsx app/sobre-nosotros/AboutClient.tsx app/opengraph-image.tsx
```

Las tres cifras deben coincidir en los tres ficheros. Comprobar también que `about.bio4` ("más de 300 alumnos", `es.ts:151`) se refiere a la escuela presencial y no al total online — si genera confusión, matizar el texto para que quede claro que son cosas distintas.

- [ ] **Step 5: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 6: Commit**

```bash
git add utils/i18n/dictionaries/ components/Hero.tsx app/opengraph-image.tsx
git commit -m "fix(copy): answer the first FAQ question and reconcile country count

faq.q1.a read 'Basic concepts of bachata or tango' — a fragment, not an
answer to 'do I need previous experience'. Hero said +50 countries while the
about page said 30+."
```

**Fin de la Fase 5.**

---

## FASE 6 — Limpieza y LCP

### Task 18: Quitar el vídeo muerto del hero y optimizar el LCP

`components/Hero.tsx:66-76` renderiza un `<video>` **sin ningún `<source>`** — no hay ningún `.mp4` ni `.webm` en `public/`. Además `.bgVideo` tiene `opacity: 0` y la clase `.bgVideoVisible` no se aplica nunca. Lo que se ve de fondo es el `background-image` de `.bgLayer`. Todo lo relacionado con el vídeo es código muerto.

Y ese fondo, al ser una `background-image` de CSS, no se precarga ni se redimensiona: es el elemento LCP y llega tarde.

**Files:**
- Modify: `components/Hero.tsx` (quitar el vídeo, meter `next/image`)
- Modify: `components/Hero.module.css` (borrar `.bgVideo`, `.bgVideoVisible`; ajustar `.bgLayer`)
- Test: `__tests__/components/hero-ctas.test.tsx` (ampliar)

- [ ] **Step 1: Ampliar el test**

En `__tests__/components/hero-ctas.test.tsx`, añadir dentro del `describe`:

```tsx
  it('no renderiza un elemento video sin fuentes', () => {
    const { container } = render(
      <LanguageProvider initialLocale="es">
        <Hero />
      </LanguageProvider>,
    )
    expect(container.querySelector('video')).toBeNull()
  })
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/hero-ctas.test.tsx`
Expected: FAIL — el `<video>` sigue en el DOM

- [ ] **Step 3: Reemplazar la capa de fondo en el componente**

En `components/Hero.tsx`:

Quitar `useEffect` y `useRef` del import de React (siguen usándose otros hooks, comprobar antes de borrar la línea entera):

```tsx
// antes
import { useEffect, useRef } from 'react';
// después — si ya no queda ningún hook de React en uso, borra la línea completa
```

Añadir el import de `next/image` junto a los demás:

```tsx
import Image from 'next/image';
```

Borrar el bloque `useEffect` de las líneas 23-27 (el que pausaba el vídeo) y la declaración `const videoRef = ...` de la línea 21.

Sustituir el bloque `bgLayer` de las líneas 65-80 por:

```tsx
      {/* Capa de fondo: imagen optimizada + gradiente cinemático */}
      <div className={styles.bgLayer} aria-hidden="true">
        <Image
          src="/hero-bg.webp"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={72}
          className={styles.bgImage}
        />
        <div className={styles.bgOverlay} />
        <div className={styles.bgVignette} />
      </div>
```

`priority` añade el `<link rel="preload">` que hoy no existe, y `next/image` sirve AVIF/WebP al tamaño del viewport en lugar del fichero completo a todo el mundo.

- [ ] **Step 4: Actualizar el CSS**

En `components/Hero.module.css`:

Sustituir `.bgLayer` (líneas 16-24) — ya no necesita `background-image`, la pinta `next/image`:

```css
.bgLayer {
  position: absolute;
  inset: 0;
  z-index: -2;
  background-color: #000;
  overflow: hidden;
}
```

Borrar los bloques `.bgVideo` (líneas 26-38) y `.bgVideoVisible` (líneas 40-42) enteros, y añadir en su lugar:

```css
.bgImage {
  object-fit: cover;
  object-position: center 20%;
  filter: saturate(1.05) contrast(1.05);
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/hero-ctas.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Medir el LCP**

```bash
npm run build && npm start
```

Con Chrome en incógnito, DevTools → Lighthouse → Performance, modo móvil, sobre `http://localhost:3000`:
- Anotar el LCP. La referencia anterior es 12,8 s (`docs/lighthouse-2026-05-results.md`), medida con el poster de 1,9 MB.
- En la pestaña Network, comprobar que `hero-bg` llega ya como `/_next/image?...` y no como el `.webp` original.
- Debe existir un `<link rel="preload" as="image">` apuntando al hero en el `<head>`.

> **Límite conocido que este paso no resuelve:** `public/hero-bg.webp` mide 1080×1920 — es una foto **vertical**. `next/image` no puede inventar píxeles: en un monitor ancho se recorta mucho y se escala hacia arriba. Para cerrarlo del todo hace falta un original apaisado de al menos 2560 px de ancho. Anótalo como petición al equipo de diseño; no bloquea esta tarea.

- [ ] **Step 7: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 8: Commit**

```bash
git add components/Hero.tsx components/Hero.module.css __tests__/components/hero-ctas.test.tsx
git commit -m "perf(hero): drop the sourceless video element and preload the LCP image

The <video> had no <source> children and .bgVideoVisible was never applied —
the visible background was always the CSS background-image. Now next/image
with priority, so the LCP element is preloaded and right-sized."
```

---

### Task 19: Borrar CSS y assets muertos

`app/page.module.css` tiene 233 líneas y `app/page.tsx` usa **una** clase. CSS Modules no elimina las no usadas: viajan enteras al bundle.

**Files:**
- Modify: `app/page.module.css` (dejar solo `.container`)
- Delete: `public/hero-bg.png`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`, `public/file.svg`, `public/globe.svg`

- [ ] **Step 1: Confirmar qué clases se usan de verdad**

```bash
grep -oE "styles\.[a-zA-Z0-9_]+" app/page.tsx | sort -u
```
Expected: solo `styles.container`

- [ ] **Step 2: Reducir el fichero**

Reemplazar `app/page.module.css` entero por:

```css
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
```

Todo lo demás (`.hero` con su Ken Burns, `.heroContent`, `.title`, `.subtitle`, `.ctaButton`, `.orb1`–`.orb3`, `.scrollIndicator`, `.scrollDot` y sus `@keyframes`) pertenecía al hero anterior, sustituido por `components/Hero.tsx`.

- [ ] **Step 3: Verificar que ningún otro fichero importa ese módulo**

```bash
grep -rn "page.module.css" app/*.tsx components/ | grep -v "app/curso-bachatango\|app/clase-gratis\|app/unsubscribe\|app/sobre-nosotros"
```
Expected: solo `app/page.tsx`

Cada ruta tiene su propio `page.module.css`; el `grep` los excluye para no confundirlos.

- [ ] **Step 4: Comprobar que los assets están realmente huérfanos**

```bash
for f in hero-bg.png next.svg vercel.svg window.svg file.svg globe.svg; do
  echo "--- $f"
  grep -rn "$f" app/ components/ utils/ public/ --include="*.tsx" --include="*.ts" --include="*.css" --include="*.json" || echo "  sin referencias"
done
```

Expected: los seis sin referencias. **Si alguno aparece referenciado, no lo borres** — quítalo de la lista y sigue con el resto.

- [ ] **Step 5: Borrar**

```bash
git rm public/hero-bg.png public/next.svg public/vercel.svg public/window.svg public/file.svg public/globe.svg
```

`hero-bg.webp` (97 KB) **se queda**: es el fondo del hero. `about-hero.png` y `luis-sara-about.jpg` también — los usan `/sobre-nosotros` y `AboutSection`.

- [ ] **Step 6: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde. Después arrancar `npm start` y recorrer `/`, `/sobre-nosotros`, `/curso-bachatango` y `/clase-gratis` comprobando que no falta ninguna imagen (404 en la pestaña Network).

- [ ] **Step 7: Commit**

```bash
git add app/page.module.css public/
git commit -m "chore: drop dead CSS and orphaned assets

page.module.css shipped 232 unused lines from the previous hero. The svg
files were Next.js template leftovers; hero-bg.png was superseded by the webp."
```

---

### Task 20: Iconos del manifest y apple-touch-icon

`app/manifest.ts:13-17` declara `/logo.png` con `sizes: 'any'`, pero el fichero es 576×1024 — no es cuadrado. Android e iOS lo deforman al instalar la PWA. Tampoco hay `apple-touch-icon`.

Igual que con las OG images, se generan con `next/og` en vez de pedir binarios.

**Files:**
- Create: `app/icon.tsx` (favicon/manifest, 512×512)
- Create: `app/apple-icon.tsx` (180×180)
- Modify: `app/manifest.ts:12-23` (`icons`)

Nota: `app/favicon.ico` se queda. Next lo sigue sirviendo en `/favicon.ico` para navegadores antiguos; `icon.tsx` cubre el resto.

- [ ] **Step 1: Crear el icono principal**

Crear `app/icon.tsx`:

```tsx
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

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
          fontSize: 250,
          fontWeight: 700,
          letterSpacing: -12,
        }}
      >
        LS
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Crear el apple-touch-icon**

Crear `app/apple-icon.tsx`. iOS no aplica esquinas redondeadas automáticamente a este icono, así que se dibuja un fondo pleno:

```tsx
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

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
          fontSize: 88,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        LS
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 3: Corregir el manifest**

En `app/manifest.ts`, sustituir el array `icons` (líneas 12-23) por:

```ts
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
```

`maskable` evita que Android recorte el logo dentro de su máscara circular. El diseño de `icon.tsx` centra las siglas con margen de sobra, así que el mismo PNG sirve para ambos usos.

- [ ] **Step 4: Comprobar**

```bash
npm run dev
```

- `http://localhost:3000/icon` → PNG 512×512 cuadrado
- `http://localhost:3000/apple-icon` → PNG 180×180
- `http://localhost:3000/manifest.webmanifest` → los dos iconos con `512x512`

En DevTools → Application → Manifest, no debe salir ningún aviso de icono.

- [ ] **Step 5: Verificación completa**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo verde

- [ ] **Step 6: Commit**

```bash
git add app/icon.tsx app/apple-icon.tsx app/manifest.ts
git commit -m "fix(pwa): square generated icons instead of a 576x1024 logo

manifest declared logo.png as sizes:'any' but it is portrait, so Android and
iOS distorted it on install. Adds the missing apple-touch-icon."
```

**Fin de la Fase 6.**

---

## Verificación final

Con las seis fases hechas, antes de mezclar a `main`:

- [ ] `npm run lint && npx tsc --noEmit && npm test && npm run build` — todo verde
- [ ] Lighthouse sobre `/` en preview: apuntar Performance, Accessibility, Best Practices y SEO, y compararlos con la referencia de `docs/lighthouse-2026-05-results.md` (74 / 100 / 92 / 69). Accessibility no debe bajar de 100.
- [ ] En incógnito, con la pestaña Network filtrada por `googletagmanager|facebook|instagram`: cero peticiones antes de aceptar cookies.
- [ ] `/clase-gratis` reproduce sin sesión.
- [ ] Suscribirse con una dirección real → llega el email → el enlace de baja funciona → resuscribirse reactiva.
- [ ] Los tres CTAs (hero primario, bloque de oferta, header) llegan a `/curso-bachatango`, y desde ahí se puede comprar de principio a fin en modo test de Stripe.
- [ ] Compartir `https://<preview>/` en WhatsApp y comprobar que el preview sale apaisado y con el texto correcto.
- [ ] Actualizar `docs/lighthouse-2026-05-results.md` (o crear uno nuevo con fecha) con las métricas medidas.

## Fuera de alcance (documentado, no ejecutado)

Estos hallazgos de la auditoría **no** se tocan en este plan. Quedan aquí para no perderlos:

| Hallazgo | Por qué se queda fuera |
|---|---|
| Routing por locale (`/en`, `/fr`, …) + hreflang | El trabajo más caro de todos: toca middleware, sitemap, canonical y todas las rutas. Decidir antes si EN/FR/DE/IT/JA son mercado real. |
| Copy editorial hardcodeado en español (`AboutSection` "CONOCE A TUS PROFES", `Features` "EL MÉTODO" y su intro, `Testimonials` "VOCES DE LA PISTA") | Depende de la decisión anterior: sin routing por locale, traducirlo aporta poco. |
| `/curso-bachatango` es 100% español (`copy.ts`) | Íd. |
| Testimonios sin foto, sin vídeo y con `stars: 5` fijo | Necesita material real de alumnos, no código. |
| Secciones que faltan en la home: temario, garantía/devolución, próximos eventos, preview del blog, showreel, credenciales (Bailando con las Estrellas, Premios Platino) | Necesita decisiones de contenido y material; el bloque de oferta de la Fase 1 cubre lo mínimo para vender. |
| Original apaisado del hero (≥2560 px de ancho) | Petición a diseño; la Task 18 deja el LCP todo lo bien que se puede con el asset actual. |

---

## Auto-revisión del plan

**Cobertura de la auditoría** — cada hallazgo bloqueante o legal tiene tarea asignada:
- Funnel huérfano → Tasks 1-4 · Clase de muestra inexistente → Tasks 9-11 · Newsletter sin email → Task 13 · Sin analítica → Task 8 · Sin banner de cookies → Tasks 5-8 · Newsletter sin baja ni prueba de consentimiento → Tasks 12-14 · OG image rota → Task 15 · Sin FAQPage / `sameAs` incompleto → Task 16 · FAQ q1 y cifras incoherentes → Task 17 · Vídeo muerto y LCP → Task 18 · CSS y assets muertos → Task 19 · Iconos del manifest → Task 20. Lo restante está en "Fuera de alcance" arriba.

**Consistencia de tipos entre tareas** — `COURSE_ID` y `getLandingCourse()` se definen en la Task 1 y los consumen las Tasks 4, 9 y 10. `useConsent()` se define en la Task 5 y lo consumen las Tasks 7 y 8. `makeUnsubscribeToken()`/`verifyUnsubscribeToken()` se definen en la Task 12 y los consumen las Tasks 13 y 14. `signPublicPlaybackToken()` se define en la Task 9 y la consume la Task 10.

**Dependencias de orden que no se pueden saltar:**
- Task 2 (diccionario) antes que la Task 3, o `t.home.offer` no existe.
- Task 5 antes que las Tasks 7 y 8.
- Task 9 antes que la Task 10; Task 10 antes que la Task 11 (la Task 11 enlaza a una ruta que crea la Task 10).
- Task 12 antes que las Tasks 13 y 14.
- Task 15 antes que el Step 3 de la Task 17 (la cifra de países aparece en la OG image).

