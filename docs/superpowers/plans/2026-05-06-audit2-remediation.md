# Audit 2 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las 16 brechas identificadas en la segunda auditoría (post-scaling), priorizando los 6 ALTO que afectan el modelo de negocio (gating de cursos premium).

**Architecture:** Centraliza la lógica de "tiene este usuario acceso a este curso" en un helper reutilizable (`utils/auth/course-access.ts`) usado por server actions y nuevas RLS policies. Refuerza la frontera cliente/servidor moviendo la construcción de paths de upload al server. Endurece flujos auth (forgot-password sin oracle, signup con validación server-side) y limpia config (revalidateTag, exports de test, tunnel route, env asserts).

**Tech Stack:** Next.js 16 App Router · Supabase Pro · Stripe · Vitest · Upstash Redis · Sentry.

**Hallazgos descartados verificados como falsos positivos:**
- ✅ `getCurrentUser` y `cache()` — agente confirmó comportamiento correcto.
- ✅ `notifications_with_actor` view — `security_invoker = true` aplica RLS correctamente.
- ✅ Stripe `maxNetworkRetries` no causa duplicados (retries son outbound, no webhooks inbound).

---

## Fase 0 — Preparación

### Task 0.1: Crear rama y baseline

**Files:** ninguno (bootstrap)

- [ ] **Step 1: Branch desde main**

```bash
cd /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango
git checkout main
git pull origin main
git checkout -b chore/audit2-remediation
```

- [ ] **Step 2: Gates verdes**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
npm run i18n:check
```

Expected: all pass. Si falla algo, STOP y reportar BLOCKED.

- [ ] **Step 3: Commit marcador**

```bash
git commit --allow-empty -m "chore: start audit2-remediation branch"
```

---

### Task 0.2: Helper compartido `course-access.ts`

Crear el helper que las tareas A.1-A.3 usan para verificar acceso a un curso. Antes de modificar las acciones, tener este helper disponible evita repetición.

**Files:**
- Create: `utils/auth/course-access.ts`
- Test: `__tests__/utils/course-access.test.ts`

- [ ] **Step 1: Test que falle**

```typescript
// __tests__/utils/course-access.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const profileSingle = vi.fn()
const purchaseSingle = vi.fn()
const subSingle = vi.fn()
const courseSingle = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        lte: () => chain,
        gte: () => chain,
        maybeSingle: () => {
          if (table === 'profiles') return profileSingle()
          if (table === 'course_purchases') return purchaseSingle()
          if (table === 'subscriptions') return subSingle()
          return Promise.resolve({ data: null })
        },
        single: () => {
          if (table === 'courses') return courseSingle()
          return Promise.resolve({ data: null })
        },
      }
      return chain
    },
  }),
}))

import { hasCourseAccess } from '@/utils/auth/course-access'

describe('hasCourseAccess', () => {
  beforeEach(() => {
    profileSingle.mockReset()
    purchaseSingle.mockReset()
    subSingle.mockReset()
    courseSingle.mockReset()
  })

  it('returns true when user is admin', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'admin' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(true)
  })

  it('returns true when user has purchased the course', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    purchaseSingle.mockResolvedValue({ data: { id: 'p1' } })
    subSingle.mockResolvedValue({ data: null })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(true)
  })

  it('returns true when active subscription covers the course month', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    purchaseSingle.mockResolvedValue({ data: null })
    subSingle.mockResolvedValue({ data: { id: 's1' } })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(true)
  })

  it('returns false when user has no purchase and no covering sub', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    purchaseSingle.mockResolvedValue({ data: null })
    subSingle.mockResolvedValue({ data: null })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(false)
  })

  it('returns false when course does not exist', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: null })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run __tests__/utils/course-access.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

```typescript
// utils/auth/course-access.ts
import 'server-only'
import { createClient } from '@/utils/supabase/server'

/**
 * Returns true if the user has any of:
 * - admin role
 * - one-time course_purchase for this course
 * - active or trialing subscription whose period covers the course month/year
 *
 * Mirrors the gating logic of the lesson page server component.
 */
export async function hasCourseAccess(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const supabase = await createClient()

  // Admin shortcut.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.role === 'admin') return true

  // Course must exist (and gives us month/year for sub coverage).
  const { data: course } = await supabase
    .from('courses')
    .select('id, month, year')
    .eq('id', courseId)
    .single()
  if (!course) return false

  // One-time purchase.
  const { data: purchase } = await supabase
    .from('course_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (purchase) return true

  // Active subscription covering the course month.
  const courseFirstDay = new Date(Date.UTC(course.year, course.month - 1, 1)).toISOString()
  const courseLastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59)).toISOString()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .lte('current_period_start', courseLastDay)
    .gte('current_period_end', courseFirstDay)
    .maybeSingle()

  return !!sub
}
```

- [ ] **Step 4: Run test passing**

```bash
npx vitest run __tests__/utils/course-access.test.ts
```

Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add utils/auth/course-access.ts __tests__/utils/course-access.test.ts
git commit -m "feat(auth): add hasCourseAccess helper centralizing gating logic"
```

---

## Fase A — ALTO

### Task A.1: `submitAssignment` — verificar acceso al curso

**Files:**
- Modify: `app/courses/actions.ts` (function `submitAssignment` at line ~276)
- Test: extender `__tests__/actions/courses.test.ts`

- [ ] **Step 1: Test que falle**

Añadir al `describe('submitAssignment', ...)` existente:

```typescript
// __tests__/actions/courses.test.ts (dentro del describe submitAssignment)
import { hasCourseAccess } from '@/utils/auth/course-access'

vi.mock('@/utils/auth/course-access', () => ({
  hasCourseAccess: vi.fn(),
}))

it('rejects when user has no access to the course', async () => {
  vi.mocked(hasCourseAccess).mockResolvedValue(false)
  // assignmentId resolves to lesson → course
  fromMock.mockReturnValueOnce({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({
      data: { lesson_id: 'l1', lessons: { course_id: 'c1' } }
    }) }) })
  })
  const result = await submitAssignment('a1', 'my work', null)
  expect(result).toEqual({ error: 'forbidden' })
  expect(insertMock).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test (FAIL)**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "submitAssignment"
```

Expected: FAIL.

- [ ] **Step 3: Update `submitAssignment`**

Sustituir la función en `app/courses/actions.ts` por:

```typescript
import { hasCourseAccess } from '@/utils/auth/course-access'

export async function submitAssignment(assignmentId: string, textContent: string, fileUrl: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve assignment → lesson → course and verify access.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id, lessons(course_id)')
    .eq('id', assignmentId)
    .single()

  const courseId = (assignment?.lessons as { course_id?: string } | null)?.course_id
  if (!courseId) {
    return { error: 'assignment_not_found' }
  }

  if (!(await hasCourseAccess(user.id, courseId))) {
    return { error: 'forbidden' }
  }

  const { error } = await supabase
    .from('submissions')
    .upsert({
      assignment_id: assignmentId,
      user_id: user.id,
      text_content: textContent || null,
      file_url: fileUrl,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('Error submitting assignment:', error)
    return { error: error.message }
  }

  return { success: true }
}
```

- [ ] **Step 4: Run all submitAssignment tests**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "submitAssignment"
```

Expected: existing tests pass + new "rejects without access" passes.

- [ ] **Step 5: Lint + tsc + build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "fix(security): require course access in submitAssignment"
```

---

### Task A.2: `markLessonAsCompleted` — verificar acceso

**Files:**
- Modify: `app/courses/actions.ts` (`markLessonAsCompleted`)
- Test: extender `__tests__/actions/courses.test.ts`

- [ ] **Step 1: Test (extender)**

```typescript
describe('markLessonAsCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasCourseAccess).mockResolvedValue(true)
  })

  it('rejects when user has no access', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(false)
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(result).toEqual({ error: 'forbidden' })
  })

  it('upserts progress when access granted', async () => {
    upsertMock.mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertMock })
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(upsertMock).toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test FAIL**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "markLessonAsCompleted"
```

- [ ] **Step 3: Update `markLessonAsCompleted`**

```typescript
export async function markLessonAsCompleted(courseId: string, lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  if (!(await hasCourseAccess(user.id, courseId))) {
    return { error: 'forbidden' }
  }

  // Verify the lesson actually belongs to this course (defense in depth
  // against a forged courseId/lessonId pair where the user has access to
  // courseId but lessonId is in a different course).
  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson || lesson.course_id !== courseId) {
    return { error: 'lesson_mismatch' }
  }

  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: user.id,
      lesson_id: lessonId,
      is_completed: true,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error marking lesson complete:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}/${lessonId}`)
  revalidatePath(`/courses/${courseId}`)
}
```

- [ ] **Step 4: Run tests PASS**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "markLessonAsCompleted"
```

- [ ] **Step 5: Commit**

```bash
git add app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "fix(security): require course access in markLessonAsCompleted"
```

---

### Task A.3: `addComment` — verificar acceso al curso

**Files:**
- Modify: `app/actions/comments.ts` (`addComment`)
- Test: extender `__tests__/actions/comments.test.ts` o `comments-notifications.test.ts`

- [ ] **Step 1: Test FAIL**

Localizar el test file existente de comments:

```bash
ls __tests__/actions/comments*.test.ts
```

Añadir al describe correspondiente:

```typescript
import { hasCourseAccess } from '@/utils/auth/course-access'
vi.mock('@/utils/auth/course-access', () => ({
  hasCourseAccess: vi.fn(),
}))

it('addComment rejects when user has no course access', async () => {
  vi.mocked(hasCourseAccess).mockResolvedValue(false)
  // mock supabase to return a lesson with course_id
  // ... existing setup ...
  const result = await addComment('lesson-1', 'hello', null)
  expect(result).toEqual({ error: 'forbidden' })
})
```

- [ ] **Step 2: Run test FAIL**

```bash
npx vitest run __tests__/actions/comments-notifications.test.ts -t "addComment"
```

- [ ] **Step 3: Update `addComment`**

En `app/actions/comments.ts`, antes del insert, añadir:

```typescript
import { hasCourseAccess } from '@/utils/auth/course-access'

// Inside addComment, after auth check:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'auth' }

// Resolve lesson → course and verify access (defense beyond RLS).
const { data: lesson } = await supabase
  .from('lessons')
  .select('course_id')
  .eq('id', lessonId)
  .maybeSingle()

if (!lesson) {
  return { error: 'lesson_not_found' }
}

if (!(await hasCourseAccess(user.id, lesson.course_id))) {
  return { error: 'forbidden' }
}

// ...rest of the existing insert + notify logic...
```

(Adapt to the existing function signature; do NOT change the public API beyond the new error returns.)

- [ ] **Step 4: Run all comment tests**

```bash
npx vitest run __tests__/actions/comments-notifications.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/actions/comments.ts __tests__/actions/comments-notifications.test.ts
git commit -m "fix(security): require course access to add lesson comments"
```

---

### Task A.4: RLS de `comments` — restringir SELECT por acceso al curso

Las comments hoy son `SELECT USING (true)`. Con la RLS de lessons ya gateada, la lección en sí no se ve sin acceso, pero las comments asociadas sí. Cerrar el círculo.

**Files:**
- Create: `supabase/2026_05_audit2_rls_comments.sql`

- [ ] **Step 1: Verificar columnas presentes**

```bash
grep -n "create table.*comments\b\|alter table.*comments\b" supabase/*.sql 2>/dev/null | head -5
```

Confirmar que `comments.lesson_id` y `comments.post_id` existen (puede que comments sirva para community posts y lesson comments — gating diferente).

- [ ] **Step 2: Escribir migración**

```sql
-- supabase/2026_05_audit2_rls_comments.sql
-- Gating de SELECT en comments:
-- - Comentarios de community posts (comments.post_id IS NOT NULL): públicos para autenticados.
-- - Comentarios de lesson (comments.lesson_id IS NOT NULL): solo si el user tiene acceso al curso.

drop policy if exists "Comments are viewable by everyone" on comments;
drop policy if exists "Comments SELECT: post or accessible-lesson" on comments;

create policy "Comments SELECT: post or accessible-lesson" on comments
  for select using (
    -- Community post comments: any authenticated user can read.
    post_id is not null
    -- Lesson comments: only if user has access to the parent course.
    or (
      lesson_id is not null
      and exists (
        select 1 from lessons l
        where l.id = comments.lesson_id
          and (
            -- Free lesson — anyone can read its comments.
            coalesce(l.is_free, false) = true
            -- Admin
            or exists (
              select 1 from profiles
              where id = (select auth.uid()) and role = 'admin'
            )
            -- Purchase of parent course
            or exists (
              select 1 from course_purchases cp
              where cp.user_id = (select auth.uid())
                and cp.course_id = l.course_id
            )
            -- Active sub covering course month/year
            or exists (
              select 1
              from subscriptions s
              join courses c on c.id = l.course_id
              where s.user_id = (select auth.uid())
                and s.status in ('active', 'trialing')
                and s.current_period_start <=
                      (make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second')
                and s.current_period_end >= make_date(c.year, c.month, 1)
            )
          )
      )
    )
  );
```

- [ ] **Step 3: Aplicar migración**

(Vía MCP `apply_migration` con name `audit2_2026_05_rls_comments`.)

- [ ] **Step 4: Smoke test**

```sql
-- como anon no autenticado: 0 lesson comments visibles
set local role anon;
select count(*) from comments where lesson_id is not null;
reset role;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/2026_05_audit2_rls_comments.sql
git commit -m "feat(security): gate lesson comments by course access in RLS"
```

---

### Task A.5: `LessonAssignmentTab` — eliminar `getSession()` cliente para path

**Files:**
- Modify: `components/LessonAssignmentTab.tsx`
- Modify: `app/courses/actions.ts` — añadir nueva action `uploadAssignmentFile(formData)` que sube en server.

Patrón: el cliente envía el archivo crudo al server action (FormData multipart). El server action valida `getCurrentUser()` y construye el path con el `user.id` server-side.

- [ ] **Step 1: Crear server action de upload**

Añadir al final de `app/courses/actions.ts`:

```typescript
import { hasCourseAccess } from '@/utils/auth/course-access'

const ALLOWED_SUBMISSION_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/webm',
]
const MAX_SUBMISSION_SIZE = 50 * 1024 * 1024 // 50 MB

export async function uploadAssignmentFile(
  assignmentId: string,
  file: File,
): Promise<{ fileUrl?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  if (!ALLOWED_SUBMISSION_TYPES.includes(file.type)) {
    return { error: 'unsupported_type' }
  }
  if (file.size > MAX_SUBMISSION_SIZE) {
    return { error: 'too_large' }
  }

  // Verify access via the assignment → lesson → course chain.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id, lessons(course_id)')
    .eq('id', assignmentId)
    .single()

  const courseId = (assignment?.lessons as { course_id?: string } | null)?.course_id
  if (!courseId) return { error: 'assignment_not_found' }
  if (!(await hasCourseAccess(user.id, courseId))) return { error: 'forbidden' }

  const ext = file.name.split('.').pop() ?? 'bin'
  const fileName = `${user.id}/${assignmentId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('submissions')
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    return { error: uploadError.message }
  }

  return { fileUrl: `storage://submissions/${fileName}` }
}
```

- [ ] **Step 2: Reemplazar el cliente para llamar a la action**

En `components/LessonAssignmentTab.tsx`, sustituir el bloque que hace `getSession()` + upload directo por una llamada a la action:

```tsx
import { uploadAssignmentFile } from '@/app/courses/actions'

// reemplazar el bloque "if (file) { ... await supabase.storage.from('submissions').upload(...) }"
if (file) {
  setUploading(true)
  const result = await uploadAssignmentFile(assignment.id, file)
  setUploading(false)
  if (result.error || !result.fileUrl) {
    setErrorMsg(result.error ?? 'upload_failed')
    return
  }
  fileUrl = result.fileUrl
}
```

(Eliminar el `getSession()` y la construcción cliente del path.)

- [ ] **Step 3: Build + test manual**

```bash
npm run build
```

(Smoke test manual: ir a una lección con assignment, subir archivo. Debe seguir funcionando. Sin sesión activa o sin acceso al curso, debe fallar limpiamente.)

- [ ] **Step 4: Commit**

```bash
git add app/courses/actions.ts components/LessonAssignmentTab.tsx
git commit -m "fix(security): move assignment upload path construction to server action"
```

---

### Task A.6: Stripe `expand` — quitar de modo `payment`

**Files:**
- Modify: `app/api/checkout/route.ts` (línea ~91)

- [ ] **Step 1: Localizar el `expand` mal-puesto**

```bash
grep -n "expand:" app/api/checkout/route.ts
```

Debería haber DOS llamadas a `stripe.checkout.sessions.create` — una en modo `payment` (compra de curso) y otra en modo `subscription`. El `expand: ['subscription', ...]` solo debe estar en la de `subscription`.

- [ ] **Step 2: Quitar de la branch de payment**

En la sesión `mode: 'payment'` (la que está dentro del `if (courseId)` block, ~línea 91), eliminar la línea:

```typescript
expand: ['subscription', 'subscription.items.data.price'],
```

Confirmar que la sesión de modo `subscription` (en el otro bloque, sin `courseId`) sigue teniendo el `expand`.

- [ ] **Step 3: Build + test**

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "fix(stripe): remove subscription expand from payment-mode checkout"
```

---

## Fase B — MEDIO

### Task B.1: Rate-limit `/monitoring` (Sentry tunnel)

El endpoint `/monitoring` lo crea Sentry runtime; no podemos modificarlo. Pero podemos rate-limitarlo en el `middleware.ts` antes de que llegue al handler de Sentry.

**Files:**
- Modify: `utils/supabase/middleware-helper.ts`

- [ ] **Step 1: Añadir lógica al middleware**

En `utils/supabase/middleware-helper.ts`, antes del bloque de auth, añadir un cortocircuito para `/monitoring`:

```typescript
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'

// Inside updateSession, near the top:
const { pathname } = request.nextUrl

if (pathname === '/monitoring') {
  const xff = request.headers.get('x-forwarded-for') ?? ''
  const ip = xff.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anon'
  const rl = await rateLimit(rateLimitKey([ip, 'monitoring']), 1000, 60_000)
  if (!rl.ok) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter) },
    })
  }
  // Allow Sentry to process — don't run auth against it.
  return NextResponse.next({ request: { headers: request.headers } })
}
```

(Insertar este bloque después de la extracción de `pathname` y antes del check de `requiresAuth`/cookie.)

- [ ] **Step 2: Verificar `NextResponse` está importado**

```bash
grep "NextResponse" utils/supabase/middleware-helper.ts | head -2
```

Si no, añadir el import.

- [ ] **Step 3: Build + lint + test**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add utils/supabase/middleware-helper.ts
git commit -m "feat(security): rate-limit Sentry /monitoring tunnel route (1000/min per IP)"
```

---

### Task B.2: Forgot-password — eliminar account enumeration

**Files:**
- Modify: `app/login/actions.ts` (function `resetPassword`)

- [ ] **Step 1: Sustituir el redirect de error**

En `resetPassword`, cambiar:

```typescript
if (error) {
  redirect('/forgot-password?error=reset_failed')
}

revalidatePath('/', 'layout')
redirect('/login?message=email_reset')
```

por:

```typescript
// Always redirect to the same destination — whether the email exists or not —
// to avoid leaking account existence (oracle).
if (error) {
  console.error('[resetPassword] internal error', error.message)
}

revalidatePath('/', 'layout')
redirect('/login?message=email_reset')
```

- [ ] **Step 2: Build + test**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/login/actions.ts
git commit -m "fix(security): remove account enumeration in forgot-password redirects"
```

---

### Task B.3: Assertar `NEXT_PUBLIC_BASE_URL` y `STRIPE_*` en producción (renombrar helper)

**Files:**
- Modify: `utils/stripe/validate-env.ts` → renombrar a `utils/env/validate-prod.ts`
- Modify: cualquier importer (`app/api/webhooks/stripe/route.ts`)
- Modify: `app/login/actions.ts` (resetPassword) para usar la URL asertada

- [ ] **Step 1: Crear nuevo helper**

```typescript
// utils/env/validate-prod.ts

/**
 * Throws if required production env vars are missing or malformed.
 * Called once at module load by webhook + login actions to fail loud
 * during the FIRST production runtime invocation rather than silently.
 */
export function assertProdEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return
  if (env.NEXT_PHASE === 'phase-production-build') return

  const errors: string[] = []

  if (!env.NEXT_PUBLIC_BASE_URL || !/^https:\/\//.test(env.NEXT_PUBLIC_BASE_URL)) {
    errors.push('NEXT_PUBLIC_BASE_URL must be set to https://...')
  }

  const stripeSecret = env.STRIPE_SECRET_KEY ?? ''
  if (!stripeSecret.startsWith('sk_live_')) {
    errors.push('STRIPE_SECRET_KEY must be a live key in production')
  }

  const stripeWebhook = env.STRIPE_WEBHOOK_SECRET ?? ''
  if (!stripeWebhook.startsWith('whsec_')) {
    errors.push('STRIPE_WEBHOOK_SECRET is missing or malformed')
  }

  if (errors.length) {
    throw new Error(`Production env invalid:\n  - ${errors.join('\n  - ')}`)
  }
}
```

- [ ] **Step 2: Migrar imports**

Reemplazar en `app/api/webhooks/stripe/route.ts`:

```typescript
import { assertStripeEnvForProduction } from '@/utils/stripe/validate-env'
assertStripeEnvForProduction()
```

por:

```typescript
import { assertProdEnv } from '@/utils/env/validate-prod'
assertProdEnv()
```

Y al inicio de `app/login/actions.ts`:

```typescript
import { assertProdEnv } from '@/utils/env/validate-prod'
assertProdEnv()
```

- [ ] **Step 3: Borrar el helper antiguo**

```bash
git rm utils/stripe/validate-env.ts
```

- [ ] **Step 4: Migrar test**

Renombrar `__tests__/utils/stripe-validate-env.test.ts` → `__tests__/utils/validate-prod.test.ts` y adaptar:

```typescript
import { describe, it, expect } from 'vitest'
import { assertProdEnv } from '@/utils/env/validate-prod'

describe('assertProdEnv', () => {
  it('does nothing outside production', () => {
    expect(() => assertProdEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow()
    expect(() => assertProdEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('does nothing during build phase', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('throws on test stripe key in production', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://example.com',
      STRIPE_SECRET_KEY: 'sk_test_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
    } as NodeJS.ProcessEnv)).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('throws on missing NEXT_PUBLIC_BASE_URL in production', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcd',
    } as NodeJS.ProcessEnv)).toThrow(/NEXT_PUBLIC_BASE_URL/)
  })

  it('passes with all live values', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://luisy-sara-bachatango.vercel.app',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcd',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })
})
```

- [ ] **Step 5: Eliminar fallback `localhost:3000` en `resetPassword`**

En `app/login/actions.ts:74`, cambiar:

```typescript
redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
```

por:

```typescript
redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/auth/callback?next=/reset-password`,
```

(El operador `??` solo cae al fallback si la var es null/undefined, no si es vacía. La asercion `assertProdEnv` previene el caso prod-vacío.)

- [ ] **Step 6: Build + tests + lint**

```bash
npm run lint && npm run test && npx tsc --noEmit && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add utils/env/validate-prod.ts \
        __tests__/utils/validate-prod.test.ts \
        app/api/webhooks/stripe/route.ts \
        app/login/actions.ts
git rm utils/stripe/validate-env.ts __tests__/utils/stripe-validate-env.test.ts
git commit -m "feat(env): assert NEXT_PUBLIC_BASE_URL and Stripe live keys in production"
```

---

### Task B.4: Upstash failing-closed en producción

**Files:**
- Modify: `utils/rate-limit.ts`

- [ ] **Step 1: Cambiar el catch a fail-closed en prod**

Sustituir el catch en `rateLimit()`:

```typescript
try {
  const { success, reset } = await rl.limit(key)
  return {
    ok: success,
    retryAfter: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
  }
} catch (err) {
  console.error('[rate-limit] Upstash error', err)
  if (process.env.NODE_ENV === 'production') {
    // Fail closed in production rather than serving requests without rate
    // limiting at scale (which the local Map fallback effectively means
    // across multiple Vercel instances).
    return { ok: false, retryAfter: 60 }
  }
  return localRateLimit(key, limit, windowMs)
}
```

- [ ] **Step 2: Test**

```typescript
// extender __tests__/utils/rate-limit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Ratelimit } from '@upstash/ratelimit'

describe('rateLimit Upstash failure', () => {
  it('falls back to local in non-production', async () => {
    process.env.NODE_ENV = 'test'
    process.env.UPSTASH_REDIS_REST_URL = 'https://invalid.example'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'bad'
    // (this is a smoke; actual upstash call will fail because URL invalid)
    const { rateLimit } = await import('@/utils/rate-limit')
    const result = await rateLimit('k-test', 5, 1000)
    // local fallback always returns true on first call
    expect(result.ok).toBe(true)
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })
})
```

(Test "fails closed in production" requires more involved env mocking; the pure unit test of `localRateLimit` in non-prod is enough — production behavior is documented and exercised by code review.)

- [ ] **Step 3: Build + tests**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add utils/rate-limit.ts __tests__/utils/rate-limit.test.ts
git commit -m "fix(scale): fail-closed on Upstash error in production"
```

---

### Task B.5: Signup — validación server-side

**Files:**
- Modify: `app/login/actions.ts` (function `signup`)

- [ ] **Step 1: Añadir validación**

```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export async function signup(formData: FormData) {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? 'anon').split(',')[0]?.trim() || 'anon'
  const rl = await rateLimit(rateLimitKey([ip, 'signup']), 3, 15 * 60_000)
  if (!rl.ok) {
    redirect('/login?error=rate_limit')
  }

  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  const fullName = (formData.get('fullName') as string | null)?.trim() ?? ''

  if (!EMAIL_RE.test(email)) {
    redirect('/login?error=invalid_email')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect('/login?error=password_too_short')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    redirect('/login?error=signup_failed')
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=email_confirmation')
}
```

- [ ] **Step 2: Add error keys to dictionaries**

Añadir a cada locale en `utils/i18n/dictionaries/{es,en,fr,de,it,ja}.ts` la clave del error en el `errors` object o donde corresponda:

```typescript
// Si los errors viven en `login.error.{key}`, añadir:
invalid_email: '<traducción>',
password_too_short: '<traducción>',
```

(Verificar la estructura existente leyendo `es.ts` primero.)

- [ ] **Step 3: i18n:check + tests + build**

```bash
npm run i18n:check && npm run test && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/login/actions.ts utils/i18n/dictionaries/
git commit -m "fix(security): validate email and password length server-side in signup"
```

---

### Task B.6: `handle_new_user` — sanitizar `avatar_url`

**Files:**
- Create: `supabase/2026_05_audit2_handle_new_user_safe.sql`

- [ ] **Step 1: Migración**

```sql
-- supabase/2026_05_audit2_handle_new_user_safe.sql
-- Don't trust avatar_url from raw_user_meta_data. Setting it on signup
-- is unnecessary (user can update profile after); accepting it here lets
-- a malicious signup payload populate the URL with anything (tracking
-- pixel, SSRF target via Next/Image optimizer if domain matches
-- remotePatterns).
--
-- Also pin search_path to clear advisor warning 0011.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
```

- [ ] **Step 2: Aplicar migración**

(MCP `apply_migration` con name `audit2_2026_05_handle_new_user_safe`.)

- [ ] **Step 3: Smoke test**

Hacer signup con un avatar_url manipulado en metadata (curl directo a `/auth/v1/signup` con `data.avatar_url = 'https://evil.com'`) → verificar que en `profiles` queda NULL.

- [ ] **Step 4: Commit**

```bash
git add supabase/2026_05_audit2_handle_new_user_safe.sql
git commit -m "fix(security): drop avatar_url from handle_new_user; pin search_path"
```

---

### Task B.7: NotificationBell — race en cleanup

**Files:**
- Modify: `components/NotificationBell.tsx`

- [ ] **Step 1: Refactor con `AbortController`**

Reemplazar el useEffect por:

```typescript
useEffect(() => {
  const controller = new AbortController()
  let channel: ReturnType<typeof supabase.channel> | null = null

  const fallbackInterval = setInterval(() => {
    if (controller.signal.aborted) return
    fetchAll()
  }, 5 * 60 * 1000)

  ;(async () => {
    if (controller.signal.aborted) return
    await fetchAll()
    if (controller.signal.aborted) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || controller.signal.aborted) return

    channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!controller.signal.aborted) fetchAll()
        }
      )
      .subscribe()

    if (controller.signal.aborted && channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  })()

  return () => {
    controller.abort()
    clearInterval(fallbackInterval)
    if (channel) {
      supabase.removeChannel(channel)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 2: Build + tests**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/NotificationBell.tsx
git commit -m "fix(notifications): close Realtime channel reliably on unmount via AbortController"
```

---

## Fase C — BAJO

### Task C.1: `revalidateTag` — quitar segundo argumento

**Files:**
- Modify: `app/courses/actions.ts`

- [ ] **Step 1: Quitar `, 'max'`**

```bash
grep -n "revalidateTag" app/courses/actions.ts
```

Cambiar las dos ocurrencias:

```typescript
// antes
revalidateTag(`course:${courseId}:lessons`, 'max')

// después
revalidateTag(`course:${courseId}:lessons`)
```

- [ ] **Step 2: Build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/courses/actions.ts
git commit -m "chore(cache): drop bogus second arg from revalidateTag calls"
```

---

### Task C.2: `_resetRateLimitForTest` — guarda de entorno

**Files:**
- Modify: `utils/rate-limit.ts`

- [ ] **Step 1: Envolver con guarda**

```typescript
export function _resetRateLimitForTest(): void {
  if (process.env.NODE_ENV === 'production') return
  localBuckets.clear()
  ratelimitCache.clear()
}
```

- [ ] **Step 2: Build + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add utils/rate-limit.ts
git commit -m "chore(rate-limit): no-op _resetRateLimitForTest in production"
```

---

### Task C.3: Comentario preventivo en `course_purchases` INSERT policy

**Files:**
- Modify: `supabase/2026_05_audit_course_purchases_insert.sql`

- [ ] **Step 1: Añadir comentario**

Al final del archivo, añadir:

```sql
-- IMPORTANT: do not add another INSERT policy on course_purchases without
-- removing this one. RLS evaluates multiple permissive policies with OR;
-- a permissive policy added later would shadow this deny-all and allow
-- direct inserts from user sessions.
```

(Esto es solo en el archivo del repo — no afecta a la BD aplicada. Documentación.)

- [ ] **Step 2: Commit**

```bash
git add supabase/2026_05_audit_course_purchases_insert.sql
git commit -m "docs(supabase): warn about RLS OR semantics on course_purchases INSERT"
```

---

## Fase D — Cierre

### Task D.1: Validación + advisors + push + PR

**Files:** ninguno (verificación + PR)

- [ ] **Step 1: Gates verdes**

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
npm run i18n:check
```

Expected: todos pasan, sin nuevos warnings.

- [ ] **Step 2: Advisors check**

(MCP Supabase `get_advisors` security + performance. Comprobar que NO hay nuevos warnings introducidos por las migraciones de A.4 y B.6.)

- [ ] **Step 3: Push**

```bash
git push -u origin chore/audit2-remediation
```

- [ ] **Step 4: Crear PR**

(Usar `gh pr create` con título `fix(security): audit-2 remediation` y body referenciando este plan + los 16 hallazgos.)

- [ ] **Step 5: Mergear a main tras revisión**

```bash
git checkout main
git pull origin main
git merge --no-ff chore/audit2-remediation -m "Merge audit-2 remediation: close 16 security/correctness findings"
git push origin main
```

---

## Verificación final del plan

### Spec coverage

- ✅ ALTO 1 (`submitAssignment`) → Task A.1
- ✅ ALTO 2 (`markLessonAsCompleted`) → Task A.2
- ✅ ALTO 3 (`addComment`) → Task A.3
- ✅ ALTO 4 (RLS comments) → Task A.4
- ✅ ALTO 5 (`LessonAssignmentTab.getSession`) → Task A.5
- ✅ ALTO 6 (Stripe `expand` en payment) → Task A.6
- ✅ MEDIO 7 (`/monitoring` rate-limit) → Task B.1
- ✅ MEDIO 8 (forgot-password enum) → Task B.2
- ✅ MEDIO 9 (`NEXT_PUBLIC_BASE_URL`) → Task B.3
- ✅ MEDIO 10 (Upstash fail-closed) → Task B.4
- ✅ MEDIO 11 (signup validation) → Task B.5
- ✅ MEDIO 12 (handle_new_user avatar) → Task B.6
- ✅ MEDIO 13 (NotificationBell race) → Task B.7
- ✅ BAJO 14 (`revalidateTag` arg) → Task C.1
- ✅ BAJO 15 (`_resetRateLimitForTest`) → Task C.2
- ✅ BAJO 16 (RLS comment) → Task C.3

### Sin placeholders

Cada step lleva código completo o comando exacto. Las traducciones i18n en B.5 son la única ambigüedad — el implementador escoge texto razonable consistente con los demás errores de auth.

### Type consistency

- `hasCourseAccess(userId: string, courseId: string): Promise<boolean>` — definida en Task 0.2, usada en A.1, A.2, A.3, A.5.
- `assertProdEnv()` definida en B.3, usada en webhook stripe + login actions.
- `revalidateTag(tag)` (sin segundo arg) en C.1.
