# Landing CURSO BACHATANGO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una landing standalone de venta en `/curso-bachatango` que empuja a comprar el CURSO BACHATANGO (€199, pago único) vía el checkout existente.

**Architecture:** Ruta nueva `app/curso-bachatango/` como Server Component que lee el curso de la BD (precio/nombre/imagen en vivo) y compone secciones estáticas + islas cliente. El `Header`/`Footer` global se ocultan en esta ruta por `usePathname`. Toda la lógica de CTA vive en un único componente `CourseCtaButton` (costura hacia Spec 2 guest checkout).

**Tech Stack:** Next.js 16 App Router, React Server Components, CSS Modules, Supabase (`@/utils/supabase/server`), `motion/react` (via `Reveal`), `lucide-react`, Vitest + Testing Library (jsdom).

## Global Constraints

- Next.js 16 App Router, CSS Modules only (sin Tailwind, sin Shadcn).
- Idioma: **solo español**. Copy en constantes (`copy.ts`), NO en `dictionaries.ts`.
- Tokens de `app/globals.css`: fondo `#050505`, `--primary #c0a062` (dorado), `--secondary #8a1c1c` (rojo), Playfair Display (títulos) + Inter (cuerpo), escalas `--spacing-*`/`--radius-*`.
- Curso fijo: `COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92'`, precio leído de la BD (no hardcodear €199 en lógica; sí en copy editable).
- Precio en UI se renderiza `€{price}`.
- Ruta pública (no auth-gated). No tocar `/api/checkout` ni el webhook (eso es Spec 2).
- Tests de componente: primera línea `// @vitest-environment jsdom`; viven en `__tests__/components/`.
- Commits frecuentes, uno por tarea como mínimo.

---

## File Structure

- `app/curso-bachatango/copy.ts` — constantes de texto (es) + `COURSE_ID`.
- `app/curso-bachatango/get-landing-course.ts` — helper testeable que lee el curso.
- `app/curso-bachatango/page.tsx` — Server Component: fetch, `notFound()`, metadata, JSON-LD, ensambla.
- `app/curso-bachatango/page.module.css` — estilos (compartido por page + _components).
- `app/curso-bachatango/_components/CourseCtaButton.tsx` — cliente: lógica CTA.
- `app/curso-bachatango/_components/StickyBuyBar.tsx` — cliente: barra sticky.
- `app/curso-bachatango/_components/LandingHero.tsx` — cliente: hero.
- `app/curso-bachatango/_components/LandingSections.tsx` — server: secciones estáticas.
- `app/curso-bachatango/_components/LandingFaq.tsx` — cliente: acordeón FAQ.
- Modificar: `components/Header.tsx`, `components/FooterClient.tsx`, `app/sitemap.ts`.
- Tests: `__tests__/components/header-landing-hide.test.tsx`, `footer-landing-hide.test.tsx`, `course-cta-button.test.tsx`, `landing-faq.test.tsx`; `__tests__/unit/get-landing-course.test.ts`.

---

### Task 1: Ocultar Header/Footer global en `/curso-bachatango`

**Files:**
- Modify: `components/Header.tsx` (añadir guard tras `usePathname`)
- Modify: `components/FooterClient.tsx` (añadir `usePathname` + guard)
- Test: `__tests__/components/header-landing-hide.test.tsx`, `__tests__/components/footer-landing-hide.test.tsx`

**Interfaces:**
- Produces: ninguna export nueva. Comportamiento: `Header` y `FooterClient` devuelven `null` cuando `usePathname() === '/curso-bachatango'`.

- [ ] **Step 1: Test de Header oculto**

Crear `__tests__/components/header-landing-hide.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'es', setLocale: () => {}, t: {} }),
}))

import Header from '@/components/Header'

describe('Header en landing', () => {
  it('no renderiza nada en /curso-bachatango', () => {
    mockPath = '/curso-bachatango'
    const { container } = render(<Header user={null} profile={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza normalmente en otras rutas', () => {
    mockPath = '/'
    const { container } = render(<Header user={null} profile={null} />)
    expect(container).not.toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Ejecutar test — debe fallar**

Run: `npx vitest run __tests__/components/header-landing-hide.test.tsx`
Expected: FAIL (el primer caso renderiza el header, container NO vacío).

- [ ] **Step 3: Añadir guard en Header**

En `components/Header.tsx`, localizar donde se llama `const pathname = usePathname()` (ya existe) y justo tras la desestructuración de hooks, antes del primer `return` de JSX, añadir:

```tsx
  // Landing de venta standalone: sin nav global.
  if (pathname === '/curso-bachatango') return null;
```

Si `usePathname()` no está asignado a una const reusable, cambiar la llamada existente a `const pathname = usePathname();` y usar esa.

- [ ] **Step 4: Test de Footer oculto**

Crear `__tests__/components/footer-landing-hide.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
}))
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'es', setLocale: () => {}, t: {} }),
}))

import FooterClient from '@/components/FooterClient'

describe('FooterClient en landing', () => {
  it('no renderiza nada en /curso-bachatango', () => {
    mockPath = '/curso-bachatango'
    const { container } = render(<FooterClient adminProfile={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza normalmente en otras rutas', () => {
    mockPath = '/'
    const { container } = render(<FooterClient adminProfile={null} />)
    expect(container).not.toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 5: Ejecutar test — debe fallar**

Run: `npx vitest run __tests__/components/footer-landing-hide.test.tsx`
Expected: FAIL (footer renderiza, y/o `usePathname` no importado).

- [ ] **Step 6: Añadir guard en FooterClient**

En `components/FooterClient.tsx`, añadir el import y el guard al inicio del componente:

```tsx
import { usePathname } from 'next/navigation';
```

Dentro del componente `FooterClient`, como primera línea del cuerpo:

```tsx
  const pathname = usePathname();
  if (pathname === '/curso-bachatango') return null;
```

(Colocar antes de cualquier otro hook que pueda causar orden condicional — poner `usePathname` como primer hook, y el resto de hooks existentes DESPUÉS del `return null` NO es válido; por tanto: llamar `usePathname` primero, luego el resto de hooks, y hacer el `if (pathname === ...) return null` **después de todos los hooks**. Si `FooterClient` usa `useLanguage()` u otros hooks, moverlos arriba y poner el guard tras ellos.)

- [ ] **Step 7: Ejecutar ambos tests — deben pasar**

Run: `npx vitest run __tests__/components/header-landing-hide.test.tsx __tests__/components/footer-landing-hide.test.tsx`
Expected: PASS (4 casos).

- [ ] **Step 8: Commit**

```bash
git add components/Header.tsx components/FooterClient.tsx __tests__/components/header-landing-hide.test.tsx __tests__/components/footer-landing-hide.test.tsx
git commit -m "feat(landing): ocultar Header/Footer global en /curso-bachatango"
```

---

### Task 2: Copy constants + helper de fetch del curso

**Files:**
- Create: `app/curso-bachatango/copy.ts`
- Create: `app/curso-bachatango/get-landing-course.ts`
- Test: `__tests__/unit/get-landing-course.test.ts`

**Interfaces:**
- Produces:
  - `COURSE_ID: string` y `LANDING_COPY` (objeto, ver abajo) desde `copy.ts`.
  - `interface LandingCourse { id: string; title: string; price_eur: number; image_url: string | null }`
  - `async function getLandingCourse(): Promise<LandingCourse | null>` desde `get-landing-course.ts`.

- [ ] **Step 1: Crear copy.ts**

Crear `app/curso-bachatango/copy.ts`:

```ts
export const COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92';

export const LANDING_COPY = {
  hero: {
    h1: 'Baila bachatango como nunca imaginaste',
    sub: 'El método completo de Luis y Sara para dominar la técnica, la conexión y la musicalidad — a tu ritmo, desde casa.',
    cta: 'Empieza ahora',
    micro: 'Pago único · Acceso de por vida · Pago seguro con Stripe',
    secondary: 'Prueba una clase gratis',
  },
  pain: {
    title: '¿Te suena esto?',
    items: [
      '¿Te trabas con las figuras y pierdes el hilo?',
      '¿No terminas de conectar con tu pareja?',
      '¿Sientes que no marcas el tiempo de la música?',
    ],
    promise: 'Este curso te lleva de la frustración a bailar con seguridad, estilo y disfrute.',
  },
  learn: {
    title: 'Qué vas a aprender',
    items: [
      { title: 'Técnica y postura', body: 'Bases sólidas para moverte con control y elegancia.' },
      { title: 'Conexión en pareja', body: 'Guía y respuesta para bailar como uno solo.' },
      { title: 'Musicalidad y tiempo', body: 'Entiende la música y baila dentro de ella.' },
      { title: 'Figuras y combinaciones', body: 'Repertorio progresivo, paso a paso.' },
      { title: 'Estilo propio', body: 'Encuentra tu sello sobre la pista.' },
      { title: 'Progresión guiada', body: 'De cero a avanzado, sin saltos ni lagunas.' },
    ],
  },
  method: {
    title: 'El método Luis y Sara',
    body: 'Cada movimiento desglosado y explicado, con práctica guiada y una progresión pensada para que interiorices sin frustrarte. No son clases sueltas: es un camino completo.',
  },
  bio: {
    title: 'Quiénes son Luis y Sara',
    body: 'Instructores internacionales de bachata y bachatango. Años formando bailarines dentro y fuera de la pista, con un método propio que ahora tienes a tu alcance desde casa.',
  },
  testimonials: {
    title: 'Lo que dicen sus alumnos',
    items: [
      { quote: 'En dos meses noté un cambio brutal en mi conexión y mi tiempo.', author: 'María, Madrid' },
      { quote: 'Por fin entiendo la música y no solo cuento pasos.', author: 'Javier, Valencia' },
      { quote: 'El método es clarísimo. Cada clase suma.', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'Empieza sin riesgo',
    body: 'Prueba una clase gratis antes de decidir. Sin tarjeta, sin compromiso.',
    cta: 'Ver clase gratis',
    trust: ['Pago seguro con Stripe', 'Acceso de por vida', 'Comunidad de bailarines'],
  },
  offer: {
    title: 'CURSO BACHATANGO completo',
    includes: [
      'Todas las lecciones en vídeo HD',
      'Técnica, figuras, musicalidad y estilo',
      'Acceso de por vida y actualizaciones',
      'Comunidad privada de alumnos',
    ],
    priceNote: 'Pago único · Acceso de por vida',
    cta: 'Comprar ahora',
  },
  faq: [
    { q: '¿Necesito pareja?', a: 'No. El curso enseña tanto el rol de guía como el de respuesta; puedes practicar solo/a y aplicarlo en pareja después.' },
    { q: '¿Qué nivel necesito?', a: 'Ninguno. Empieza desde cero y progresa hasta nivel avanzado.' },
    { q: '¿En qué dispositivos lo veo?', a: 'En cualquier dispositivo con navegador: móvil, tablet u ordenador.' },
    { q: '¿Cuánto dura el acceso?', a: 'Acceso de por vida. Compras una vez y es tuyo para siempre.' },
    { q: '¿Es seguro el pago?', a: 'Sí. El pago se procesa con Stripe; no almacenamos datos de tu tarjeta.' },
    { q: '¿Puedo empezar sin experiencia?', a: 'Totalmente. El método está diseñado para llevarte de la mano desde el primer paso.' },
  ],
  finalCta: {
    title: 'Tu mejor versión bailando empieza hoy',
    cta: 'Comprar el curso',
  },
} as const;
```

- [ ] **Step 2: Test del helper (falla primero)**

Crear `__tests__/unit/get-landing-course.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const single = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ single }),
        }),
      }),
    }),
  })),
}))

import { getLandingCourse } from '@/app/curso-bachatango/get-landing-course'

beforeEach(() => vi.clearAllMocks())

describe('getLandingCourse', () => {
  it('devuelve el curso cuando existe y está publicado', async () => {
    single.mockResolvedValue({
      data: { id: 'f89a576f-4a77-40f7-93e9-23e6c820ee92', title: 'CURSO BACHATANGO', price_eur: 199, image_url: 'x.png' },
      error: null,
    })
    const course = await getLandingCourse()
    expect(course).toEqual({
      id: 'f89a576f-4a77-40f7-93e9-23e6c820ee92',
      title: 'CURSO BACHATANGO',
      price_eur: 199,
      image_url: 'x.png',
    })
  })

  it('devuelve null cuando no existe / no publicado', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const course = await getLandingCourse()
    expect(course).toBeNull()
  })
})
```

- [ ] **Step 3: Ejecutar test — debe fallar**

Run: `npx vitest run __tests__/unit/get-landing-course.test.ts`
Expected: FAIL con "Cannot find module '@/app/curso-bachatango/get-landing-course'".

- [ ] **Step 4: Implementar el helper**

Crear `app/curso-bachatango/get-landing-course.ts`:

```ts
import { createClient } from '@/utils/supabase/server';
import { COURSE_ID } from './copy';

export interface LandingCourse {
  id: string;
  title: string;
  price_eur: number;
  image_url: string | null;
}

/**
 * Lee el curso fijo de la landing (publicado). Devuelve null si no existe
 * o no está publicado. Se usa desde el Server Component de la landing.
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

- [ ] **Step 5: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/unit/get-landing-course.test.ts`
Expected: PASS (2 casos).

- [ ] **Step 6: Commit**

```bash
git add app/curso-bachatango/copy.ts app/curso-bachatango/get-landing-course.ts __tests__/unit/get-landing-course.test.ts
git commit -m "feat(landing): copy es + helper getLandingCourse"
```

---

### Task 3: CourseCtaButton (lógica de CTA)

**Files:**
- Create: `app/curso-bachatango/_components/CourseCtaButton.tsx`
- Test: `__tests__/components/course-cta-button.test.tsx`

**Interfaces:**
- Consumes: nada de tareas previas (usa `/api/checkout` existente).
- Produces:
  ```ts
  interface CourseCtaButtonProps {
    courseId: string;
    isAuthed: boolean;
    label: string;
    className?: string;
  }
  export default function CourseCtaButton(props: CourseCtaButtonProps): JSX.Element
  ```
  Comportamiento: si `isAuthed` → POST `/api/checkout` `{courseId}` y `window.location.assign(data.url)`. Si no → `router.push('/signup?next=/curso-bachatango')`.

- [ ] **Step 1: Test (falla primero)**

Crear `__tests__/components/course-cta-button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

import CourseCtaButton from '@/app/curso-bachatango/_components/CourseCtaButton'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window.location, 'assign').mockImplementation(() => {})
})

describe('CourseCtaButton', () => {
  it('usuario NO logueado: redirige a signup con next', () => {
    render(<CourseCtaButton courseId="c1" isAuthed={false} label="Comprar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }))
    expect(push).toHaveBeenCalledWith('/signup?next=/curso-bachatango')
  })

  it('usuario logueado: llama a /api/checkout y redirige a Stripe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/x' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CourseCtaButton courseId="c1" isAuthed={true} label="Comprar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
      method: 'POST',
    })))
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/x'))
  })
})
```

- [ ] **Step 2: Ejecutar test — debe fallar**

Run: `npx vitest run __tests__/components/course-cta-button.test.tsx`
Expected: FAIL con "Cannot find module '.../CourseCtaButton'".

- [ ] **Step 3: Implementar CourseCtaButton**

Crear `app/curso-bachatango/_components/CourseCtaButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

interface CourseCtaButtonProps {
  courseId: string;
  isAuthed: boolean;
  label: string;
  className?: string;
}

export default function CourseCtaButton({ courseId, isAuthed, label, className }: CourseCtaButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    // Interino (Spec 1): visitante sin cuenta → signup y vuelta a la landing.
    // Spec 2 (guest checkout) sustituirá SOLO esta rama.
    if (!isAuthed) {
      router.push('/signup?next=/curso-bachatango');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo iniciar el pago');
      }
      window.location.assign(data.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      alert('Error: ' + message);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${styles.cta} ${className ?? ''}`}
    >
      {loading ? 'Procesando…' : label}
    </button>
  );
}
```

> Nota: importa `../page.module.css`, creado en Task 5. Si aún no existe al implementar esta tarea en aislamiento, crear un `page.module.css` mínimo con una clase `.cta {}` — Task 5 lo completa.

- [ ] **Step 4: Asegurar clase `.cta` mínima**

Si `app/curso-bachatango/page.module.css` no existe, crearlo con:

```css
.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 0.9rem 2rem;
  font: var(--h4);
  color: #050505;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}
.cta:hover { background: var(--primary-hover); transform: translateY(-1px); }
.cta:disabled { opacity: 0.6; cursor: default; }
```

- [ ] **Step 5: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/components/course-cta-button.test.tsx`
Expected: PASS (2 casos).

- [ ] **Step 6: Commit**

```bash
git add app/curso-bachatango/_components/CourseCtaButton.tsx app/curso-bachatango/page.module.css __tests__/components/course-cta-button.test.tsx
git commit -m "feat(landing): CourseCtaButton (checkout si logueado, signup si no)"
```

---

### Task 4: LandingHero + StickyBuyBar

**Files:**
- Create: `app/curso-bachatango/_components/LandingHero.tsx`
- Create: `app/curso-bachatango/_components/StickyBuyBar.tsx`
- Modify: `app/curso-bachatango/page.module.css`
- Test: `__tests__/components/landing-hero.test.tsx`

**Interfaces:**
- Consumes: `CourseCtaButton` (Task 3), `LANDING_COPY` (Task 2).
- Produces:
  ```ts
  interface HeroProps { courseId: string; isAuthed: boolean; price: number; imageUrl: string | null }
  export default function LandingHero(p: HeroProps): JSX.Element
  interface StickyProps { courseId: string; isAuthed: boolean; price: number }
  export default function StickyBuyBar(p: StickyProps): JSX.Element
  ```

- [ ] **Step 1: Test de LandingHero (falla primero)**

Crear `__tests__/components/landing-hero.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

import LandingHero from '@/app/curso-bachatango/_components/LandingHero'

describe('LandingHero', () => {
  it('muestra titular, precio y CTA', () => {
    render(<LandingHero courseId="c1" isAuthed={false} price={199} imageUrl={null} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Baila bachatango')
    expect(screen.getByText(/€199/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Empieza ahora/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npx vitest run __tests__/components/landing-hero.test.tsx`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar LandingHero**

Crear `app/curso-bachatango/_components/LandingHero.tsx`:

```tsx
'use client';

import { LANDING_COPY } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface HeroProps {
  courseId: string;
  isAuthed: boolean;
  price: number;
  imageUrl: string | null;
}

export default function LandingHero({ courseId, isAuthed, price, imageUrl }: HeroProps) {
  const c = LANDING_COPY.hero;
  return (
    <section
      className={styles.hero}
      style={imageUrl ? { backgroundImage: `linear-gradient(rgba(5,5,5,0.6), rgba(5,5,5,0.85)), url(${imageUrl})` } : undefined}
    >
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{c.h1}</h1>
        <p className={styles.heroSub}>{c.sub}</p>
        <div className={styles.heroCtaRow}>
          <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={`${c.cta} · €${price}`} />
          <a href="#clase-gratis" className={styles.heroSecondary}>{c.secondary}</a>
        </div>
        <p className={styles.heroMicro}>{c.micro}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implementar StickyBuyBar**

Crear `app/curso-bachatango/_components/StickyBuyBar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface StickyProps {
  courseId: string;
  isAuthed: boolean;
  price: number;
}

export default function StickyBuyBar({ courseId, isAuthed, price }: StickyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`${styles.sticky} ${visible ? styles.stickyVisible : ''}`} aria-hidden={!visible}>
      <span className={styles.stickyBrand}>Luis y Sara · CURSO BACHATANGO</span>
      <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={`Comprar · €${price}`} className={styles.stickyCta} />
    </div>
  );
}
```

- [ ] **Step 5: Añadir estilos hero + sticky a page.module.css**

Añadir a `app/curso-bachatango/page.module.css`:

```css
.hero {
  min-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-2xl) var(--page-pad);
  background-color: #050505;
  background-size: cover;
  background-position: center;
}
.heroInner { max-width: 720px; }
.heroTitle { font: var(--h1); color: var(--text-main); margin-bottom: var(--spacing-lg); }
.heroSub { font: var(--body); color: var(--text-muted); font-size: 1.15rem; margin-bottom: var(--spacing-xl); }
.heroCtaRow { display: flex; gap: var(--spacing-md); align-items: center; justify-content: center; flex-wrap: wrap; }
.heroSecondary { color: var(--primary); text-decoration: underline; font: var(--small); }
.heroMicro { margin-top: var(--spacing-md); color: var(--text-muted); font: var(--small); }

.sticky {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--page-pad);
  background: rgba(5,5,5,0.95);
  border-top: 1px solid var(--border);
  transform: translateY(100%);
  transition: transform 0.3s ease;
  z-index: 50;
}
.stickyVisible { transform: translateY(0); }
.stickyBrand { color: var(--text-main); font: var(--small); }
.stickyCta { padding: 0.6rem 1.4rem; }
@media (max-width: 600px) { .stickyBrand { display: none; } .sticky { justify-content: center; } }
```

- [ ] **Step 6: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/components/landing-hero.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/curso-bachatango/_components/LandingHero.tsx app/curso-bachatango/_components/StickyBuyBar.tsx app/curso-bachatango/page.module.css __tests__/components/landing-hero.test.tsx
git commit -m "feat(landing): hero + barra de compra sticky"
```

---

### Task 5: LandingSections (contenido estático) + LandingFaq

**Files:**
- Create: `app/curso-bachatango/_components/LandingSections.tsx`
- Create: `app/curso-bachatango/_components/LandingFaq.tsx`
- Modify: `app/curso-bachatango/page.module.css`
- Test: `__tests__/components/landing-faq.test.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY` (Task 2), `CourseCtaButton` (Task 3), `Reveal` (`@/components/Reveal`).
- Produces:
  ```ts
  interface SectionsProps { courseId: string; isAuthed: boolean; price: number }
  export default function LandingSections(p: SectionsProps): JSX.Element   // Server Component
  export default function LandingFaq(): JSX.Element                        // Client (accordion)
  ```

- [ ] **Step 1: Test de LandingFaq (falla primero)**

Crear `__tests__/components/landing-faq.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingFaq from '@/app/curso-bachatango/_components/LandingFaq'

describe('LandingFaq', () => {
  it('lista las preguntas y despliega la respuesta al pulsar', () => {
    render(<LandingFaq />)
    const q = screen.getByRole('button', { name: /¿Necesito pareja\?/ })
    expect(q).toBeInTheDocument()
    // respuesta oculta hasta expandir
    expect(q).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(q)
    expect(q).toHaveAttribute('aria-expanded', 'true')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npx vitest run __tests__/components/landing-faq.test.tsx`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar LandingFaq**

Crear `app/curso-bachatango/_components/LandingFaq.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LANDING_COPY } from '../copy';
import styles from '../page.module.css';

export default function LandingFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={styles.faq}>
      {LANDING_COPY.faq.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={styles.faqItem}>
            <button
              type="button"
              className={styles.faqQ}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <ChevronDown size={18} className={isOpen ? styles.faqIconOpen : undefined} aria-hidden="true" />
            </button>
            {isOpen && <p className={styles.faqA}>{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implementar LandingSections**

Crear `app/curso-bachatango/_components/LandingSections.tsx`:

```tsx
import Reveal from '@/components/Reveal';
import { LANDING_COPY, COURSE_ID } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import LandingFaq from './LandingFaq';
import styles from '../page.module.css';

interface SectionsProps {
  courseId: string;
  isAuthed: boolean;
  price: number;
}

export default function LandingSections({ courseId, isAuthed, price }: SectionsProps) {
  const c = LANDING_COPY;
  return (
    <>
      {/* Dolor → promesa */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.pain.title}</h2>
          <ul className={styles.painList}>
            {c.pain.items.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className={styles.promise}>{c.pain.promise}</p>
        </Reveal>
      </section>

      {/* Qué aprendes */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>{c.learn.title}</h2></Reveal>
        <div className={styles.grid}>
          {c.learn.items.map((it, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div className={styles.card}>
                <h3 className={styles.h3}>{it.title}</h3>
                <p className={styles.cardBody}>{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Método */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.method.title}</h2>
          <p className={styles.lead}>{c.method.body}</p>
        </Reveal>
      </section>

      {/* Bio */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.bio.title}</h2>
          <p className={styles.lead}>{c.bio.body}</p>
        </Reveal>
      </section>

      {/* Testimonios */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>{c.testimonials.title}</h2></Reveal>
        <div className={styles.grid}>
          {c.testimonials.items.map((t, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <blockquote className={styles.card}>
                <p className={styles.quote}>“{t.quote}”</p>
                <cite className={styles.cite}>{t.author}</cite>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Clase gratis (risk-reversal) */}
      <section id="clase-gratis" className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.freeClass.title}</h2>
          <p className={styles.lead}>{c.freeClass.body}</p>
          <a href={`/courses/${COURSE_ID}`} className={styles.ctaOutline}>{c.freeClass.cta}</a>
          <ul className={styles.trustRow}>
            {c.freeClass.trust.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Reveal>
      </section>

      {/* Oferta + precio */}
      <section className={styles.offer}>
        <Reveal>
          <h2 className={styles.h2}>{c.offer.title}</h2>
          <ul className={styles.includes}>
            {c.offer.includes.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className={styles.price}>€{price}</p>
          <p className={styles.priceNote}>{c.offer.priceNote}</p>
          <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={c.offer.cta} />
        </Reveal>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>Preguntas frecuentes</h2></Reveal>
        <LandingFaq />
      </section>

      {/* CTA final */}
      <section className={styles.finalCta}>
        <Reveal>
          <h2 className={styles.h2}>{c.finalCta.title}</h2>
          <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={c.finalCta.cta} />
        </Reveal>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Añadir estilos de secciones a page.module.css**

Añadir a `app/curso-bachatango/page.module.css`:

```css
.section { max-width: var(--page-max); margin: 0 auto; padding: var(--spacing-2xl) var(--page-pad); }
.h2 { font: var(--h2); color: var(--text-main); text-align: center; margin-bottom: var(--spacing-lg); }
.h3 { font: var(--h3); color: var(--primary); margin-bottom: var(--spacing-sm); }
.lead { font: var(--body); font-size: 1.15rem; color: var(--text-muted); text-align: center; max-width: 680px; margin: 0 auto; }
.painList { list-style: none; padding: 0; max-width: 560px; margin: 0 auto var(--spacing-lg); color: var(--text-main); }
.painList li { padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-subtle); }
.promise { font: var(--h3); color: var(--primary); text-align: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--spacing-lg); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-lg); }
.cardBody { color: var(--text-muted); font: var(--body); }
.quote { color: var(--text-main); font-style: italic; margin-bottom: var(--spacing-sm); }
.cite { color: var(--primary); font: var(--small); }
.trustRow { list-style: none; display: flex; gap: var(--spacing-lg); justify-content: center; flex-wrap: wrap; padding: var(--spacing-lg) 0 0; color: var(--text-muted); font: var(--small); }
.ctaOutline { display: inline-block; margin: var(--spacing-md) auto 0; padding: 0.8rem 1.8rem; border: 1px solid var(--primary); color: var(--primary); border-radius: var(--radius-pill); text-align: center; }
.offer { max-width: 620px; margin: var(--spacing-2xl) auto; padding: var(--spacing-2xl) var(--page-pad); text-align: center; background: var(--surface); border: 1px solid var(--primary); border-radius: var(--radius-lg); }
.includes { list-style: none; padding: 0; margin: 0 auto var(--spacing-lg); max-width: 420px; text-align: left; color: var(--text-main); }
.includes li { padding: var(--spacing-xs) 0; }
.price { font: var(--h1); color: var(--primary); }
.priceNote { color: var(--text-muted); font: var(--small); margin-bottom: var(--spacing-lg); }
.finalCta { text-align: center; padding: var(--spacing-2xl) var(--page-pad); }
.faq { max-width: 720px; margin: 0 auto; }
.faqItem { border-bottom: 1px solid var(--border); }
.faqQ { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md) 0; background: none; border: none; color: var(--text-main); font: var(--h4); cursor: pointer; text-align: left; }
.faqIconOpen { transform: rotate(180deg); transition: transform 0.2s ease; }
.faqA { color: var(--text-muted); font: var(--body); padding-bottom: var(--spacing-md); }
```

- [ ] **Step 6: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/components/landing-faq.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/curso-bachatango/_components/LandingSections.tsx app/curso-bachatango/_components/LandingFaq.tsx app/curso-bachatango/page.module.css __tests__/components/landing-faq.test.tsx
git commit -m "feat(landing): secciones de contenido + FAQ acordeón"
```

---

### Task 6: Ensamblar page.tsx (fetch, metadata, JSON-LD) + sitemap + verificación

**Files:**
- Create: `app/curso-bachatango/page.tsx`
- Modify: `app/sitemap.ts:12` (añadir ruta a `staticRoutes`)

**Interfaces:**
- Consumes: `getLandingCourse` (Task 2), `getCurrentUser` (`@/utils/supabase/get-user`), `LandingHero`/`LandingSections`/`StickyBuyBar` (Tasks 4-5), `safeJsonLd` (`@/utils/jsonld`).

- [ ] **Step 1: Implementar page.tsx**

Crear `app/curso-bachatango/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLandingCourse } from './get-landing-course';
import { getCurrentUser } from '@/utils/supabase/get-user';
import { safeJsonLd } from '@/utils/jsonld';
import LandingHero from './_components/LandingHero';
import LandingSections from './_components/LandingSections';
import StickyBuyBar from './_components/StickyBuyBar';
import styles from './page.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com';

export const metadata: Metadata = {
  title: 'Curso de Bachatango online | Luis y Sara',
  description: 'Aprende bachatango desde cero con el método completo de Luis y Sara: técnica, conexión y musicalidad. Pago único, acceso de por vida.',
  openGraph: {
    title: 'Curso de Bachatango online | Luis y Sara',
    description: 'El método completo de Luis y Sara para dominar el bachatango a tu ritmo, desde casa.',
    url: `${BASE_URL}/curso-bachatango`,
    type: 'website',
  },
  alternates: { canonical: `${BASE_URL}/curso-bachatango` },
};

// Regenerar el shell como mucho cada 5 min (precio/nombre desde BD).
export const revalidate = 300;

export default async function CursoBachatangoLanding() {
  const course = await getLandingCourse();
  if (!course) notFound();

  const user = await getCurrentUser();
  const isAuthed = !!user;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: course.title,
    description: 'Curso completo de bachatango online con Luis y Sara.',
    image: course.image_url ? [course.image_url] : undefined,
    brand: { '@type': 'Brand', name: 'Luis y Sara Bachatango' },
    offers: {
      '@type': 'Offer',
      price: course.price_eur,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: `${BASE_URL}/curso-bachatango`,
    },
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <LandingHero courseId={course.id} isAuthed={isAuthed} price={course.price_eur} imageUrl={course.image_url} />
      <LandingSections courseId={course.id} isAuthed={isAuthed} price={course.price_eur} />
      <StickyBuyBar courseId={course.id} isAuthed={isAuthed} price={course.price_eur} />
    </div>
  );
}
```

- [ ] **Step 2: Añadir clase `.page` a page.module.css**

Añadir a `app/curso-bachatango/page.module.css`:

```css
.page { background: #050505; color: var(--text-main); overflow-x: hidden; }
```

- [ ] **Step 3: Añadir la ruta al sitemap**

En `app/sitemap.ts`, dentro de `staticRoutes` (tras la línea de `${BASE_URL}/courses`), añadir:

```ts
    { url: `${BASE_URL}/curso-bachatango`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
```

- [ ] **Step 4: Typecheck + lint + suite completa**

Run: `npm run lint && npx vitest run`
Expected: lint OK; todos los tests PASS (incluidos los nuevos de Tasks 1-5).

- [ ] **Step 5: Verificación manual (dev server)**

Run: `npm run dev` y abrir `http://localhost:3000/curso-bachatango`.
Comprobar:
- NO aparece el `Header` ni el `Footer` del sitio; sí la barra sticky al hacer scroll.
- Hero muestra titular, `€199`, CTA "Empieza ahora · €199".
- Secciones: dolor, qué aprendes (grid), método, bio, testimonios, clase gratis, oferta (€199), FAQ (acordeón despliega), CTA final.
- CTA sin sesión → navega a `/signup?next=/curso-bachatango`.
- CTA con sesión iniciada → abre Stripe Checkout (en dev usa `sk_test`).
- Abrir otra ruta (`/`) y confirmar que Header/Footer SÍ aparecen.
- Responsive: móvil (barra sticky sin marca, grid a 1 columna).

- [ ] **Step 6: Commit**

```bash
git add app/curso-bachatango/page.tsx app/curso-bachatango/page.module.css app/sitemap.ts
git commit -m "feat(landing): ensamblar page /curso-bachatango + JSON-LD + sitemap"
```

---

## Self-Review (rellenado por el autor del plan)

**Spec coverage:**
- Ruta standalone + aislamiento Header/Footer → Task 1, Task 6.
- Precio/nombre/imagen desde BD → Task 2 (helper) + Task 6 (page).
- CTA seam `CourseCtaButton` (logueado vs signup) → Task 3.
- Barra sticky → Task 4.
- 11 secciones del funnel (hero, dolor, aprendes, método, bio, testimonios, clase gratis, oferta, FAQ, CTA final) → Tasks 4-5.
- Risk-reversal clase gratis → Task 5 (sección `#clase-gratis`).
- SEO/metadata + JSON-LD Product/Offer + sitemap → Task 6.
- es-only copy en `copy.ts` → Task 2.
- Testing (CTA, fetch helper, FAQ, hero, hide Header/Footer) → Tasks 1-5.

**Fuera de alcance confirmado:** guest checkout (Spec 2), i18n, garantía money-back — no hay tareas, correcto.

**Placeholder scan:** sin TBD/TODO. Todo el código está completo. La única condicionalidad ("si page.module.css no existe") tiene contenido concreto que crear.

**Type consistency:** `CourseCtaButton` props `{courseId, isAuthed, label, className?}` usadas igual en Hero/Sticky/Sections. `LandingCourse {id,title,price_eur,image_url}` consistente entre helper, test y page. `getLandingCourse()` firma consistente.
