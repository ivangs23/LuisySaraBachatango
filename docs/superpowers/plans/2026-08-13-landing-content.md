# Landing Content Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder editar desde el panel las cifras del hero, los testimonios y las preguntas frecuentes, sin tocar código ni esperar un despliegue.

**Architecture:** Tres tablas con texto en `jsonb` por idioma (español obligatorio, respaldo a español), sembradas con los valores actuales para que el día del despliegue nada cambie a la vista. Un módulo de servidor las lee y cae a los valores de código si algo falla. Los formularios del panel siguen el patrón de `app/events/`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS Modules, Supabase (PostgreSQL + RLS), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-13-landing-content-design.md`

## Global Constraints

- **La landing nunca puede romperse por esto.** Todo lector cae a los valores de código si la consulta falla o no devuelve filas. Un fallo de base de datos degrada el contenido; jamás tumba la página.
- **El seed se genera desde los diccionarios, no se transcribe.** 3 testimonios × 6 idiomas escritos a mano invitan a erratas.
- **`public.is_admin()` para las policies de escritura.** Nunca `select ... from profiles where role = 'admin'` dentro de una policy: es el patrón que dejó el embudo en 404 durante semanas (`supabase/MIGRATIONS.md`).
- **`position`, no `order`.** `order` es palabra reservada en SQL.
- **La tabla guarda el número pelado** (`25`), no `'+25'`. El formato es de la vista.
- Sin Tailwind ni Shadcn. CSS Modules.
- Tests en `__tests__/`; los de componente llevan `// @vitest-environment jsdom`; los módulos con `import 'server-only'` necesitan `vi.mock('server-only', () => ({}))`.
- Antes de cada commit: `npm run lint && npx tsc --noEmit && npm test`. Lint en **0 errores** (los 18 warnings son deuda previa).
- Commit por tarea, Conventional Commits en inglés.
- Rama: `feat/landing-content` a partir de `main`.

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `scripts/generate-landing-seed.ts` | Genera el SQL del seed desde los diccionarios |
| `supabase/2026_08_landing_content.sql` | Tablas, constraints, RLS y seed |
| `utils/landing/locale-text.ts` | `pickLocalized()` compartido |
| `utils/landing/content.ts` | Lectores con respaldo a los valores de código |
| `utils/landing/fallbacks.ts` | Los valores de código que hoy están repartidos |
| `app/admin/landing/contenido/page.tsx` + `actions.ts` + `_lib/parse.ts` + CSS | Panel |
| `components/admin/LandingContentForms.tsx` | Los tres formularios |

Modificados: `components/Hero.tsx`, `app/sobre-nosotros/AboutClient.tsx`, `app/opengraph-image.tsx`, `components/Testimonials.tsx`, `components/FAQ.tsx`, `app/page.tsx`, `app/admin/landing/page.tsx` (navegación).

---

## Task 1: Generador del seed

Sembrar a mano 3 testimonios y 3 preguntas en 6 idiomas es pedir una errata. Se genera desde la fuente que ya los tiene.

**Files:**
- Create: `scripts/generate-landing-seed.ts`

- [ ] **Step 1: Escribir el generador**

```ts
/**
 * Genera el SQL de seed de las tablas de contenido de la landing a partir de
 * los diccionarios y de los valores hoy hardcodeados en los componentes.
 *
 * Se genera en vez de transcribirse: son 3 testimonios y 3 preguntas por 6
 * idiomas, y copiarlos a mano invita a erratas silenciosas.
 *
 * Uso:  npx tsx scripts/generate-landing-seed.ts
 * La salida se pega en supabase/2026_08_landing_content.sql
 */
import { dictionaries } from '../utils/dictionaries'
import type { Locale } from '../utils/i18n/types'

const LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'it', 'ja']

/** Escapa una cadena para un literal SQL. */
function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function jsonbFor(pick: (loc: Locale) => string): string {
  const obj: Record<string, string> = {}
  for (const loc of LOCALES) obj[loc] = pick(loc)
  return `${sql(JSON.stringify(obj))}::jsonb`
}

// Valores actuales de components/Hero.tsx y app/sobre-nosotros/AboutClient.tsx,
// guardados sin signo: el '+' lo pone cada vista.
const STATS: { key: string; value: string; position: number }[] = [
  { key: 'years', value: '25', position: 1 },
  { key: 'students', value: '500', position: 2 },
  { key: 'countries', value: '30', position: 3 },
  { key: 'titles', value: '100', position: 4 },
]

// Los nombres viven hoy en components/Testimonials.tsx, no en el diccionario.
const TESTIMONIAL_NAMES = ['Elena M.', 'Carlos R.', 'Sofía y Marc']

const lines: string[] = []

lines.push('-- Seed generado por scripts/generate-landing-seed.ts. No editar a mano:')
lines.push('-- volver a generarlo si cambian los diccionarios.')
lines.push('')

lines.push('insert into public.landing_stats (key, value, position) values')
lines.push(
  STATS.map((s) => `  (${sql(s.key)}, ${sql(s.value)}, ${s.position})`).join(',\n') +
    '\non conflict (key) do nothing;',
)
lines.push('')

lines.push('insert into public.landing_testimonials (name, quote, stars, position) values')
lines.push(
  TESTIMONIAL_NAMES.map((name, i) => {
    const k = `t${i + 1}` as 't1' | 't2' | 't3'
    return `  (${sql(name)}, ${jsonbFor((loc) => dictionaries[loc].testimonials[k].quote)}, 5, ${i + 1})`
  }).join(',\n') + ';',
)
lines.push('')

lines.push('insert into public.landing_faq (question, answer, position) values')
lines.push(
  [1, 2, 3]
    .map((n) => {
      const k = `q${n}` as 'q1' | 'q2' | 'q3'
      return `  (${jsonbFor((loc) => dictionaries[loc].faq[k].q)}, ${jsonbFor((loc) => dictionaries[loc].faq[k].a)}, ${n})`
    })
    .join(',\n') + ';',
)

console.log(lines.join('\n'))
```

- [ ] **Step 2: Ejecutarlo y revisar la salida**

Run: `npx tsx scripts/generate-landing-seed.ts`

Comprobar en la salida:
- 4 filas en `landing_stats`, con los valores **sin signo** (`'25'`, no `'+25'`).
- 3 testimonios, cada uno con las 6 claves de idioma pobladas.
- 3 preguntas, con `question` y `answer` en los 6 idiomas.
- Las comillas simples del español (`"¿Sirve si no tengo pareja...?"`) escapadas como `''`.

- [ ] **Step 3: Guardar la salida para la Task 2**

```bash
npx tsx scripts/generate-landing-seed.ts > /tmp/landing-seed.sql
wc -l /tmp/landing-seed.sql
```

- [ ] **Step 4: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit
git add scripts/generate-landing-seed.ts
git commit -m "chore(landing): add seed generator for content tables

Three testimonials and three FAQ entries across six locales: transcribing
those by hand invites silent typos, so they are generated from the
dictionaries that already hold them."
```

---

## Task 2: Tablas y seed

**Files:**
- Create: `supabase/2026_08_landing_content.sql`
- Modify: `supabase/MIGRATIONS.md`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/2026_08_landing_content.sql` con el bloque de esquema de abajo, y **pegar al final la salida del generador** (Task 1, Step 3).

```sql
-- ============================================================================
-- Contenido editable de la landing: cifras, testimonios y preguntas frecuentes.
--
-- Por qué: cambiar una cifra o un testimonio exigía editar TypeScript, abrir un
-- PR y esperar un despliegue. Y las cifras estaban copiadas a mano en tres
-- ficheros (Hero, AboutClient, opengraph-image), que ya se desincronizaron: el
-- hero decía 50 países y "sobre nosotros" 30.
--
-- Texto en jsonb por idioma con español obligatorio, igual que `events`.
--
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Cifras. Conjunto FIJO de cuatro claves: el panel edita valores, no añade
-- filas. Una quinta cifra necesitaría su etiqueta traducida a seis idiomas en
-- los diccionarios, o sea código.
--
-- El valor se guarda SIN signo ('25'): Hero pinta '+25' y AboutClient '25+'.
-- El número es el dato; el adorno es de la vista.
-- ---------------------------------------------------------------------------
create table if not exists public.landing_stats (
  key        text primary key,
  value      text not null,
  position   int  not null,
  updated_at timestamptz not null default now(),
  constraint landing_stats_key_chk check (key in ('years', 'students', 'countries', 'titles')),
  constraint landing_stats_value_chk check (length(trim(value)) > 0)
);

create table if not exists public.landing_testimonials (
  id           uuid primary key default gen_random_uuid(),
  name         text    not null,
  quote        jsonb   not null,
  stars        int     not null default 5,
  position     int     not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint landing_testimonials_name_chk check (length(trim(name)) > 0),
  constraint landing_testimonials_stars_chk check (stars between 1 and 5),
  constraint landing_testimonials_quote_es_chk
    check (length(trim(coalesce(quote->>'es', ''))) > 0)
);

create table if not exists public.landing_faq (
  id           uuid primary key default gen_random_uuid(),
  question     jsonb   not null,
  answer       jsonb   not null,
  position     int     not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint landing_faq_question_es_chk
    check (length(trim(coalesce(question->>'es', ''))) > 0),
  constraint landing_faq_answer_es_chk
    check (length(trim(coalesce(answer->>'es', ''))) > 0)
);

create index if not exists landing_testimonials_position_idx
  on public.landing_testimonials (position) where is_published;
create index if not exists landing_faq_position_idx
  on public.landing_faq (position) where is_published;

-- ---------------------------------------------------------------------------
-- RLS: lectura pública de lo publicado, escritura solo admin.
--
-- La comprobación de admin va por public.is_admin() (SECURITY DEFINER,
-- 2026_08_fix_anon_read_admin_check.sql). Leer profiles.role dentro de una
-- policy es lo que dejó /curso-bachatango en 404 durante semanas: `anon` no
-- puede leer esa columna y PostgreSQL no cortocircuita `OR`.
-- ---------------------------------------------------------------------------
alter table public.landing_stats        enable row level security;
alter table public.landing_testimonials enable row level security;
alter table public.landing_faq          enable row level security;

drop policy if exists landing_stats_read on public.landing_stats;
create policy landing_stats_read on public.landing_stats for select using (true);

drop policy if exists landing_stats_write on public.landing_stats;
create policy landing_stats_write on public.landing_stats for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists landing_testimonials_read on public.landing_testimonials;
create policy landing_testimonials_read on public.landing_testimonials
  for select using (is_published or public.is_admin());

drop policy if exists landing_testimonials_write on public.landing_testimonials;
create policy landing_testimonials_write on public.landing_testimonials for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists landing_faq_read on public.landing_faq;
create policy landing_faq_read on public.landing_faq
  for select using (is_published or public.is_admin());

drop policy if exists landing_faq_write on public.landing_faq;
create policy landing_faq_write on public.landing_faq for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SEED — pegar aquí la salida de scripts/generate-landing-seed.ts
-- ============================================================================
```

- [ ] **Step 2: Aplicarla**

> Crea tres tablas nuevas y las siembra. No toca ninguna tabla existente.

Supabase → SQL Editor → pegar el fichero completo → Run.

- [ ] **Step 3: Verificar el seed y la RLS**

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async()=>{
  for (const t of ['landing_stats','landing_testimonials','landing_faq']) {
    const {data,error}=await anon.from(t).select('*');
    console.log(t.padEnd(22), error ? 'ERROR: '+error.message : data.length+' filas');
  }
  const {data:st}=await anon.from('landing_stats').select('key,value').order('position');
  console.log('cifras:', st.map(s=>s.key+'='+s.value).join(' '));
  const {data:te}=await anon.from('landing_testimonials').select('quote').limit(1);
  console.log('idiomas del 1er testimonio:', Object.keys(te[0].quote).join(','));
  const w=await anon.from('landing_faq').insert({question:{es:'x'},answer:{es:'y'},position:9});
  console.log('INSERT anon ->', w.error ? 'denegado' : '*** ESCRIBIÓ — MAL ***');
})();
" 2>&1 | grep -v injected
```

Expected: 4 / 3 / 3 filas; `years=25 students=500 countries=30 titles=100` **sin signos**; los 6 idiomas presentes; INSERT anónimo **denegado**.

- [ ] **Step 4: Registrar y commit**

Añadir la fila a la tabla de agosto de `supabase/MIGRATIONS.md`.

```bash
git add supabase/2026_08_landing_content.sql supabase/MIGRATIONS.md
git commit -m "feat(landing): add editable content tables seeded with current values

Seeded from the dictionaries so the site looks identical on deploy day.
Admin-only writes via public.is_admin()."
```

---

## Task 3: Lectores con respaldo

El punto donde se garantiza que la landing no se rompa: si la consulta falla o no hay filas, se usan los valores de código.

**Files:**
- Create: `utils/landing/locale-text.ts`
- Create: `utils/landing/fallbacks.ts`
- Create: `utils/landing/content.ts`
- Test: `__tests__/utils/landing-content.test.ts`

**Interfaces:**
- Produces desde `locale-text.ts`: `export function pickLocalized(map: unknown, locale: Locale): string`
- Produces desde `fallbacks.ts`: `FALLBACK_STATS`, `FALLBACK_TESTIMONIALS`, `FALLBACK_FAQ`
- Produces desde `content.ts`:
  - `export type LandingStats = Record<'years'|'students'|'countries'|'titles', string>`
  - `export type Testimonial = { id: string; name: string; quote: string; stars: number }`
  - `export type FaqItem = { id: string; question: string; answer: string }`
  - `export async function getLandingStats(): Promise<LandingStats>`
  - `export async function getTestimonials(locale: Locale): Promise<Testimonial[]>`
  - `export async function getFaqItems(locale: Locale): Promise<FaqItem[]>`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const orderMock = vi.fn()
const selectMock = vi.fn(() => ({ order: orderMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import { pickLocalized } from '@/utils/landing/locale-text'
import { getLandingStats, getTestimonials, getFaqItems } from '@/utils/landing/content'
import { FALLBACK_STATS, FALLBACK_TESTIMONIALS } from '@/utils/landing/fallbacks'

describe('pickLocalized', () => {
  const map = { es: 'hola', en: 'hi', fr: '' }

  it('devuelve el idioma pedido', () => {
    expect(pickLocalized(map, 'en')).toBe('hi')
  })

  it('cae a español si falta', () => {
    expect(pickLocalized(map, 'ja')).toBe('hola')
  })

  it('cae a español si está vacío', () => {
    expect(pickLocalized(map, 'fr')).toBe('hola')
  })

  it('nunca devuelve undefined con entradas raras', () => {
    expect(pickLocalized(null, 'es')).toBe('')
    expect(pickLocalized('texto', 'es')).toBe('')
    expect(pickLocalized({}, 'es')).toBe('')
  })
})

describe('getLandingStats', () => {
  beforeEach(() => { orderMock.mockReset() })

  it('devuelve las cifras de la BD', async () => {
    orderMock.mockResolvedValue({
      data: [
        { key: 'years', value: '26' }, { key: 'students', value: '600' },
        { key: 'countries', value: '31' }, { key: 'titles', value: '101' },
      ],
      error: null,
    })
    expect(await getLandingStats()).toEqual({ years: '26', students: '600', countries: '31', titles: '101' })
  })

  it('cae a los valores de código si la consulta falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getLandingStats()).toEqual(FALLBACK_STATS)
  })

  it('rellena con los de código las claves que falten', async () => {
    orderMock.mockResolvedValue({ data: [{ key: 'years', value: '26' }], error: null })
    const s = await getLandingStats()
    expect(s.years).toBe('26')
    expect(s.students).toBe(FALLBACK_STATS.students)
  })
})

describe('getTestimonials', () => {
  beforeEach(() => { orderMock.mockReset() })

  it('localiza las citas', async () => {
    orderMock.mockResolvedValue({
      data: [{ id: 'a', name: 'Ana', quote: { es: 'genial', en: 'great' }, stars: 5 }],
      error: null,
    })
    expect(await getTestimonials('en')).toEqual([{ id: 'a', name: 'Ana', quote: 'great', stars: 5 }])
  })

  it('cae a los de código si no hay filas', async () => {
    orderMock.mockResolvedValue({ data: [], error: null })
    const r = await getTestimonials('es')
    expect(r).toHaveLength(FALLBACK_TESTIMONIALS.length)
    expect(r[0].name).toBe(FALLBACK_TESTIMONIALS[0].name)
  })

  it('cae a los de código si la consulta falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getTestimonials('es')).toHaveLength(FALLBACK_TESTIMONIALS.length)
  })
})

describe('getFaqItems', () => {
  beforeEach(() => { orderMock.mockReset() })

  it('localiza pregunta y respuesta', async () => {
    orderMock.mockResolvedValue({
      data: [{ id: 'f', question: { es: '¿Qué?', en: 'What?' }, answer: { es: 'Esto', en: 'This' } }],
      error: null,
    })
    expect(await getFaqItems('en')).toEqual([{ id: 'f', question: 'What?', answer: 'This' }])
  })

  it('cae a los de código si la consulta falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await getFaqItems('es')).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/utils/landing-content.test.ts`
Expected: FAIL — no existen los módulos

- [ ] **Step 3: Escribir `locale-text.ts`**

```ts
import type { Locale } from '@/utils/i18n/types'

/**
 * Texto en el idioma pedido, con respaldo a español.
 *
 * Mismo criterio que `components/EventsClient.tsx:51`, extraído aquí para que
 * events y el contenido de la landing no puedan divergir.
 *
 * Tolera entradas raras a propósito: viene de una columna jsonb, y un `null`
 * o una forma inesperada no puede hacer explotar la página.
 */
export function pickLocalized(map: unknown, locale: Locale): string {
  if (typeof map !== 'object' || map === null) return ''
  const m = map as Record<string, unknown>
  const wanted = m[locale]
  if (typeof wanted === 'string' && wanted.length > 0) return wanted
  const es = m.es
  return typeof es === 'string' ? es : ''
}
```

- [ ] **Step 4: Escribir `fallbacks.ts`**

Los valores que hoy viven repartidos por los componentes. Copiar los textos **exactamente** de `utils/i18n/dictionaries/es.ts` (`testimonials.t1..t3.quote`, `faq.q1..q3`) y los nombres de `components/Testimonials.tsx:13-15`.

```ts
/**
 * Valores de código. Se usan cuando la base de datos no responde o no tiene
 * filas: la landing pierde la edición, nunca el contenido.
 *
 * En español a propósito: es el idioma obligatorio del modelo, y este camino
 * solo se recorre cuando algo va mal.
 */
export const FALLBACK_STATS = {
  years: '25',
  students: '500',
  countries: '30',
  titles: '100',
} as const

export const FALLBACK_TESTIMONIALS = [
  { id: 'fallback-1', name: 'Elena M.', stars: 5,
    quote: 'Nunca creí que pudiera aprender a conectar así con mi pareja a través de una pantalla. La metodología de Luis y Sara es impecable.' },
  { id: 'fallback-2', name: 'Carlos R.', stars: 5,
    quote: 'Llevo años bailando bachata, pero el bachatango ha sido un descubrimiento. La elegancia que transmiten en cada clase es inspiradora.' },
  { id: 'fallback-3', name: 'Sofía y Marc', stars: 5,
    quote: 'Perfecto para practicar en casa. Los detalles técnicos marcan la diferencia. 100% recomendado.' },
] as const

export const FALLBACK_FAQ = [
  { id: 'fallback-q1', question: '¿Necesito tener experiencia previa en baile?',
    answer: 'No hace falta. El curso empieza desde cero y avanza paso a paso. Si ya bailas bachata o tango partirás con ventaja, pero no es un requisito: lo único que damos por hecho es que quieres aprender.' },
  { id: 'fallback-q2', question: '¿Cómo accedo a los cursos?',
    answer: 'Una vez compras un curso, tienes acceso inmediato a todo el contenido del curso a través de la plataforma. Puedes ver las clases tantas veces como quieras.' },
  { id: 'fallback-q3', question: '¿Sirve si no tengo pareja de baile?',
    answer: 'Absolutamente. Aunque el Bachatango es un baile de pareja, muchas lecciones se enfocan en técnica individual, musicalidad y estilo que puedes practicar solo/a.' },
] as const
```

- [ ] **Step 5: Escribir `content.ts`**

```ts
import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import type { Locale } from '@/utils/i18n/types'
import { pickLocalized } from './locale-text'
import { FALLBACK_STATS, FALLBACK_TESTIMONIALS, FALLBACK_FAQ } from './fallbacks'

export type LandingStats = Record<'years' | 'students' | 'countries' | 'titles', string>
export type Testimonial = { id: string; name: string; quote: string; stars: number }
export type FaqItem = { id: string; question: string; answer: string }

/**
 * Cifras del hero y de «Sobre nosotros». Devuelve el número pelado ('25'):
 * cada vista le pone su '+' delante o detrás.
 *
 * Cualquier clave que falte en la tabla se rellena con el valor de código, así
 * que el resultado siempre trae las cuatro.
 */
export async function getLandingStats(): Promise<LandingStats> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('landing_stats')
      .select('key, value')
      .order('position', { ascending: true })

    if (error || !data) return { ...FALLBACK_STATS }

    const out: LandingStats = { ...FALLBACK_STATS }
    for (const row of data as { key: string; value: string }[]) {
      if (row.key in out && typeof row.value === 'string' && row.value.length > 0) {
        out[row.key as keyof LandingStats] = row.value
      }
    }
    return out
  } catch {
    return { ...FALLBACK_STATS }
  }
}

export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('landing_testimonials')
      .select('id, name, quote, stars')
      .eq('is_published', true)
      .order('position', { ascending: true })

    if (error || !data || data.length === 0) return [...FALLBACK_TESTIMONIALS]

    return (data as { id: string; name: string; quote: unknown; stars: number }[]).map((r) => ({
      id: r.id,
      name: r.name,
      quote: pickLocalized(r.quote, locale),
      stars: r.stars,
    }))
  } catch {
    return [...FALLBACK_TESTIMONIALS]
  }
}

export async function getFaqItems(locale: Locale): Promise<FaqItem[]> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('landing_faq')
      .select('id, question, answer')
      .eq('is_published', true)
      .order('position', { ascending: true })

    if (error || !data || data.length === 0) return [...FALLBACK_FAQ]

    return (data as { id: string; question: unknown; answer: unknown }[]).map((r) => ({
      id: r.id,
      question: pickLocalized(r.question, locale),
      answer: pickLocalized(r.answer, locale),
    }))
  } catch {
    return [...FALLBACK_FAQ]
  }
}
```

Nota: los tests mockean `.order()` como final de la cadena, y `getTestimonials`/`getFaqItems` encadenan `.eq().order()`. Ajustar el mock del test para que `select()` devuelva `{ eq, order }` y `eq()` devuelva `{ order }`.

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/utils/landing-content.test.ts`
Expected: PASS

- [ ] **Step 7: Comprobar contra los datos reales**

```bash
npx tsx -e "
import { getLandingStats, getTestimonials, getFaqItems } from './utils/landing/content'
Promise.all([getLandingStats(), getTestimonials('es'), getFaqItems('en')]).then(([s,t,f]) => {
  console.log('cifras:', s)
  console.log('testimonios:', t.length, '| primero:', t[0].name)
  console.log('faq en inglés:', f[0].question)
})
"
```
Expected: las cuatro cifras sin signo, 3 testimonios, y la primera pregunta **en inglés** — prueba de que la localización lee del `jsonb` y no del respaldo.

- [ ] **Step 8: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add utils/landing/ __tests__/utils/landing-content.test.ts
git commit -m "feat(landing): read editable content with code fallbacks

A DB failure degrades the content, never takes the page down: every reader
falls back to the values that used to be hardcoded."
```

---

## Task 4: Consumir las cifras desde una sola fuente

Cierra el fallo que originó todo esto: `+25 / +500 / +30` copiadas a mano en tres ficheros, ya desincronizadas una vez.

**Files:**
- Modify: `components/Hero.tsx`, `app/page.tsx`
- Modify: `app/sobre-nosotros/AboutClient.tsx` y su página contenedora
- Modify: `app/opengraph-image.tsx`
- Test: `__tests__/components/landing-stats-single-source.test.tsx`

**Interfaces:**
- Consumes: `getLandingStats()` (Task 3)
- Produces: `Hero` acepta `stats: LandingStats` por props; `AboutClient` igual

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import type { LandingStats } from '@/utils/landing/content'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

import Hero from '@/components/Hero'
import AboutClient from '@/app/sobre-nosotros/AboutClient'

const STATS: LandingStats = { years: '26', students: '600', countries: '31', titles: '101' }

describe('las cifras salen de una sola fuente', () => {
  it('el hero muestra las cifras recibidas, no unas hardcodeadas', () => {
    const { container } = render(
      <LanguageProvider initialLocale="es"><Hero stats={STATS} /></LanguageProvider>,
    )
    const hero = container.querySelector('section')!
    expect(within(hero).getByText('+26')).toBeInTheDocument()
    expect(within(hero).getByText('+600')).toBeInTheDocument()
    expect(within(hero).getByText('+31')).toBeInTheDocument()
    // Las de antes ya no pueden aparecer.
    expect(within(hero).queryByText('+25')).toBeNull()
  })

  it('sobre-nosotros muestra las mismas cifras', () => {
    render(
      <LanguageProvider initialLocale="es"><AboutClient stats={STATS} /></LanguageProvider>,
    )
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/components/landing-stats-single-source.test.tsx`
Expected: FAIL — ni `Hero` ni `AboutClient` aceptan `stats` todavía

- [ ] **Step 3: `Hero` recibe las cifras por props**

En `components/Hero.tsx`, sustituir la constante `STATS` por props. Quitar el bloque:

```tsx
// Estas cifras deben coincidir con app/sobre-nosotros/AboutClient.tsx y con
// app/opengraph-image.tsx. Antes el hero decía +50 países y la página "Sobre
// nosotros" 30+; se unifica en la menor a la espera de confirmación.
const STATS = [ ... ] as const;
```

y poner:

```tsx
import type { LandingStats } from '@/utils/landing/content';

/**
 * Orden y etiqueta de las cifras. El valor llega por props desde la base de
 * datos: antes estaba copiado aquí, en AboutClient y en la OG image, y las tres
 * copias se desincronizaron.
 */
const STAT_KEYS = [
  { key: 'years', labelKey: 'years' },
  { key: 'students', labelKey: 'students' },
  { key: 'countries', labelKey: 'countries' },
] as const;

type StatKey = typeof STAT_KEYS[number]['labelKey'];
```

Cambiar la firma:

```tsx
export default function Hero({ stats }: { stats: LandingStats }) {
```

Y el `.map()` de las cifras:

```tsx
          {STAT_KEYS.map((stat) => (
            <li key={stat.key} className={styles.statItem}>
              <span className={styles.statValue}>+{stats[stat.key]}</span>
              <span className={styles.statLabel}>
                {t.hero.stats[stat.labelKey as StatKey]}
              </span>
            </li>
          ))}
```

El `+` lo pone la vista: la tabla guarda `25`.

- [ ] **Step 4: `AboutClient` recibe las cifras por props**

En `app/sobre-nosotros/AboutClient.tsx`, sustituir la constante `STATS` (líneas 17-22) por:

```tsx
import type { LandingStats } from '@/utils/landing/content';

const STAT_KEYS = [
  { key: 'years', icon: GraduationCap, labelKey: 's1' as const },
  { key: 'students', icon: Users, labelKey: 's2' as const },
  { key: 'countries', icon: MapPin, labelKey: 's3' as const },
  { key: 'titles', icon: Trophy, labelKey: 's4' as const },
] as const;
```

Cambiar la firma a `export default function SobreNosotros({ stats }: { stats: LandingStats })` y, donde se pintaban `value` y `suffix`, usar `{stats[s.key]}` seguido del `+`.

- [ ] **Step 5: Pasar las cifras desde las páginas**

En `app/page.tsx`, añadir a la carga en paralelo:

```tsx
import { getLandingStats } from "@/utils/landing/content";
```

```tsx
  const [course, dict, stats] = await Promise.all([
    getLandingCourse(),
    getDict(),
    getLandingStats(),
  ]);
```

y `<Hero stats={stats} />`.

En la página que renderiza `AboutClient` (`app/sobre-nosotros/page.tsx`), leer `getLandingStats()` y pasarlo igual. Si esa página no es async todavía, convertirla.

- [ ] **Step 6: La OG image lee de la tabla**

En `app/opengraph-image.tsx`, sustituir las cifras fijas por la consulta:

```tsx
import { getLandingStats } from '@/utils/landing/content';
```

```tsx
export default async function OpengraphImage() {
  const stats = await getLandingStats();
  // ...
        <div style={{ display: 'flex' }}>+{stats.years} AÑOS</div>
        <div style={{ display: 'flex' }}>+{stats.students} ALUMNOS</div>
        <div style={{ display: 'flex' }}>+{stats.countries} PAÍSES</div>
```

Era la tercera copia y la razón de la desincronización. La imagen se cachea, así que es una consulta por regeneración.

- [ ] **Step 7: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/components/landing-stats-single-source.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 8: Comprobar en el navegador**

```bash
npm run dev
```

- `/` y `/sobre-nosotros` muestran `+25 / +500 / +30` (`25+` etc. en «Sobre nosotros»), igual que antes del cambio.
- `http://localhost:3000/opengraph-image` sigue generando el PNG con las mismas cifras.

Cambiar un valor en la tabla y recargar debe reflejarlo:

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  await s.from('landing_stats').update({value:'99'}).eq('key','countries');
  console.log('countries = 99; recarga / y comprueba que pone +99');
})();
" 2>&1 | grep -v injected
```

Después devolverlo a `30`.

- [ ] **Step 9: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
git add components/Hero.tsx app/page.tsx app/sobre-nosotros/ app/opengraph-image.tsx __tests__/components/landing-stats-single-source.test.tsx
git commit -m "refactor(landing): read hero stats from a single source

They were hand-copied across Hero, AboutClient and the OG image, and had
already drifted: the hero claimed 50 countries while the about page said 30."
```

---

## Task 5: Testimonios y FAQ desde la base de datos

**Files:**
- Modify: `components/Testimonials.tsx`, `components/FAQ.tsx`, `app/page.tsx`
- Test: `__tests__/components/testimonials-faq-props.test.tsx`

**Interfaces:**
- Consumes: `getTestimonials()`, `getFaqItems()` (Task 3)
- Produces: `Testimonials` acepta `items: Testimonial[]`; `FAQ` acepta `items: FaqItem[]`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import Testimonials from '@/components/Testimonials'
import FAQ from '@/components/FAQ'
import type { Testimonial, FaqItem } from '@/utils/landing/content'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

const TESTIMONIALS: Testimonial[] = [
  { id: 'a', name: 'Ana Real', quote: 'Aprendí muchísimo.', stars: 4 },
  { id: 'b', name: 'Bruno Real', quote: 'Muy recomendable.', stars: 5 },
]

const FAQS: FaqItem[] = [
  { id: 'f1', question: '¿Pregunta de la BD?', answer: 'Respuesta de la BD.' },
]

function wrap(ui: React.ReactNode) {
  return render(<LanguageProvider initialLocale="es">{ui}</LanguageProvider>)
}

describe('Testimonials', () => {
  it('pinta lo que recibe por props, no los nombres antiguos', () => {
    wrap(<Testimonials items={TESTIMONIALS} />)
    expect(screen.getByText('Ana Real')).toBeInTheDocument()
    expect(screen.queryByText('Elena M.')).toBeNull()
  })

  it('respeta las estrellas de cada testimonio', () => {
    const { container } = wrap(<Testimonials items={TESTIMONIALS} />)
    const stars = container.querySelectorAll('[data-stars]')
    expect(stars[0].getAttribute('data-stars')).toBe('4')
    expect(stars[1].getAttribute('data-stars')).toBe('5')
  })

  it('no renderiza la sección si no hay testimonios', () => {
    const { container } = wrap(<Testimonials items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('FAQ', () => {
  it('pinta las preguntas recibidas', () => {
    wrap(<FAQ items={FAQS} />)
    expect(screen.getByText('¿Pregunta de la BD?')).toBeInTheDocument()
  })

  it('abre la respuesta al pulsar', async () => {
    wrap(<FAQ items={FAQS} />)
    const btn = screen.getByRole('button', { name: /pregunta de la BD/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    btn.click()
    expect(await screen.findByText('Respuesta de la BD.')).toBeInTheDocument()
  })

  it('no renderiza la sección si no hay preguntas', () => {
    const { container } = wrap(<FAQ items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/components/testimonials-faq-props.test.tsx`
Expected: FAIL — los componentes no aceptan `items`

- [ ] **Step 3: `Testimonials` recibe los datos por props**

En `components/Testimonials.tsx`, quitar la constante `TESTIMONIALS` que arma el array desde `t.testimonials.t1..t3` y los nombres hardcodeados. Cambiar la firma:

```tsx
import type { Testimonial } from '@/utils/landing/content';

export default function Testimonials({ items }: { items: Testimonial[] }) {
  const { t } = useLanguage();
  const { ref, inView } = useInView();

  // Sin testimonios no se pinta la sección: mejor nada que un titular
  // colgando sobre un hueco.
  if (items.length === 0) return null;
```

En el `.map()`, usar `item.name`, `item.quote` y `item.stars`, y añadir `data-stars={item.stars}` al contenedor de estrellas para que el test pueda comprobarlo:

```tsx
            <div className={styles.stars} data-stars={item.stars}>{'★'.repeat(item.stars)}</div>
```

El título de la sección (`t.testimonials.title`) sigue viniendo del diccionario: no es contenido editable.

- [ ] **Step 4: `FAQ` recibe los datos por props**

En `components/FAQ.tsx`, quitar la constante `FAQS` armada desde `t.faq.q1..q3`. Cambiar la firma:

```tsx
import type { FaqItem } from '@/utils/landing/content';

export default function FAQ({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useLanguage();

  if (items.length === 0) return null;
```

En el `.map()`, usar `item.question` y `item.answer`, y `key={item.id}` en lugar del índice.

- [ ] **Step 5: Pasar los datos desde `app/page.tsx`**

```tsx
import { getLandingStats, getTestimonials, getFaqItems } from "@/utils/landing/content";
import { getCurrentLocale } from "@/utils/i18n/get-locale";
```

```tsx
  const locale = await getCurrentLocale();
  const [course, dict, stats, testimonials, faqItems] = await Promise.all([
    getLandingCourse(),
    getDict(),
    getLandingStats(),
    getTestimonials(locale),
    getFaqItems(locale),
  ]);
```

Y el JSON-LD pasa a alimentarse de la misma fuente que el acordeón, así que no pueden divergir:

```tsx
  const faqJsonLd = buildFaqJsonLd(
    faqItems.map((f) => ({ q: f.question, a: f.answer })),
  );
```

Renderizado: `<Testimonials items={testimonials} />` y `<FAQ items={faqItems} />`.

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/components/testimonials-faq-props.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 7: Comprobar que el JSON-LD sigue bien**

```bash
npm run build && npm start
curl -s http://localhost:3000 | python3 -c "
import sys,re,json
h=sys.stdin.read()
for m in re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', h, re.S):
    d=json.loads(m)
    if d.get('@type')=='FAQPage':
        print('FAQPage con', len(d['mainEntity']), 'preguntas')
        for q in d['mainEntity']: print(' -', q['name'][:60])
"
```
Expected: 3 preguntas, las mismas que muestra el acordeón.

- [ ] **Step 8: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
git add components/Testimonials.tsx components/FAQ.tsx app/page.tsx __tests__/components/testimonials-faq-props.test.tsx
git commit -m "refactor(landing): feed testimonials and FAQ from the database

Both now take their content as props from the server component, so they ship
less JavaScript, and the FAQPage JSON-LD reads the same source as the
accordion — they cannot diverge."
```

---

## Task 6: Panel de edición

**Files:**
- Create: `app/admin/landing/contenido/page.tsx`
- Create: `app/admin/landing/contenido/actions.ts`
- Create: `app/admin/landing/contenido/_lib/parse.ts`
- Create: `app/admin/landing/contenido/contenido.module.css`
- Create: `components/admin/LandingContentForms.tsx`
- Modify: `app/admin/landing/page.tsx` (navegación entre ambas vistas)
- Test: `__tests__/actions/landing-content-actions.test.ts`

**Interfaces:**
- Produces desde `_lib/parse.ts`:
  - `export function parseStatsForm(fd: FormData): { payload: {key:string; value:string}[] } | { error: string }`
  - `export function parseTestimonialForm(fd: FormData): { payload: Record<string, unknown> } | { error: string }`
  - `export function parseFaqForm(fd: FormData): { payload: Record<string, unknown> } | { error: string }`
- Produces desde `actions.ts`: `updateStats`, `upsertTestimonial`, `deleteTestimonial`, `upsertFaqItem`, `deleteFaqItem` — todas `(formData: FormData) => Promise<{ error: string } | void>`

El parseo vive en `_lib/parse.ts` porque **un módulo `'use server'` no puede exportar helpers síncronos** — mismo motivo que `app/events/_lib/parse.ts`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdminMock = vi.fn().mockResolvedValue({ id: 'admin' })
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => requireAdminMock() }))

const upsertMock = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ from: () => ({ upsert: upsertMock }) }),
}))

const revalidateMock = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidateMock(p) }))

import { updateStats } from '@/app/admin/landing/contenido/actions'
import { parseStatsForm, parseTestimonialForm } from '@/app/admin/landing/contenido/_lib/parse'

function fd(v: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(v).forEach(([k, val]) => f.append(k, val))
  return f
}

describe('parseStatsForm', () => {
  it('acepta las cuatro claves', () => {
    const r = parseStatsForm(fd({ years: '26', students: '600', countries: '31', titles: '101' }))
    expect('payload' in r).toBe(true)
  })

  it('rechaza un valor vacío', () => {
    const r = parseStatsForm(fd({ years: '', students: '600', countries: '31', titles: '101' }))
    expect('error' in r).toBe(true)
  })

  it('ignora claves que no son del conjunto fijo', () => {
    const r = parseStatsForm(fd({ years: '26', students: '600', countries: '31', titles: '101', hackeada: '9' }))
    if (!('payload' in r)) throw new Error('debería parsear')
    expect(r.payload.map(p => p.key)).not.toContain('hackeada')
  })
})

describe('parseTestimonialForm', () => {
  it('exige el español', () => {
    const r = parseTestimonialForm(fd({ name: 'Ana', quote_es: '', quote_en: 'hi', stars: '5', position: '1' }))
    expect('error' in r).toBe(true)
  })

  it('exige nombre', () => {
    const r = parseTestimonialForm(fd({ name: '  ', quote_es: 'hola', stars: '5', position: '1' }))
    expect('error' in r).toBe(true)
  })

  it('rechaza estrellas fuera de 1..5', () => {
    for (const stars of ['0', '6', 'x']) {
      const r = parseTestimonialForm(fd({ name: 'Ana', quote_es: 'hola', stars, position: '1' }))
      expect('error' in r, `stars=${stars}`).toBe(true)
    }
  })

  it('recoge los seis idiomas', () => {
    const r = parseTestimonialForm(fd({
      name: 'Ana', stars: '5', position: '1',
      quote_es: 'hola', quote_en: 'hi', quote_fr: 'salut', quote_de: 'hallo', quote_it: 'ciao', quote_ja: 'やあ',
    }))
    if (!('payload' in r)) throw new Error('debería parsear')
    expect(Object.keys(r.payload.quote as object)).toHaveLength(6)
  })
})

describe('updateStats', () => {
  beforeEach(() => {
    upsertMock.mockClear().mockResolvedValue({ error: null })
    revalidateMock.mockClear()
    requireAdminMock.mockResolvedValue({ id: 'admin' })
  })

  it('guarda y revalida la home', async () => {
    await updateStats(fd({ years: '26', students: '600', countries: '31', titles: '101' }))
    expect(upsertMock).toHaveBeenCalled()
    expect(revalidateMock).toHaveBeenCalledWith('/')
  })

  it('rechaza sin sesión de admin', async () => {
    requireAdminMock.mockRejectedValue(new Error('no'))
    const r = await updateStats(fd({ years: '26', students: '600', countries: '31', titles: '101' }))
    expect(r).toEqual({ error: 'No autorizado' })
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/actions/landing-content-actions.test.ts`
Expected: FAIL — no existen los módulos

- [ ] **Step 3: Escribir `_lib/parse.ts`**

```ts
import type { Locale } from '@/utils/i18n/types'

const LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'it', 'ja']

/** Conjunto fijo. Lo que venga fuera de aquí se descarta. */
const STAT_KEYS = ['years', 'students', 'countries', 'titles'] as const

function localizedFrom(fd: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const loc of LOCALES) {
    out[loc] = String(fd.get(`${prefix}_${loc}`) ?? '').trim()
  }
  return out
}

export function parseStatsForm(
  fd: FormData,
): { payload: { key: string; value: string }[] } | { error: string } {
  const payload: { key: string; value: string }[] = []
  for (const key of STAT_KEYS) {
    const value = String(fd.get(key) ?? '').trim()
    if (value.length === 0) return { error: `La cifra "${key}" no puede estar vacía` }
    payload.push({ key, value })
  }
  return { payload }
}

export function parseTestimonialForm(
  fd: FormData,
): { payload: Record<string, unknown> } | { error: string } {
  const name = String(fd.get('name') ?? '').trim()
  if (name.length === 0) return { error: 'El nombre es obligatorio' }

  const quote = localizedFrom(fd, 'quote')
  if (quote.es.length === 0) return { error: 'El testimonio en español es obligatorio' }

  const stars = Number(fd.get('stars'))
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { error: 'Las estrellas deben ser un número del 1 al 5' }
  }

  const position = Number(fd.get('position')) || 0
  const id = String(fd.get('id') ?? '').trim()

  return {
    payload: {
      ...(id ? { id } : {}),
      name,
      quote,
      stars,
      position,
      is_published: fd.get('is_published') === 'on',
    },
  }
}

export function parseFaqForm(
  fd: FormData,
): { payload: Record<string, unknown> } | { error: string } {
  const question = localizedFrom(fd, 'question')
  const answer = localizedFrom(fd, 'answer')

  if (question.es.length === 0) return { error: 'La pregunta en español es obligatoria' }
  if (answer.es.length === 0) return { error: 'La respuesta en español es obligatoria' }

  const id = String(fd.get('id') ?? '').trim()

  return {
    payload: {
      ...(id ? { id } : {}),
      question,
      answer,
      position: Number(fd.get('position')) || 0,
      is_published: fd.get('is_published') === 'on',
    },
  }
}
```

- [ ] **Step 4: Escribir `actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { parseStatsForm, parseTestimonialForm, parseFaqForm } from './_lib/parse'

const ADMIN_PATH = '/admin/landing/contenido'

async function ensureAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'No autorizado' }
  }
}

/**
 * Revalida donde se ve el contenido, para que el cambio salga al momento en
 * lugar de esperar los 5 minutos de ISR de la home.
 */
function revalidateLanding(): void {
  revalidatePath('/')
  revalidatePath('/sobre-nosotros')
  revalidatePath(ADMIN_PATH)
}

export async function updateStats(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseStatsForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('landing_stats')
    .upsert(
      parsed.payload.map((p, i) => ({ ...p, position: i + 1, updated_at: new Date().toISOString() })),
      { onConflict: 'key' },
    )

  if (error) {
    console.error('[updateStats] failed', error)
    return { error: error.message }
  }

  revalidateLanding()
}

export async function upsertTestimonial(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseTestimonialForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_testimonials').upsert(parsed.payload)

  if (error) {
    console.error('[upsertTestimonial] failed', error)
    return { error: error.message }
  }

  revalidateLanding()
}

export async function deleteTestimonial(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Falta el identificador' }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_testimonials').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidateLanding()
}

export async function upsertFaqItem(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseFaqForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_faq').upsert(parsed.payload)

  if (error) {
    console.error('[upsertFaqItem] failed', error)
    return { error: error.message }
  }

  revalidateLanding()
}

export async function deleteFaqItem(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Falta el identificador' }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_faq').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidateLanding()
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/actions/landing-content-actions.test.ts`
Expected: PASS

- [ ] **Step 6: Escribir la página y los formularios**

`app/admin/landing/contenido/page.tsx` es un Server Component que lee las tres tablas **sin filtrar por publicado** (el admin ve también los ocultos) y las pasa a `LandingContentForms`.

```tsx
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import LandingContentForms from '@/components/admin/LandingContentForms'
import styles from './contenido.module.css'

export const dynamic = 'force-dynamic'

export default async function LandingContentPage() {
  const sb = createSupabaseAdmin()
  const [stats, testimonials, faq] = await Promise.all([
    sb.from('landing_stats').select('key, value').order('position'),
    sb.from('landing_testimonials').select('*').order('position'),
    sb.from('landing_faq').select('*').order('position'),
  ])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Contenido de la landing</h1>
      </header>
      <p className={styles.intro}>
        Solo el español es obligatorio. Los idiomas que dejes vacíos mostrarán el
        texto en español.
      </p>
      <LandingContentForms
        stats={stats.data ?? []}
        testimonials={testimonials.data ?? []}
        faq={faq.data ?? []}
      />
    </div>
  )
}
```

`components/admin/LandingContentForms.tsx` es un componente de cliente con tres secciones. Cada campo traducible se edita en pestañas por idioma (`quote_es`, `quote_en`, …), y los formularios envían a las Server Actions con `action={updateStats}` etc., mostrando el error devuelto.

Estilo: seguir `components/EventForm.module.css`, que ya resuelve este tipo de formulario en el panel.

- [ ] **Step 7: Enlazar las dos vistas de Landing**

En `app/admin/landing/page.tsx`, junto al `RangePicker`, añadir un enlace a `/admin/landing/contenido`; y en la página de contenido, uno de vuelta a `/admin/landing`. El item del menú lateral ya cubre ambas porque `isActive` usa `startsWith`.

- [ ] **Step 8: Comprobar el circuito completo**

```bash
npm run dev
```

Con sesión de admin en `/admin/landing/contenido`:
- Cambiar `countries` a `31`, guardar, y ver `+31` en `/` **sin esperar** ni recargar el servidor.
- Añadir un testimonio con solo español, guardar, y verlo en la home.
- Cambiarlo a no publicado y comprobar que desaparece.
- Dejar el español vacío y comprobar que el formulario devuelve error y no guarda.
- Borrar todos los testimonios y comprobar que la sección **no se renderiza** en vez de dejar el titular colgando.

Después, restaurar los valores originales.

- [ ] **Step 9: Verificación completa y commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
git add app/admin/landing/ components/admin/LandingContentForms.tsx __tests__/actions/landing-content-actions.test.ts
git commit -m "feat(admin): add landing content editor

Stats, testimonials and FAQ editable from the panel. Spanish is required by
constraint; other locales fall back to it."
```

---

## Verificación final

- [ ] `npm run lint && npx tsc --noEmit && npm test && npm run build` — todo verde
- [ ] `npx playwright test` — todos pasan
- [ ] `npx tsx scripts/verify-anon-read.ts` — 6/6 (las tablas nuevas no abren nada)
- [ ] Con la anon key: se leen las filas publicadas, y **INSERT denegado** en las tres tablas
- [ ] La home se ve **idéntica** a antes del cambio (el seed lo garantiza)
- [ ] Editar una cifra en el panel se refleja en `/`, en `/sobre-nosotros` y en `/opengraph-image`
- [ ] Con la tabla `landing_testimonials` vaciada, la home sigue en pie con los testimonios de código
- [ ] El `FAQPage` JSON-LD muestra las mismas preguntas que el acordeón

## Auto-revisión del plan

**Cobertura del spec:** cifras editables y de fuente única → Tasks 2-4 · testimonios y FAQ → Tasks 2, 3, 5 · respaldo a código → Task 3 · seed generado → Task 1 · panel → Task 6 · RLS con `is_admin()` → Task 2 · revalidación al guardar → Task 6.

**Consistencia de tipos:** `LandingStats`, `Testimonial` y `FaqItem` se definen en la Task 3 y los consumen las Tasks 4, 5 y 6. `pickLocalized` se define en la Task 3 y solo lo usa `content.ts`. Los parseadores de la Task 6 devuelven `{ payload } | { error }`, igual que `parseEventForm`.

**Orden obligatorio:** Task 1 antes que la 2 (el seed sale del generador). Task 2 antes que la 3 (sin tablas no hay qué leer). Task 3 antes que la 4, la 5 y la 6. Las Tasks 4 y 5 son independientes entre sí. La Task 6 va al final: edita lo que las anteriores enseñan.
