# Audit 3 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las 16 brechas identificadas en la tercera auditoría: 6 ALTO (admin actions sin ownership, social URLs sin whitelist, likes sin rate-limit, comment likes sin gating, Origin redirect en /api/checkout) + 7 MEDIO (avatar validation, Sentry PII, Mux webhook, admin maxLength, IP trust) + 3 BAJO.

**Architecture:** Crea 3 helpers compartidos (`utils/auth/client-ip.ts`, `utils/sanitize-social.ts`, `utils/uploads/magic-bytes.ts`) reutilizados en múltiples acciones (DRY). Endurece todos los call sites de admin actions con ownership cross-checks. Centraliza la validación de inputs admin con maxLength. Añade webhook Mux para eliminar el polling manual.

**Tech Stack:** Next.js 16 App Router · Supabase Pro · Stripe · Mux · Vitest · Upstash Redis · Sentry.

**Hallazgos descartados verificados como falsos positivos:** ninguno en este audit (cada hallazgo se verificó contra código real antes de redactar).

**Confirmados ya correctos sin task:** GDPR cascades, Stripe webhook idempotency, /api/mux/status admin gating, /api/lessons/next protegido por RLS, VTT sin XSS path, Stripe webhook signature.

---

## Fase 0 — Preparación

### Task 0.1: Crear rama y baseline

**Files:** ninguno (bootstrap)

- [ ] **Step 1: Branch desde main**

```bash
cd /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango
git checkout main
git pull origin main
git checkout -b chore/audit3-remediation
```

- [ ] **Step 2: Gates verdes**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
npm run i18n:check
```

Expected:
- test: 319 passed
- lint: 0 errors
- tsc: clean
- build: success
- i18n: aligned

Si algo falla, STOP y reportar BLOCKED.

- [ ] **Step 3: Commit marcador**

```bash
git commit --allow-empty -m "chore: start audit3-remediation branch"
```

---

### Task 0.2: Helper `getClientIp(request)`

Centraliza la extracción de IP del cliente, prefiriendo `x-vercel-forwarded-for` (validado por Vercel) sobre `x-forwarded-for` (cliente-controlable detrás de proxies).

**Files:**
- Create: `utils/auth/client-ip.ts`
- Test: `__tests__/utils/client-ip.test.ts`

- [ ] **Step 1: Test que falle**

```typescript
// __tests__/utils/client-ip.test.ts
import { describe, it, expect } from 'vitest'
import { getClientIp } from '@/utils/auth/client-ip'

function mkHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

describe('getClientIp', () => {
  it('prefers x-vercel-forwarded-for over x-forwarded-for', () => {
    const h = mkHeaders({
      'x-vercel-forwarded-for': '1.1.1.1',
      'x-forwarded-for': '2.2.2.2',
    })
    expect(getClientIp(h)).toBe('1.1.1.1')
  })

  it('falls back to first entry of x-forwarded-for', () => {
    const h = mkHeaders({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' })
    expect(getClientIp(h)).toBe('2.2.2.2')
  })

  it('falls back to x-real-ip', () => {
    const h = mkHeaders({ 'x-real-ip': '4.4.4.4' })
    expect(getClientIp(h)).toBe('4.4.4.4')
  })

  it('returns "anon" if nothing is present', () => {
    expect(getClientIp(mkHeaders({}))).toBe('anon')
  })

  it('trims whitespace from values', () => {
    expect(getClientIp(mkHeaders({ 'x-vercel-forwarded-for': '  5.5.5.5  ' }))).toBe('5.5.5.5')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run __tests__/utils/client-ip.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// utils/auth/client-ip.ts

/**
 * Extracts the client IP from request headers, preferring headers set by
 * the Vercel platform (which cannot be spoofed by the client).
 *
 * Order of preference:
 *   1. x-vercel-forwarded-for — Vercel-set, trusted.
 *   2. x-forwarded-for — first entry; reliable on Vercel because the
 *      platform overwrites client-supplied values; less reliable behind
 *      additional proxies.
 *   3. x-real-ip — fallback for some setups.
 *   4. 'anon' — nothing available.
 */
export function getClientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0]?.trim() || 'anon'

  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const real = headers.get('x-real-ip')
  if (real) return real.trim()

  return 'anon'
}
```

- [ ] **Step 4: Tests passing**

```bash
npx vitest run __tests__/utils/client-ip.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/auth/client-ip.ts __tests__/utils/client-ip.test.ts
git commit -m "feat(auth): add getClientIp helper preferring x-vercel-forwarded-for"
```

---

### Task 0.3: Helper `safeSocialUrl` con whitelist por dominio

Sustituye al `safeSocialUrl` actual que era solo un wrapper sin host check. Cada red social tiene su whitelist de hosts permitidos.

**Files:**
- Modify: `utils/sanitize.ts`
- Test: `__tests__/utils/sanitize.test.ts` (crear si no existe)

- [ ] **Step 1: Test**

```typescript
// __tests__/utils/sanitize.test.ts
import { describe, it, expect } from 'vitest'
import { safeSocialUrl, sanitizeUrl, safeAvatarUrl } from '@/utils/sanitize'

describe('safeSocialUrl', () => {
  it('accepts canonical Instagram hosts', () => {
    expect(safeSocialUrl('https://instagram.com/luis', 'instagram')).toBe('https://instagram.com/luis')
    expect(safeSocialUrl('https://www.instagram.com/luis', 'instagram')).toBe('https://www.instagram.com/luis')
  })

  it('rejects Instagram URL on a non-instagram host', () => {
    expect(safeSocialUrl('https://evil.com/instagram-fake', 'instagram')).toBeNull()
    expect(safeSocialUrl('https://instagrarn.com/x', 'instagram')).toBeNull()
  })

  it('accepts Facebook canonical and m.facebook', () => {
    expect(safeSocialUrl('https://facebook.com/luis', 'facebook')).toBe('https://facebook.com/luis')
    expect(safeSocialUrl('https://www.facebook.com/luis', 'facebook')).toBe('https://www.facebook.com/luis')
    expect(safeSocialUrl('https://m.facebook.com/luis', 'facebook')).toBe('https://m.facebook.com/luis')
  })

  it('accepts TikTok canonical', () => {
    expect(safeSocialUrl('https://www.tiktok.com/@luis', 'tiktok')).toBe('https://www.tiktok.com/@luis')
    expect(safeSocialUrl('https://tiktok.com/@luis', 'tiktok')).toBe('https://tiktok.com/@luis')
  })

  it('accepts YouTube canonical hosts', () => {
    expect(safeSocialUrl('https://youtube.com/@luis', 'youtube')).toBe('https://youtube.com/@luis')
    expect(safeSocialUrl('https://www.youtube.com/@luis', 'youtube')).toBe('https://www.youtube.com/@luis')
    expect(safeSocialUrl('https://youtu.be/abc', 'youtube')).toBe('https://youtu.be/abc')
  })

  it('rejects http (non-https)', () => {
    expect(safeSocialUrl('http://instagram.com/luis', 'instagram')).toBeNull()
  })

  it('rejects empty / null', () => {
    expect(safeSocialUrl(null, 'instagram')).toBeNull()
    expect(safeSocialUrl('', 'instagram')).toBeNull()
  })
})
```

- [ ] **Step 2: Implement (replace existing safeSocialUrl)**

In `utils/sanitize.ts`, replace the existing `safeSocialUrl` body. Keep `sanitizeUrl` and `safeAvatarUrl` untouched. New code:

```typescript
const SOCIAL_HOSTS: Record<string, ReadonlySet<string>> = {
  instagram: new Set(['instagram.com', 'www.instagram.com']),
  facebook: new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com']),
  tiktok: new Set(['tiktok.com', 'www.tiktok.com']),
  youtube: new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']),
}

export type SocialNetwork = keyof typeof SOCIAL_HOSTS

/**
 * Validates that a user-supplied URL is a HTTPS link to the canonical host
 * of a known social network. Rejects look-alike domains, http, and any URL
 * not on the whitelist. Returns the normalized URL or null.
 *
 * Use this at write time (when accepting profile updates), so untrusted
 * data never lands in the DB.
 */
export function safeSocialUrl(
  value: string | FormDataEntryValue | null | undefined,
  network: SocialNetwork,
): string | null {
  const url = sanitizeUrl(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    const allowed = SOCIAL_HOSTS[network]
    if (!allowed.has(parsed.hostname)) return null
    return url
  } catch {
    return null
  }
}
```

(NOTA: en `app/profile/actions.ts`, los call sites cambian de `sanitizeUrl(formData.get('instagram'))` a `safeSocialUrl(formData.get('instagram'), 'instagram')`. Esa migración se hace en Task A.3.)

- [ ] **Step 3: Tests passing**

```bash
npx vitest run __tests__/utils/sanitize.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add utils/sanitize.ts __tests__/utils/sanitize.test.ts
git commit -m "feat(security): safeSocialUrl now enforces per-network host whitelist"
```

---

### Task 0.4: Helper `validateImageMagicBytes`

Valida que un archivo subido tiene magic bytes consistentes con su `Content-Type`. Bloquea archivos disfrazados (PHP/JS con type=image/jpeg).

**Files:**
- Create: `utils/uploads/magic-bytes.ts`
- Test: `__tests__/utils/magic-bytes.test.ts`

- [ ] **Step 1: Test**

```typescript
// __tests__/utils/magic-bytes.test.ts
import { describe, it, expect } from 'vitest'
import { validateImageMagicBytes } from '@/utils/uploads/magic-bytes'

function mkFile(bytes: number[], type: string, name = 'f.jpg'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('validateImageMagicBytes', () => {
  it('accepts JPEG (FF D8 FF)', async () => {
    expect(await validateImageMagicBytes(mkFile([0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'))).toBe(true)
  })

  it('accepts PNG (89 50 4E 47)', async () => {
    expect(await validateImageMagicBytes(mkFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'))).toBe(true)
  })

  it('accepts WebP (RIFF + WEBP)', async () => {
    const bytes = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
    expect(await validateImageMagicBytes(mkFile(bytes, 'image/webp'))).toBe(true)
  })

  it('accepts GIF (GIF87a or GIF89a)', async () => {
    const gif89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
    const gif87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]
    expect(await validateImageMagicBytes(mkFile(gif89, 'image/gif'))).toBe(true)
    expect(await validateImageMagicBytes(mkFile(gif87, 'image/gif'))).toBe(true)
  })

  it('rejects PHP file disguised as JPEG', async () => {
    const php = [0x3c, 0x3f, 0x70, 0x68, 0x70] // <?php
    expect(await validateImageMagicBytes(mkFile(php, 'image/jpeg'))).toBe(false)
  })

  it('rejects unknown content-type', async () => {
    expect(await validateImageMagicBytes(mkFile([0xff, 0xd8, 0xff], 'application/octet-stream'))).toBe(false)
  })

  it('rejects file too small to fingerprint', async () => {
    expect(await validateImageMagicBytes(mkFile([0xff], 'image/jpeg'))).toBe(false)
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// utils/uploads/magic-bytes.ts

/**
 * Validates that the first bytes of a File match the magic bytes expected
 * for the declared MIME type. Defends against clients that lie about
 * Content-Type to upload disguised executables or scripts.
 *
 * Returns true if the bytes match the type, false otherwise (including
 * when the type is unsupported or the file is too small to fingerprint).
 */
const MAGIC_BYTES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/gif': b => b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
  'image/webp': b => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

export async function validateImageMagicBytes(file: File): Promise<boolean> {
  const matcher = MAGIC_BYTES[file.type]
  if (!matcher) return false
  const buf = await file.slice(0, 12).arrayBuffer()
  return matcher(new Uint8Array(buf))
}
```

- [ ] **Step 3: Tests passing**

```bash
npx vitest run __tests__/utils/magic-bytes.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add utils/uploads/magic-bytes.ts __tests__/utils/magic-bytes.test.ts
git commit -m "feat(security): add validateImageMagicBytes for upload content sniffing"
```

---

## Fase A — ALTO

### Task A.1: `gradeSubmission` — verificar ownership

`app/courses/actions.ts`. Validar que el `submissionId` pertenece al `courseId` recibido antes del update.

**Files:**
- Modify: `app/courses/actions.ts` (function `gradeSubmission`)
- Test: extender `__tests__/actions/courses.test.ts`

- [ ] **Step 1: Test que falle**

```typescript
// extender el describe('gradeSubmission', ...) o crearlo
describe('gradeSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
  })

  it('rejects when submission does not belong to courseId', async () => {
    // Mock the assignment join: submission.assignment.lesson.course_id = 'OTHER'
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { assignments: { lessons: { course_id: 'OTHER' } } }
      }) }) })
    })
    const result = await gradeSubmission('s1', 'A', 'good', 'c1', 'l1', 'u1')
    expect(result).toEqual({ error: 'submission_mismatch' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects when submission does not exist', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null }) }) })
    })
    const result = await gradeSubmission('bogus', 'A', 'good', 'c1', 'l1', 'u1')
    expect(result).toEqual({ error: 'submission_not_found' })
  })

  it('grades when submission belongs to courseId', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { assignments: { lessons: { course_id: 'c1' } } }
      }) }) })
    })
    fromMock.mockReturnValueOnce({
      update: updateMock,
    })
    updateMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    // notifications upsert mock — short-circuit (already covered by other tests)
    fromMock.mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })

    const result = await gradeSubmission('s1', 'A', 'good', 'c1', 'l1', 'u1')
    expect(result).toBeUndefined()
    expect(updateMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "gradeSubmission"
```

- [ ] **Step 3: Implement**

In `app/courses/actions.ts`, replace `gradeSubmission` body. Insert ownership check BEFORE the update:

```typescript
export async function gradeSubmission(
  submissionId: string,
  grade: string,
  feedback: string,
  courseId: string,
  lessonId: string,
  submittedUserId: string,
) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  // Verify submission belongs to the claimed courseId via:
  // submissions.assignment_id → assignments.lesson_id → lessons.course_id
  const { data: ownership } = await supabase
    .from('submissions')
    .select('assignments(lessons(course_id))')
    .eq('id', submissionId)
    .single()

  if (!ownership) {
    return { error: 'submission_not_found' }
  }

  const submissionCourseId =
    (ownership.assignments as { lessons?: { course_id?: string } } | null)
      ?.lessons?.course_id

  if (submissionCourseId !== courseId) {
    return { error: 'submission_mismatch' }
  }

  const { error } = await supabase
    .from('submissions')
    .update({ grade, feedback, status: 'reviewed', updated_at: new Date().toISOString() })
    .eq('id', submissionId)

  if (error) {
    console.error('Error grading submission:', error)
    return { error: error.message }
  }

  // ... rest of the existing notification + revalidatePath stays unchanged ...
  // (copy the existing code from `// Notify the student` onward verbatim)
}
```

(Importante: COPIAR el bloque de notificación tal cual está hoy — no tocarlo.)

- [ ] **Step 4: Tests passing + suite verde**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "gradeSubmission"
npm run test
npm run lint && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "fix(security): require submission to belong to courseId in gradeSubmission"
```

---

### Task A.2: `updateAssignment` y `deleteAssignment` — ownership check

**Files:**
- Modify: `app/courses/actions.ts`
- Test: extender `__tests__/actions/courses.test.ts`

- [ ] **Step 1: Tests que fallen**

```typescript
describe('updateAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
  })

  it('rejects when assignment does not belong to lessonId', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { lesson_id: 'OTHER' }
      }) }) })
    })
    const result = await updateAssignment('a1', 'title', 'desc', 'c1', 'l1')
    expect(result).toEqual({ error: 'assignment_mismatch' })
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('deleteAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
  })

  it('rejects when assignment does not belong to lessonId', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { lesson_id: 'OTHER' }
      }) }) })
    })
    const result = await deleteAssignment('a1', 'c1', 'l1')
    expect(result).toEqual({ error: 'assignment_mismatch' })
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npx vitest run __tests__/actions/courses.test.ts -t "updateAssignment\|deleteAssignment"
```

- [ ] **Step 3: Implement**

Update `updateAssignment`:

```typescript
export async function updateAssignment(assignmentId: string, title: string, description: string, courseId: string, lessonId: string) {
  await requireAdmin()
  const supabase = await createClient()

  // Ownership: confirm assignment belongs to lessonId.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return { error: 'assignment_not_found' }
  if (assignment.lesson_id !== lessonId) return { error: 'assignment_mismatch' }

  const { error } = await supabase
    .from('assignments')
    .update({ title, description })
    .eq('id', assignmentId)

  if (error) {
    console.error('Error updating assignment:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}/${lessonId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}/edit`)
}
```

Same for `deleteAssignment` (read its current body, add the same ownership check before the delete).

- [ ] **Step 4: Tests passing**

```bash
npx vitest run __tests__/actions/courses.test.ts
npm run test && npm run lint && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "fix(security): require assignment to belong to lessonId in update/delete"
```

---

### Task A.3: `updateProfile` usa `safeSocialUrl` con whitelist

**Files:**
- Modify: `app/profile/actions.ts`
- Test: extender `__tests__/actions/updateProfile.test.ts` si existe, o crear smoke test inline

- [ ] **Step 1: Cambiar imports y call sites**

En `app/profile/actions.ts`, líneas 6 y 57-60, sustituir:

```typescript
import { sanitizeUrl, safeAvatarUrl } from '@/utils/sanitize'
// ...
const instagram = sanitizeUrl(formData.get('instagram'))
const facebook = sanitizeUrl(formData.get('facebook'))
const tiktok = sanitizeUrl(formData.get('tiktok'))
const youtube = sanitizeUrl(formData.get('youtube'))
```

por:

```typescript
import { safeSocialUrl, safeAvatarUrl } from '@/utils/sanitize'
// ...
const instagram = safeSocialUrl(formData.get('instagram'), 'instagram')
const facebook = safeSocialUrl(formData.get('facebook'), 'facebook')
const tiktok = safeSocialUrl(formData.get('tiktok'), 'tiktok')
const youtube = safeSocialUrl(formData.get('youtube'), 'youtube')
```

(El import de `sanitizeUrl` se quita porque `safeSocialUrl` lo llama internamente.)

- [ ] **Step 2: Verificar gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si hay tests existentes para `updateProfile` que pasaban URLs con dominios no canónicos, actualizar. Si `sanitizeUrl` se usa en OTROS sitios, déjalos como están (solo cambiar el profile action).

- [ ] **Step 3: Commit**

```bash
git add app/profile/actions.ts
git commit -m "fix(security): apply social-host whitelist when storing profile URLs"
```

---

### Task A.4: Rate-limit en `togglePostLike` y `toggleLike` (comment)

**Files:**
- Modify: `app/actions/community-likes.ts`
- Modify: `app/actions/comments.ts`

- [ ] **Step 1: Modify `togglePostLike`**

Añadir al inicio de la función, después de `if (!user) return { error: ... }`:

```typescript
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
// ...
const rl = await rateLimit(rateLimitKey([user.id, 'post-like']), 60, 60_000)
if (!rl.ok) {
  return { error: 'rate_limit' }
}
```

(60 toggles/min por user es generoso para uso humano legítimo y bloquea scripts.)

- [ ] **Step 2: Modify `toggleLike` (comment)**

En `app/actions/comments.ts`, función `toggleLike`. Añadir el mismo bloque tras el auth check:

```typescript
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
// ...
const rl = await rateLimit(rateLimitKey([user.id, 'comment-like']), 60, 60_000)
if (!rl.ok) {
  return { error: 'rate_limit' }
}
```

- [ ] **Step 3: Verificar imports + gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si los tests existentes para `togglePostLike` o `toggleLike` no mockean `@/utils/rate-limit`, los `rateLimit` reales del fallback in-memory funcionarán pero pueden interferir entre tests. Si fallan, añade en el setup del describe:

```typescript
vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
  _resetRateLimitForTest: vi.fn(),
}))
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/community-likes.ts app/actions/comments.ts
git commit -m "feat(security): rate-limit post and comment like toggles (60/min per user)"
```

---

### Task A.5: `toggleLike` (comment) verifica acceso al curso

**Files:**
- Modify: `app/actions/comments.ts` (function `toggleLike`)

- [ ] **Step 1: Test que falle**

Buscar el archivo de test:

```bash
ls __tests__/actions/comment*.test.ts
```

Añadir al describe correspondiente:

```typescript
import { hasCourseAccess } from '@/utils/auth/course-access'
vi.mock('@/utils/auth/course-access', () => ({
  hasCourseAccess: vi.fn(),
}))

describe('toggleLike (comment)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when comment is on a paid lesson and user has no access', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(false)
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { id: 'c1', user_id: 'other', lesson_id: 'l1', post_id: null }
      }) }) })
    })
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { course_id: 'paid' }
      }) }) })
    })
    const result = await toggleLike('c1')
    expect(result).toEqual({ error: 'forbidden' })
  })

  it('allows when comment is on a community post (no lesson)', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { id: 'c1', user_id: 'other', lesson_id: null, post_id: 'p1' }
      }) }) })
    })
    // existing-like check returns null; insert succeeds
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null }) }) }) })
    })
    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null })
    })
    const result = await toggleLike('c1')
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Implement**

En `app/actions/comments.ts`, función `toggleLike`. Tras leer el comment y ANTES de tocar `comment_likes`:

```typescript
import { hasCourseAccess } from '@/utils/auth/course-access'

// after fetching the comment:
if (!comment) return { error: 'Comentario no encontrado' }

// Lesson comments require course access. Post comments (community) don't.
if (comment.lesson_id) {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id')
    .eq('id', comment.lesson_id)
    .single()
  if (!lesson) return { error: 'lesson_not_found' }
  if (!(await hasCourseAccess(user.id, lesson.course_id))) {
    return { error: 'forbidden' }
  }
}

// rest of toggleLike unchanged ...
```

- [ ] **Step 3: Tests passing**

```bash
npx vitest run __tests__/actions/comment*.test.ts
npm run test && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/comments.ts __tests__/actions/comment*.test.ts
git commit -m "fix(security): require course access for liking lesson comments"
```

---

### Task A.6: Allowlist de Origin en `/api/checkout`

**Files:**
- Modify: `app/api/checkout/route.ts`

- [ ] **Step 1: Reemplazar lectura del header**

Sustituir:

```typescript
const origin = req.headers.get('origin') ?? '';
```

por:

```typescript
// Origin must be the canonical site. Stripe success_url is built with this
// and a malicious Origin header would let an attacker phish the user after
// payment. Fall back to NEXT_PUBLIC_BASE_URL (asserted at startup in prod).
const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';
```

(Eliminar `req.headers.get('origin')` por completo. La env var ya se asserta `https://...` en producción por `assertProdEnv` (audit2).)

Si en dev se necesita seguir funcionando con `localhost:3000`, asegurarse que `.env.local` tenga `NEXT_PUBLIC_BASE_URL=http://localhost:3000`. La asserción de prod no afecta dev.

- [ ] **Step 2: Verificar gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "fix(security): use NEXT_PUBLIC_BASE_URL instead of Origin header for Stripe URLs"
```

---

## Fase B — MEDIO

### Task B.1: Avatar — magic bytes + extensión whitelist

**Files:**
- Modify: `app/profile/actions.ts` (function `updateProfile`, avatar upload block)

- [ ] **Step 1: Modify the avatar upload block**

Sustituir las líneas que validan `avatarFile.type` y construyen `fileName`:

```typescript
import { validateImageMagicBytes } from '@/utils/uploads/magic-bytes'

// ...

const avatarFile = formData.get('avatarFile') as File
if (avatarMode === 'upload' && avatarFile && avatarFile.size > 0) {
  const ALLOWED_TYPES_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB

  const ext = ALLOWED_TYPES_TO_EXT[avatarFile.type]
  if (!ext) {
    throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).')
  }
  if (avatarFile.size > MAX_SIZE) {
    throw new Error('El archivo es demasiado grande. El tamaño máximo es 5MB.')
  }

  // Verify magic bytes match the declared MIME type — defense against
  // executables disguised with a manipulated Content-Type.
  if (!(await validateImageMagicBytes(avatarFile))) {
    throw new Error('El archivo no es una imagen válida.')
  }

  const fileName = `${user.id}-${crypto.randomUUID()}.${ext}`
  const filePath = `avatars/${fileName}`

  // ...rest of the upload block unchanged...
}
```

(La extensión la deriva del MIME type validado, no de `file.name`. Esto cierra A.7 + A.8 a la vez.)

- [ ] **Step 2: Gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/profile/actions.ts
git commit -m "fix(security): validate avatar magic bytes and derive extension from MIME"
```

---

### Task B.2: Sentry `sendDefaultPii: false` + `beforeSend` scrub headers

**Files:**
- Modify: `sentry.server.config.ts`
- Modify: `sentry.edge.config.ts`
- Modify: `sentry.client.config.ts`

- [ ] **Step 1: Add explicit PII guard + beforeSend in server config**

Sustituir contenido de `sentry.server.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip sensitive headers that the Next.js integration might capture.
    if (event.request?.headers) {
      const h = event.request.headers as Record<string, string>
      delete h.cookie
      delete h.authorization
      delete h['x-vercel-id']
    }
    return event
  },
})
```

Mismo patrón en `sentry.edge.config.ts`.

Para `sentry.client.config.ts`, mantener `replays*` existentes y añadir `sendDefaultPii: false` + `beforeSend` equivalente.

- [ ] **Step 2: Gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add sentry.server.config.ts sentry.edge.config.ts sentry.client.config.ts
git commit -m "feat(observability): explicit Sentry PII off and strip auth headers in beforeSend"
```

---

### Task B.3: `/api/checkout` chequea `is_published` explícito

**Files:**
- Modify: `app/api/checkout/route.ts`

- [ ] **Step 1: Añadir filtro a la query**

Localizar:

```typescript
const { data: course } = await supabase
  .from('courses')
  .select('title, price_eur')
  .eq('id', courseId)
  .single();
```

Sustituir por:

```typescript
const { data: course } = await supabase
  .from('courses')
  .select('title, price_eur, is_published')
  .eq('id', courseId)
  .eq('is_published', true)
  .single();
```

(La RLS ya bloquea borradores, pero esto es defense-in-depth en application layer.)

- [ ] **Step 2: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add app/api/checkout/route.ts
git commit -m "fix(security): require course is_published in checkout endpoint"
```

---

### Task B.4: Webhook Mux

Crea `/api/webhooks/mux/route.ts` que recibe eventos `video.asset.ready` y `video.asset.errored` y actualiza `lessons.mux_status`. Validación de firma con `MUX_WEBHOOK_SECRET`.

**Files:**
- Create: `app/api/webhooks/mux/route.ts`
- Modify: `.env.local.example` (documentar nueva env var)
- Modify: `utils/env/validate-prod.ts` (añadir asserción opcional)

- [ ] **Step 1: Crear el handler**

```typescript
// app/api/webhooks/mux/route.ts
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Validates Mux webhook signature.
 * Header format: t=<timestamp>,v1=<hex>
 * Signed payload: `${timestamp}.${rawBody}`
 * https://docs.mux.com/guides/system/listen-for-webhooks#validate-the-signature
 */
function verifyMuxSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex')
  // timing-safe compare
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET
  if (!secret) {
    console.error('Mux webhook secret not configured')
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('mux-signature')

  if (!verifyMuxSignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const supabase = getSupabaseAdmin()

  if (event.type === 'video.asset.ready') {
    const assetId = event.data?.id
    const playbackId = event.data?.playback_ids?.[0]?.id ?? null
    if (!assetId) {
      return new NextResponse(null, { status: 200 })
    }
    await supabase
      .from('lessons')
      .update({
        mux_status: 'ready',
        mux_playback_id: playbackId,
      })
      .eq('mux_asset_id', assetId)
  } else if (event.type === 'video.asset.errored') {
    const assetId = event.data?.id
    if (assetId) {
      await supabase
        .from('lessons')
        .update({ mux_status: 'errored' })
        .eq('mux_asset_id', assetId)
    }
  }

  return new NextResponse(null, { status: 200 })
}
```

- [ ] **Step 2: Test del webhook**

```typescript
// __tests__/api/webhooks/mux.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ update: updateMock }) }),
}))

const SECRET = 'test-secret'
process.env.MUX_WEBHOOK_SECRET = SECRET
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://t.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'

import { POST } from '@/app/api/webhooks/mux/route'

function signedRequest(payload: object): Request {
  const body = JSON.stringify(payload)
  const t = Math.floor(Date.now() / 1000).toString()
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')
  return new Request('http://x/webhook', {
    method: 'POST',
    headers: { 'mux-signature': `t=${t},v1=${sig}` },
    body,
  })
}

describe('Mux webhook', () => {
  beforeEach(() => updateMock.mockClear())

  it('rejects unsigned request', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid signature', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      headers: { 'mux-signature': 't=1,v1=00' },
      body: '{}',
    }))
    expect(res.status).toBe(401)
  })

  it('updates lesson on asset.ready', async () => {
    const res = await POST(signedRequest({
      type: 'video.asset.ready',
      data: { id: 'asset-1', playback_ids: [{ id: 'pb-1' }] },
    }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ mux_status: 'ready', mux_playback_id: 'pb-1' })
  })

  it('updates lesson on asset.errored', async () => {
    const res = await POST(signedRequest({
      type: 'video.asset.errored',
      data: { id: 'asset-1' },
    }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ mux_status: 'errored' })
  })
})
```

- [ ] **Step 3: Documentar env var**

En `.env.local.example`, añadir:

```
# Mux webhook signing secret (Settings → Webhooks → Signing secret)
MUX_WEBHOOK_SECRET=
```

- [ ] **Step 4: Configurar webhook en Mux dashboard (acción humana)**

Documentar en el commit message:
- URL del webhook: `https://luisy-sara-bachatango.vercel.app/api/webhooks/mux`
- Eventos: `video.asset.ready`, `video.asset.errored`
- Copiar el signing secret a Vercel env (Production + Preview).

- [ ] **Step 5: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add app/api/webhooks/mux/route.ts __tests__/api/webhooks/mux.test.ts .env.local.example
git commit -m "feat(mux): add signed webhook handler for asset.ready/errored events"
```

---

### Task B.5: Inputs admin con `maxLength`

Centraliza límites razonables. Aplica a:
- `sendNotification` (title 200, body 1000)
- `createCourse`/`updateCourse` (title 200, description 5000, priceEur 0..9999, year 2020..2100, month 1..12)
- `createLesson`/`updateLesson` (title 200, description 5000)
- `parseEventForm` (location 200, title 500, description 5000)
- `createAssignment`/`updateAssignment` (title 200, description 5000)

**Files:**
- Modify: `app/admin/alumnos/actions.ts`
- Modify: `app/courses/actions.ts`
- Modify: `app/events/_lib/parse.ts`

- [ ] **Step 1: `sendNotification`**

```typescript
const t = title.trim().slice(0, 200)
const b = body.trim().slice(0, 1000)
if (t.length === 0) return { error: 'title_required' }
```

- [ ] **Step 2: `createCourse` / `updateCourse`**

Después de extraer los inputs, añadir:

```typescript
if (!title?.trim() || title.length > 200) return { error: 'invalid_title' }
if (description && description.length > 5000) return { error: 'description_too_long' }
if (priceEur !== null && (priceEur < 0 || priceEur > 9999)) return { error: 'invalid_price' }
if (year !== null && (year < 2020 || year > 2100)) return { error: 'invalid_year' }
if (month !== null && (month < 1 || month > 12)) return { error: 'invalid_month' }
```

- [ ] **Step 3: `createLesson`/`updateLesson` y `createAssignment`/`updateAssignment`**

Mismo patrón: validar `title.length <= 200` y `description.length <= 5000` antes de los inserts/updates.

- [ ] **Step 4: `parseEventForm`**

Añadir tras los `trim()`:

```typescript
if (location.length > 200) return { error: 'location_too_long' }
for (const loc of LOCALES) {
  if (title[loc].length > 500) return { error: 'title_too_long' }
  if (description[loc].length > 5000) return { error: 'description_too_long' }
}
```

- [ ] **Step 5: Gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Existing tests pueden romperse si usan strings largos como fixtures. Ajustar.

- [ ] **Step 6: Commit**

```bash
git add app/admin/alumnos/actions.ts app/courses/actions.ts app/events/_lib/parse.ts
git commit -m "fix(security): bound admin input lengths and numeric ranges"
```

---

### Task B.6: Usar `getClientIp` en todos los rate-limit call sites

**Files:**
- Modify: `app/api/checkout/route.ts`
- Modify: `app/login/actions.ts` (2 call sites: login + signup)
- Modify: `utils/supabase/middleware-helper.ts`

- [ ] **Step 1: Sustituir cada extracción de IP**

En `app/api/checkout/route.ts`, sustituir:

```typescript
const xff = req.headers.get('x-forwarded-for') ?? ''
const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon'
```

por:

```typescript
import { getClientIp } from '@/utils/auth/client-ip'
// ...
const ip = getClientIp(req.headers)
```

En `app/login/actions.ts`, sustituir las 2 ocurrencias del patrón `const ip = (h.get('x-forwarded-for') ?? 'anon')...`.

En `utils/supabase/middleware-helper.ts`, dentro del bloque `/monitoring`, sustituir el mismo patrón.

- [ ] **Step 2: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add app/api/checkout/route.ts app/login/actions.ts utils/supabase/middleware-helper.ts
git commit -m "fix(security): use getClientIp helper preferring x-vercel-forwarded-for"
```

---

## Fase C — BAJO

### Task C.1: Bajar rate-limit de `submitComment` a 10/min

**Files:**
- Modify: `app/community/actions.ts`

- [ ] **Step 1: Cambiar el límite**

```typescript
// antes
const rl = await rateLimit(rateLimitKey([user.id, 'comment']), 30, 60_000)

// después
const rl = await rateLimit(rateLimitKey([user.id, 'comment']), 10, 60_000)
```

- [ ] **Step 2: Commit**

```bash
git add app/community/actions.ts
git commit -m "chore(rate-limit): tighten community comment rate to 10/min"
```

---

### Task C.2: Documentar RLS del bucket `mux-track-sources`

Verificar y documentar que el bucket tiene INSERT restringido a admin. Si no, añadir migración.

**Files:**
- Create: `supabase/2026_05_audit3_mux_tracks_bucket_policy.sql` (si la policy no existe)

- [ ] **Step 1: Verificar via MCP execute_sql**

```sql
select policyname, cmd, qual::text, with_check::text
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname ilike '%mux-track%';
```

Si la única policy es `Public read mux-track-sources` (SELECT only), AÑADIR migración. Si ya hay policy INSERT/DELETE restringida a admin, solo documentar en SQL existente.

- [ ] **Step 2: Crear migración (si falta)**

```sql
-- supabase/2026_05_audit3_mux_tracks_bucket_policy.sql
-- Restringir INSERT/UPDATE/DELETE en bucket mux-track-sources a admins.

create policy "Admin write mux-track-sources" on storage.objects
  for all
  using (
    bucket_id = 'mux-track-sources'
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    bucket_id = 'mux-track-sources'
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
```

- [ ] **Step 3: Aplicar via MCP `apply_migration`**

`name: audit3_2026_05_mux_tracks_bucket_policy`.

- [ ] **Step 4: Commit**

```bash
git add supabase/2026_05_audit3_mux_tracks_bucket_policy.sql
git commit -m "feat(security): admin-only writes on mux-track-sources bucket"
```

(Si la policy ya existía, hacer commit empty con mensaje informativo en lugar de la migración.)

---

### Task C.3: Audit trail de `account_deletions`

**Files:**
- Create: `supabase/2026_05_audit3_account_deletions.sql`
- Modify: `app/profile/actions.ts` (function `deleteAccount`)

- [ ] **Step 1: Migración**

```sql
-- supabase/2026_05_audit3_account_deletions.sql
-- Conserva un registro mínimo de eliminaciones para resolver disputas
-- de facturación. No es PII directa: solo SHA-256 del email + timestamp.

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  email_sha256 text not null,
  deleted_at timestamptz not null default now()
);

alter table public.account_deletions enable row level security;

-- Solo admin puede leer.
create policy "account_deletions admin SELECT" on public.account_deletions
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

-- Solo service role inserta (vía deleteAccount con admin client).
create policy "account_deletions service INSERT" on public.account_deletions
  for insert with check (false);

create index if not exists idx_account_deletions_deleted_at
  on account_deletions (deleted_at desc);
```

- [ ] **Step 2: Aplicar migración**

`name: audit3_2026_05_account_deletions` via MCP.

- [ ] **Step 3: Modify `deleteAccount`**

En `app/profile/actions.ts`, antes de `auth.admin.deleteUser(user.id)`:

```typescript
// Audit trail (best effort — failure here doesn't block deletion).
try {
  const emailHash = crypto
    .createHash('sha256')
    .update((user.email ?? '').toLowerCase())
    .digest('hex')
  await supabaseAdmin
    .from('account_deletions')
    .insert({ email_sha256: emailHash })
} catch (err) {
  console.error('[deleteAccount] audit insert failed', err)
}
```

(Importar `crypto` from `'node:crypto'` al top del archivo.)

- [ ] **Step 4: Commit**

```bash
git add supabase/2026_05_audit3_account_deletions.sql app/profile/actions.ts
git commit -m "feat(security): audit-log account deletions (sha256 email + timestamp)"
```

---

## Fase D — Cierre

### Task D.1: Validación + advisors + push + PR + merge

**Files:** ninguno

- [ ] **Step 1: Gates verdes**

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
npm run i18n:check
```

Todos verdes.

- [ ] **Step 2: Advisors check**

(MCP `get_advisors` security + performance. Esperado: cero nuevos warnings introducidos por las migraciones de C.2 y C.3.)

- [ ] **Step 3: Push**

```bash
git push -u origin chore/audit3-remediation
```

- [ ] **Step 4: Crear PR**

(URL: https://github.com/ivangs23/LuisySaraBachatango/pull/new/chore/audit3-remediation o vía `gh pr create` si está autenticado.)

- [ ] **Step 5: Mergear a main tras revisión**

```bash
git checkout main
git pull origin main
git merge --no-ff chore/audit3-remediation -m "Merge audit-3 remediation: close 16 findings"
git push origin main
```

- [ ] **Step 6: Acción humana en Mux dashboard**

Después del merge:
1. https://dashboard.mux.com → Settings → Webhooks → Add endpoint.
2. URL: `https://luisy-sara-bachatango.vercel.app/api/webhooks/mux`.
3. Events: `video.asset.ready`, `video.asset.errored`.
4. Copy signing secret → Vercel env: añadir `MUX_WEBHOOK_SECRET` para Production + Preview.
5. Redeploy production.

---

## Verificación final del plan

### Spec coverage

- ✅ ALTO 1 (`gradeSubmission`) → A.1
- ✅ ALTO 2 (`updateAssignment`/`deleteAssignment`) → A.2
- ✅ ALTO 3 (social URLs whitelist) → 0.3 + A.3
- ✅ ALTO 4 (likes rate-limit) → A.4
- ✅ ALTO 5 (comment like access) → A.5
- ✅ ALTO 6 (Origin redirect) → A.6
- ✅ MEDIO 7 (avatar magic bytes) → 0.4 + B.1
- ✅ MEDIO 8 (avatar fileExt) → B.1 (combinado)
- ✅ MEDIO 9 (Sentry PII) → B.2
- ✅ MEDIO 10 (checkout is_published) → B.3
- ✅ MEDIO 11 (Mux webhook) → B.4
- ✅ MEDIO 12 (admin maxLength) → B.5
- ✅ MEDIO 13 (x-vercel-forwarded-for) → 0.2 + B.6
- ✅ BAJO 14 (submitComment rate) → C.1
- ✅ BAJO 15 (mux-track-sources RLS) → C.2
- ✅ BAJO 16 (account_deletions) → C.3

### Sin placeholders

Cada step incluye código completo o comando exacto.

### Type consistency

- `getClientIp(headers: Headers): string` — definida en 0.2, usada en B.6.
- `safeSocialUrl(value, network)` — definida en 0.3, usada en A.3.
- `validateImageMagicBytes(file): Promise<boolean>` — definida en 0.4, usada en B.1.
- `hasCourseAccess(userId, courseId)` — del audit2, usada en A.5.
