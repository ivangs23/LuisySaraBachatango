# Post-Landing Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir las seis viñetas genéricas de la página de venta por el temario real del curso, sacado de la base de datos, y cerrar la última policy RLS que sigue leyendo `profiles.role`.

**Architecture:** El temario ya existe: 14 módulos raíz (`order` 1-14) con 14 sublecciones colgando de `parent_lesson_id`, todas con vídeo listo en Mux. Un módulo de servidor lo lee con el service role y lo entrega ya agrupado; un componente de presentación lo pinta. Las duraciones, hoy nulas, se traen una vez desde Mux con un script de backfill.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS Modules, Supabase (PostgreSQL + RLS), Mux Node SDK v14, Vitest + Testing Library.

**Spec:** `docs/roadmap-2026-08.md` (fase 1)

## Global Constraints

- **Requiere la Fase 0 hecha:** PR #3 mergeada y desplegada. Este plan parte de `main` con esos cambios dentro.
- **Sin Tailwind, sin Shadcn.** CSS Modules junto al componente.
- **El funnel es español-only por diseño.** Su copy vive en `app/curso-bachatango/copy.ts`, no en los diccionarios. La Fase 3 del roadmap internacionalizará el funnel entero de una vez; añadir claves de diccionario ahora sería trabajo que esa fase deshace.
- **`lessons.duration` es `integer`, en segundos** (`supabase/enhanced_upload.sql:10`).
- **Tests:** Vitest, `__tests__/` replica la estructura de origen. Los de componente necesitan `// @vitest-environment jsdom` en la primera línea. Los módulos con `import 'server-only'` necesitan `vi.mock('server-only', () => ({}))` — patrón establecido en `__tests__/utils/course-access.test.ts:4`.
- **Antes de cada commit:** `npm run lint && npx tsc --noEmit && npm test`. Lint debe quedarse en **0 errores** (los 18 warnings son deuda previa documentada).
- **Commit por tarea**, Conventional Commits en inglés.
- **Rama:** `feat/course-curriculum` a partir de `main`.
- **Nunca inventar contenido del curso.** Los títulos de módulo salen de la BD tal cual.

## Estructura de ficheros

- Crear: `scripts/backfill-lesson-durations.ts` — trae duraciones de Mux una vez
- Crear: `utils/courses/curriculum.ts` — lee y agrupa el temario
- Crear: `app/curso-bachatango/_components/CourseCurriculum.tsx` — presentación
- Crear: `supabase/2026_08_fix4_course_purchases_policy.sql` — última policy con el patrón roto
- Modificar: `app/curso-bachatango/copy.ts` — etiquetas del temario, quitar `learn.items` genéricos
- Modificar: `app/curso-bachatango/_components/LandingSections.tsx` — enchufar el componente
- Modificar: `app/curso-bachatango/page.module.css` — estilos del temario
- Modificar: `app/curso-bachatango/page.tsx` — pasar el temario como prop

---

## Task 1: Backfill de duraciones desde Mux

Ninguna de las 28 lecciones tiene `duration`. Mux ya conoce la de cada asset. Sin esto el temario no puede decir cuánto dura el curso, que es de lo primero que pregunta un comprador.

**Files:**
- Create: `scripts/backfill-lesson-durations.ts`

**Interfaces:**
- Produces: rellena `lessons.duration` (integer, segundos) para toda fila con `mux_asset_id` y `duration IS NULL`

- [ ] **Step 1: Escribir el script**

```ts
/**
 * Rellena `lessons.duration` (segundos) preguntando a Mux la duración de cada
 * asset. Idempotente: solo toca filas con `duration IS NULL`, así que puede
 * reejecutarse tras subir vídeos nuevos.
 *
 * Uso:
 *   npx tsx scripts/backfill-lesson-durations.ts          # simulacro
 *   npx tsx scripts/backfill-lesson-durations.ts --write  # escribe de verdad
 */
import { config } from 'dotenv'
import Mux from '@mux/mux-node'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const WRITE = process.argv.includes('--write')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
})

async function main() {
  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, title, mux_asset_id, duration')
    .not('mux_asset_id', 'is', null)
    .is('duration', null)

  if (error) {
    console.error('No se pudieron leer las lecciones:', error.message)
    process.exit(1)
  }
  if (!lessons?.length) {
    console.log('Nada que hacer: todas las lecciones con asset ya tienen duración.')
    return
  }

  console.log(`${lessons.length} lección(es) sin duración.${WRITE ? '' : ' SIMULACRO — usa --write para escribir.'}\n`)

  let ok = 0
  let failed = 0

  for (const lesson of lessons) {
    try {
      const asset = await mux.video.assets.retrieve(lesson.mux_asset_id!)
      if (typeof asset.duration !== 'number') {
        console.log(`⚠  ${lesson.title.slice(0, 40)} — Mux no devuelve duración todavía`)
        failed++
        continue
      }
      const seconds = Math.round(asset.duration)
      const mins = Math.floor(seconds / 60)
      console.log(`   ${lesson.title.slice(0, 40).padEnd(40)} ${mins}m ${seconds % 60}s`)

      if (WRITE) {
        const { error: upErr } = await supabase
          .from('lessons')
          .update({ duration: seconds })
          .eq('id', lesson.id)
        if (upErr) {
          console.log(`❌ no se pudo guardar: ${upErr.message}`)
          failed++
          continue
        }
      }
      ok++
    } catch (e) {
      console.log(`❌ ${lesson.title.slice(0, 40)} — ${(e as Error).message}`)
      failed++
    }
  }

  console.log(`\n${WRITE ? 'Escritas' : 'Se escribirían'}: ${ok} · fallos: ${failed}`)
  if (failed > 0) process.exit(1)
}

main()
```

- [ ] **Step 2: Ejecutar el simulacro**

Run: `npx tsx scripts/backfill-lesson-durations.ts`
Expected: lista las 28 lecciones con su duración y dice `SIMULACRO`. No escribe nada.

Si alguna dice "Mux no devuelve duración todavía", es que ese asset no ha terminado de procesarse. Anótala y sigue: el script es idempotente y se puede reejecutar.

- [ ] **Step 3: Escribir de verdad**

> **Aviso:** este paso modifica datos reales en la base de datos de producción. Solo rellena la columna `duration` donde estaba `NULL` — no borra ni cambia nada más. Revisa la salida del simulacro antes de continuar.

Run: `npx tsx scripts/backfill-lesson-durations.ts --write`
Expected: `Escritas: 28 · fallos: 0`

- [ ] **Step 4: Verificar contra la BD**

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {data}=await s.from('lessons').select('duration').eq('course_id','f89a576f-4a77-40f7-93e9-23e6c820ee92');
  const con=data.filter(x=>x.duration);
  const total=con.reduce((a,b)=>a+b.duration,0);
  console.log('con duración:',con.length,'/',data.length);
  console.log('total curso:',Math.floor(total/3600)+'h',Math.round(total%3600/60)+'min');
})();
"
```
Expected: 28/28 y un total plausible (un curso de 28 vídeos suele rondar 2-5 h).

- [ ] **Step 5: Reejecutar para comprobar idempotencia**

Run: `npx tsx scripts/backfill-lesson-durations.ts`
Expected: `Nada que hacer: todas las lecciones con asset ya tienen duración.`

- [ ] **Step 6: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add scripts/backfill-lesson-durations.ts
git commit -m "feat(lessons): backfill durations from Mux

None of the 28 lessons had a duration, so the sales page could not say how
long the course is. Idempotent: only touches rows where duration IS NULL."
```

---

## Task 2: Módulo de temario

**Files:**
- Create: `utils/courses/curriculum.ts`
- Test: `__tests__/utils/curriculum.test.ts`

**Interfaces:**
- Consumes: `COURSE_ID` de `utils/courses/landing-course.ts`
- Produces:
  - `export interface CurriculumLesson { id: string; title: string; duration: number | null }`
  - `export interface CurriculumModule { id: string; title: string; order: number; lessons: CurriculumLesson[]; totalSeconds: number }`
  - `export interface Curriculum { modules: CurriculumModule[]; moduleCount: number; lessonCount: number; totalSeconds: number }`
  - `export async function getCurriculum(): Promise<Curriculum | null>`
  - `export function formatDuration(seconds: number): string`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const orderMock = vi.fn()
const eqMock = vi.fn(() => ({ order: orderMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

import { getCurriculum, formatDuration } from '@/utils/courses/curriculum'

const ROWS = [
  { id: 'm1', title: 'INTRODUCCIÓN', order: 1, parent_lesson_id: null, duration: 300 },
  { id: 'm2', title: 'POSTURAS', order: 2, parent_lesson_id: null, duration: 600 },
  { id: 's1', title: 'POSTURAS — práctica', order: 1, parent_lesson_id: 'm2', duration: 120 },
  { id: 's2', title: 'POSTURAS — repaso', order: 2, parent_lesson_id: 'm2', duration: null },
]

describe('formatDuration', () => {
  it('muestra solo minutos por debajo de una hora', () => {
    expect(formatDuration(300)).toBe('5 min')
    expect(formatDuration(59)).toBe('1 min')
  })

  it('muestra horas y minutos por encima', () => {
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(3900)).toBe('1 h 5 min')
    expect(formatDuration(7830)).toBe('2 h 11 min')
  })

  it('devuelve cadena vacía si no hay duración', () => {
    expect(formatDuration(0)).toBe('')
  })
})

describe('getCurriculum', () => {
  beforeEach(() => {
    orderMock.mockReset()
    fromMock.mockClear()
  })

  it('agrupa las sublecciones bajo su módulo', async () => {
    orderMock.mockResolvedValue({ data: ROWS, error: null })
    const c = (await getCurriculum())!

    expect(c.moduleCount).toBe(2)
    expect(c.lessonCount).toBe(4)
    expect(c.modules[0].title).toBe('INTRODUCCIÓN')
    expect(c.modules[0].lessons).toHaveLength(0)
    expect(c.modules[1].lessons.map((l) => l.id)).toEqual(['s1', 's2'])
  })

  it('ordena los módulos por `order`', async () => {
    orderMock.mockResolvedValue({ data: [...ROWS].reverse(), error: null })
    const c = (await getCurriculum())!
    expect(c.modules.map((m) => m.order)).toEqual([1, 2])
  })

  it('suma la duración del módulo incluyendo sus sublecciones', async () => {
    orderMock.mockResolvedValue({ data: ROWS, error: null })
    const c = (await getCurriculum())!
    expect(c.modules[0].totalSeconds).toBe(300)
    // 600 del módulo + 120 de la sublección; la de duración nula no suma.
    expect(c.modules[1].totalSeconds).toBe(720)
    expect(c.totalSeconds).toBe(1020)
  })

  it('descarta sublecciones huérfanas en vez de perderlas en silencio', async () => {
    orderMock.mockResolvedValue({
      data: [...ROWS, { id: 'x', title: 'huérfana', order: 1, parent_lesson_id: 'no-existe', duration: 60 }],
      error: null,
    })
    const c = (await getCurriculum())!
    expect(c.lessonCount).toBe(4)
    expect(c.totalSeconds).toBe(1020)
  })

  it('devuelve null si la query falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getCurriculum()).toBeNull()
  })

  it('devuelve null si no hay lecciones', async () => {
    orderMock.mockResolvedValue({ data: [], error: null })
    expect(await getCurriculum()).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/utils/curriculum.test.ts`
Expected: FAIL — `Cannot find package '@/utils/courses/curriculum'`

- [ ] **Step 3: Escribir el módulo**

```ts
import 'server-only'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { COURSE_ID } from './landing-course'

export interface CurriculumLesson {
  id: string
  title: string
  duration: number | null
}

export interface CurriculumModule {
  id: string
  title: string
  order: number
  lessons: CurriculumLesson[]
  /** Duración del módulo más la de sus sublecciones, en segundos. */
  totalSeconds: number
}

export interface Curriculum {
  modules: CurriculumModule[]
  moduleCount: number
  lessonCount: number
  totalSeconds: number
}

interface Row {
  id: string
  title: string
  order: number
  parent_lesson_id: string | null
  duration: number | null
}

/**
 * Formatea segundos para mostrarlos a un comprador: "5 min", "1 h 5 min".
 * Nunca segundos sueltos — a nadie le importa que un módulo dure 312 s.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

/**
 * Temario del curso de la landing, ya agrupado en módulos.
 *
 * La jerarquía la marca `parent_lesson_id`: las filas sin padre son módulos
 * (con `order` 1..N sobre el curso) y las que lo tienen son sublecciones (con
 * `order` relativo a su padre).
 *
 * Usa el service role porque la página es pública y no hay cookies que
 * respetar, y así el temario no depende de la RLS de `lessons` — que ya ha
 * roto la lectura anónima una vez (ver supabase/MIGRATIONS.md).
 *
 * Solo expone títulos y duraciones: ningún `mux_playback_id` sale de aquí.
 */
export async function getCurriculum(): Promise<Curriculum | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  )

  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, order, parent_lesson_id, duration')
    .eq('course_id', COURSE_ID)
    .order('order', { ascending: true })

  if (error || !data || data.length === 0) return null

  const rows = data as Row[]
  const roots = rows.filter((r) => !r.parent_lesson_id)
  if (roots.length === 0) return null

  const byParent = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.parent_lesson_id) continue
    const list = byParent.get(r.parent_lesson_id) ?? []
    list.push(r)
    byParent.set(r.parent_lesson_id, list)
  }

  const modules: CurriculumModule[] = roots
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((root) => {
      const children = (byParent.get(root.id) ?? []).slice().sort((a, b) => a.order - b.order)
      const totalSeconds =
        (root.duration ?? 0) + children.reduce((sum, c) => sum + (c.duration ?? 0), 0)
      return {
        id: root.id,
        title: root.title,
        order: root.order,
        lessons: children.map((c) => ({ id: c.id, title: c.title, duration: c.duration })),
        totalSeconds,
      }
    })

  return {
    modules,
    moduleCount: modules.length,
    // Módulos + sublecciones reconocidas. Las huérfanas (padre inexistente)
    // quedan fuera a propósito: contarlas mentiría sobre lo que se compra.
    lessonCount: modules.reduce((n, m) => n + 1 + m.lessons.length, 0),
    totalSeconds: modules.reduce((n, m) => n + m.totalSeconds, 0),
  }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/utils/curriculum.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Comprobar contra los datos reales**

```bash
npx tsx -e "
import { getCurriculum, formatDuration } from './utils/courses/curriculum'
getCurriculum().then(c => {
  if (!c) return console.log('null — revisar COURSE_ID o service role')
  console.log(\`\${c.moduleCount} módulos · \${c.lessonCount} lecciones · \${formatDuration(c.totalSeconds)}\`)
  c.modules.forEach(m => console.log(' ', String(m.order).padStart(2), m.title.padEnd(34), formatDuration(m.totalSeconds), m.lessons.length ? \`(+\${m.lessons.length})\` : ''))
})
"
```
Expected: 14 módulos en el orden `INTRODUCCIÓN, COMUNIDAD, POSTURAS, BÁSICO PASEO DIAGONAL, …, DEMOSTRACION FINAL`, 28 lecciones y un total plausible.

Si falla con el error de `server-only`, ejecútalo con `npx vitest run` en su lugar; ese import solo funciona dentro de Next.

- [ ] **Step 6: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add utils/courses/curriculum.ts __tests__/utils/curriculum.test.ts
git commit -m "feat(courses): add curriculum reader grouped by module

The 14 modules and their sub-lessons already exist in the DB and were never
surfaced anywhere. Exposes titles and durations only — no playback IDs."
```

---

## Task 3: Componente `CourseCurriculum`

**Files:**
- Create: `app/curso-bachatango/_components/CourseCurriculum.tsx`
- Modify: `app/curso-bachatango/page.module.css` (añadir al final)
- Modify: `app/curso-bachatango/copy.ts` (bloque `learn`)
- Test: `__tests__/components/course-curriculum.test.tsx`

**Interfaces:**
- Consumes: `Curriculum`, `formatDuration` de `utils/courses/curriculum.ts` (Task 2)
- Produces: `export default function CourseCurriculum(props: { curriculum: Curriculum }): JSX.Element`

Componente de presentación puro: recibe el temario ya resuelto por props. Sin `'use client'` — no hay interactividad, y así no engorda el bundle.

- [ ] **Step 1: Reescribir el bloque `learn` de `copy.ts`**

En `app/curso-bachatango/copy.ts`, sustituir el bloque `learn` entero (título + los seis `items` genéricos) por:

```ts
  learn: {
    title: 'Qué vas a aprender',
    // El detalle sale de la BD (utils/courses/curriculum.ts): son los módulos
    // reales del curso. Antes había seis viñetas genéricas que valdrían para
    // cualquier curso de baile y no probaban que este existiera.
    subtitle: 'El temario completo, módulo a módulo.',
    moduleLabel: 'Módulo',
    lessonsLabel: 'lecciones',
    summary: '{modules} módulos · {lessons} lecciones · {duration}',
  },
```

Ojo: si algún otro fichero leía `c.learn.items`, dejará de compilar. Comprobar:

```bash
grep -rn "learn\.items\|learn\.title" app/ components/
```

- [ ] **Step 2: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import CourseCurriculum from '@/app/curso-bachatango/_components/CourseCurriculum'
import type { Curriculum } from '@/utils/courses/curriculum'

const CURRICULUM: Curriculum = {
  moduleCount: 2,
  lessonCount: 3,
  totalSeconds: 5400,
  modules: [
    { id: 'm1', title: 'INTRODUCCIÓN', order: 1, lessons: [], totalSeconds: 1800 },
    {
      id: 'm2',
      title: 'POSTURAS',
      order: 2,
      totalSeconds: 3600,
      lessons: [{ id: 's1', title: 'Práctica guiada', duration: 600 }],
    },
  ],
}

describe('CourseCurriculum', () => {
  it('lista todos los módulos con su número', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByText('INTRODUCCIÓN')).toBeInTheDocument()
    expect(screen.getByText('POSTURAS')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
  })

  it('resume módulos, lecciones y duración total', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByText(/2 módulos/)).toBeInTheDocument()
    expect(screen.getByText(/3 lecciones/)).toBeInTheDocument()
    expect(screen.getByText(/1 h 30 min/)).toBeInTheDocument()
  })

  it('muestra las sublecciones de un módulo', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByText('Práctica guiada')).toBeInTheDocument()
  })

  it('renderiza un h2 accesible', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByRole('heading', { level: 2, name: /qué vas a aprender/i })).toBeInTheDocument()
  })

  it('omite la duración de un módulo que no la tiene', () => {
    const sinDuracion: Curriculum = {
      ...CURRICULUM,
      modules: [{ id: 'm1', title: 'SOLO TÍTULO', order: 1, lessons: [], totalSeconds: 0 }],
    }
    render(<CourseCurriculum curriculum={sinDuracion} />)
    const item = screen.getByText('SOLO TÍTULO').closest('li')!
    expect(within(item).queryByText(/min|h /)).toBeNull()
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npx vitest run __tests__/components/course-curriculum.test.tsx`
Expected: FAIL — `Failed to resolve import ".../CourseCurriculum"`

- [ ] **Step 4: Escribir el componente**

```tsx
import { LANDING_COPY } from '../copy';
import { formatDuration, type Curriculum } from '@/utils/courses/curriculum';
import styles from '../page.module.css';

/**
 * Temario real del curso. Sustituye a seis viñetas genéricas que valdrían para
 * cualquier curso de baile: los nombres de los módulos prueban que el curso
 * existe y enseñan la progresión de golpe.
 *
 * Componente de servidor: no hay interactividad, así que no viaja al cliente.
 */
export default function CourseCurriculum({ curriculum }: { curriculum: Curriculum }) {
  const c = LANDING_COPY.learn;

  const summary = c.summary
    .replace('{modules}', String(curriculum.moduleCount))
    .replace('{lessons}', String(curriculum.lessonCount))
    .replace('{duration}', formatDuration(curriculum.totalSeconds));

  return (
    <section className={styles.section} aria-labelledby="curriculum-title">
      <h2 id="curriculum-title" className={styles.h2}>{c.title}</h2>
      <p className={styles.lead}>{c.subtitle}</p>
      <p className={styles.curriculumSummary}>{summary}</p>

      <ol className={styles.curriculumList}>
        {curriculum.modules.map((m) => {
          const dur = formatDuration(m.totalSeconds);
          return (
            <li key={m.id} className={styles.curriculumModule}>
              <div className={styles.curriculumHead}>
                <span className={styles.curriculumNum} aria-hidden="true">
                  {String(m.order).padStart(2, '0')}
                </span>
                <h3 className={styles.curriculumTitle}>{m.title}</h3>
                {dur && <span className={styles.curriculumDuration}>{dur}</span>}
              </div>

              {m.lessons.length > 0 && (
                <ul className={styles.curriculumLessons}>
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <span className={styles.curriculumBullet} aria-hidden="true">·</span>
                      {l.title}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

- [ ] **Step 5: Añadir los estilos**

Añadir al final de `app/curso-bachatango/page.module.css`:

```css
/* ---------- Temario ---------- */

.curriculumSummary {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
  margin: 0.75rem 0 0;
}

.curriculumList {
  list-style: none;
  padding: 0;
  margin: clamp(1.75rem, 4vh, 2.5rem) 0 0;
  display: grid;
  gap: 0.6rem;
  counter-reset: none;
}

.curriculumModule {
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 0.9rem 1.1rem;
  background: rgba(255, 255, 255, 0.02);
}

.curriculumHead {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
}

.curriculumNum {
  font-family: var(--font-serif);
  font-size: 0.8rem;
  color: var(--primary);
  flex-shrink: 0;
}

.curriculumTitle {
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-main);
  margin: 0;
  flex: 1 1 auto;
}

.curriculumDuration {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.curriculumLessons {
  list-style: none;
  padding: 0;
  margin: 0.55rem 0 0 1.7rem;
  display: grid;
  gap: 0.3rem;
}

.curriculumLessons li {
  display: flex;
  gap: 0.5rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--text-muted);
}

.curriculumBullet {
  color: var(--primary);
  flex-shrink: 0;
}

@media (max-width: 560px) {
  .curriculumHead {
    flex-wrap: wrap;
    gap: 0.4rem 0.7rem;
  }
  .curriculumTitle {
    flex: 1 1 100%;
    order: 2;
  }
  .curriculumDuration {
    order: 1;
  }
}
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run __tests__/components/course-curriculum.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 7: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add app/curso-bachatango/_components/CourseCurriculum.tsx app/curso-bachatango/page.module.css app/curso-bachatango/copy.ts __tests__/components/course-curriculum.test.tsx
git commit -m "feat(funnel): add real curriculum section

Replaces six generic bullets that would fit any dance course with the actual
14 modules from the DB. Specific proves the course exists; generic proves
nothing."
```

---

## Task 4: Enchufar el temario en la página de venta

**Files:**
- Modify: `app/curso-bachatango/page.tsx`
- Modify: `app/curso-bachatango/_components/LandingSections.tsx`

**Interfaces:**
- Consumes: `getCurriculum()` (Task 2), `CourseCurriculum` (Task 3)

- [ ] **Step 1: Leer el temario en la página**

En `app/curso-bachatango/page.tsx`, añadir el import:

```tsx
import { getCurriculum } from '@/utils/courses/curriculum';
```

Y dentro de `CursoBachatangoLanding()`, junto a la carga del curso, resolver ambos en paralelo:

```tsx
  const course = await getLandingCourse();
  if (!course) notFound();

  const [user, curriculum] = await Promise.all([getCurrentUser(), getCurriculum()]);
  const isAuthed = !!user;
```

(sustituye la línea `const user = await getCurrentUser()` existente)

Pasar el temario a las secciones:

```tsx
      <LandingSections courseId={course.id} price={course.price_eur} curriculum={curriculum} />
```

- [ ] **Step 2: Aceptar y renderizar el temario en `LandingSections`**

En `app/curso-bachatango/_components/LandingSections.tsx`, añadir el import y ampliar las props:

```tsx
import CourseCurriculum from './CourseCurriculum';
import type { Curriculum } from '@/utils/courses/curriculum';

interface SectionsProps {
  courseId: string;
  price: number;
  /** null si la BD no responde: la página sigue vendiendo sin el temario. */
  curriculum: Curriculum | null;
}

export default function LandingSections({ courseId, price, curriculum }: SectionsProps) {
```

Sustituir la sección «Qué aprendes» actual (la que mapea `c.learn.items`) por:

```tsx
      {/* Temario real, desde la BD */}
      {curriculum && <CourseCurriculum curriculum={curriculum} />}
```

Se renderiza condicionalmente a propósito: si la consulta falla, la página pierde el temario pero sigue vendiendo. Mejor eso que un 500.

- [ ] **Step 3: Comprobar que no quedan referencias al bloque viejo**

```bash
grep -rn "learn.items" app/ components/ ; echo "exit=$?"
```
Expected: sin resultados (`exit=1`)

- [ ] **Step 4: Verificar en el navegador**

```bash
npm run dev
```

En `http://localhost:3000/curso-bachatango`, comprobar:
- Aparecen los 14 módulos, numerados 01-14, en el orden del temario.
- El resumen dice "14 módulos · 28 lecciones · Xh Ymin" con la duración real.
- Los módulos con sublecciones las listan debajo.
- A 375 px de ancho la duración no se solapa con el título.

- [ ] **Step 5: Verificación completa y commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
git add app/curso-bachatango/
git commit -m "feat(funnel): render the curriculum on the sales page

Renders conditionally: if the query fails the page loses the curriculum but
still sells, which beats a 500."
```

---

## Task 5: Última policy con el patrón que tumbó el embudo

`course_purchases` sigue comprobando el rol leyendo `profiles.role` directamente. Hoy no rompe nada —`lessons` dejó de depender de ella en `2026_08_fix3`— pero es el mismo patrón que dejó `/curso-bachatango` en 404 durante semanas.

**Files:**
- Create: `supabase/2026_08_fix4_course_purchases_policy.sql`
- Modify: `supabase/MIGRATIONS.md`

**Interfaces:**
- Consumes: `public.is_admin()`, creada en `supabase/2026_08_fix_anon_read_admin_check.sql`

- [ ] **Step 1: Obtener la definición viva de la policy**

**No escribir la migración antes de este paso.** La policy de `course_purchases` no está en ningún fichero del repo: vive solo en la base de datos. Reescribirla a ciegas tocaría el control de acceso a contenido de pago.

Ejecutar en el SQL Editor de Supabase (solo lee el catálogo):

```sql
select
  polname as policy_name,
  case polcmd
    when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE'
    when 'd' then 'DELETE' when '*' then 'ALL'
  end as command,
  polpermissive as permissive,
  pg_get_expr(polqual, polrelid) as using_expression,
  pg_get_expr(polwithcheck, polrelid) as with_check_expression
from pg_policy
where polrelid = 'public.course_purchases'::regclass
order by command, polname;
```

- [ ] **Step 2: Escribir la migración a partir de esa salida**

Crear `supabase/2026_08_fix4_course_purchases_policy.sql`. La regla es **una sola sustitución**: allí donde la expresión diga

```sql
exists (select 1 from profiles where id = (select auth.uid()) and role = 'admin')
```

poner `public.is_admin()`. **Todo lo demás se copia literal**, incluidas las ramas de `user_id = auth.uid()` y cualquier condición sobre `refunded_at`.

Plantilla, a completar con lo que devuelva el Step 1:

```sql
-- ============================================================================
-- Última policy con el patrón que tumbó el embudo en julio.
--
-- 2026_07_fix2 revocó a `anon` el SELECT sobre profiles.role, pero varias
-- policies seguían leyéndolo. PostgreSQL no cortocircuita `OR`, así que la
-- rama de admin se evalúa igualmente y el error aborta el SELECT entero.
-- `courses`, `lessons` y `events` ya se arreglaron (fix1 y fix3);
-- `course_purchases` es la que queda.
--
-- Hoy no rompe nada visible: `lessons` dejó de subconsultarla en fix3. Se
-- cierra para que el patrón no vuelva a morder.
--
-- Idempotente.
-- ============================================================================

drop policy if exists "<NOMBRE EXACTO DEL STEP 1>" on public.course_purchases;
create policy "<NOMBRE EXACTO DEL STEP 1>" on public.course_purchases
  for <COMANDO DEL STEP 1> using (
    -- Copiado de la definición viva, sustituyendo SOLO la comprobación de
    -- admin por public.is_admin().
    <EXPRESIÓN DEL STEP 1 CON is_admin()>
  );
```

- [ ] **Step 3: Aplicarla y verificar**

> **Aviso:** cambia una policy de seguridad sobre datos reales. Confirma que hay backup reciente (Supabase → Database → Backups) antes de ejecutarla.

Tras aplicarla, comprobar que **nada se ha abierto de más**:

```bash
npx tsx scripts/verify-anon-read.ts
```
Expected: 6/6. En especial, `profiles.role` **debe seguir denegado** para `anon`.

Y que `anon` sigue sin poder leer compras ajenas:

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async()=>{
  const {data,error}=await anon.from('course_purchases').select('id').limit(1);
  console.log('anon sobre course_purchases ->', error ? 'denegado: '+error.message : (data.length+' filas'));
})();
"
```
Expected: 0 filas o denegado. **Nunca** filas con datos.

- [ ] **Step 4: Registrar la migración**

En `supabase/MIGRATIONS.md`, añadir la fila a la tabla de agosto y **borrar** el párrafo de deuda que empieza por *"**Deuda que queda:** la policy SELECT de `course_purchases`…"*, que deja de aplicar.

- [ ] **Step 5: Commit**

```bash
git add supabase/2026_08_fix4_course_purchases_policy.sql supabase/MIGRATIONS.md
git commit -m "fix(db): drop the last policy reading profiles.role directly

course_purchases carried the same pattern that took the funnel down for
weeks. Harmless today since lessons no longer subqueries it, closed so it
cannot bite again."
```

---

## Verificación final de la fase

- [ ] `npm run lint && npx tsc --noEmit && npm test && npm run build` — todo verde
- [ ] `npx playwright test` — 47 pasan, 15 saltados
- [ ] `npx tsx scripts/verify-anon-read.ts` — 6/6
- [ ] `npx tsx scripts/check-public-surface.ts` — 8/8 contra producción
- [ ] `/curso-bachatango` muestra los 14 módulos con duraciones reales
- [ ] Lighthouse sobre `/curso-bachatango`: SEO y Accessibility siguen en 100

## Auto-revisión del plan

**Cobertura del spec (fase 1 del roadmap):** 1a temario → Tasks 2-4 · 1b duraciones → Task 1 · 1c policy → Task 5 · 1d clase de muestra → no es código, queda en el roadmap como decisión de contenido.

**Consistencia de tipos:** `Curriculum`, `CurriculumModule`, `CurriculumLesson` y `formatDuration` se definen en la Task 2 y los consumen las Tasks 3 y 4 con los mismos nombres. `getCurriculum()` devuelve `Curriculum | null`, y tanto `page.tsx` como `LandingSections` tratan el `null`.

**Orden obligatorio:** Task 1 antes que la 3 (sin duraciones el resumen sale sin tiempo, y el test de la Task 3 espera "1 h 30 min" con datos de prueba, pero la comprobación real del Step 4 de la Task 4 espera duraciones reales). Task 2 antes que la 3 y la 4. Task 3 antes que la 4. La Task 5 es independiente y puede ir en cualquier momento.
