# Post-Audit5 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la deuda técnica y operacional restante tras 5 audits: migración de `middleware.ts` → `proxy.ts` (Next 16.2 deprecation), arrancar suite de E2E con Playwright cubriendo flujos críticos, y medición Lighthouse contra producción.

**Architecture:** El plan se divide en 3 fases independientes. La primera es mecánica (rename + verify build). La segunda monta la infraestructura E2E que el repo ya tiene scaffolded (Playwright instalado, `seed-e2e-users.mjs` existente) — escribimos config + 4 tests críticos cubriendo el flujo público (homepage → courses → preview shell), auth (login/signup), y un flow autenticado. La tercera es una medición real contra producción con `lighthouse` CLI.

**Tech Stack:** Next.js 16.2 · Playwright · Lighthouse CLI · Supabase · Stripe (test mode).

---

## Fase 0 — Preparación

### Task 0.1: Crear rama y baseline

- [ ] **Step 1: Branch**

```bash
cd /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango
git checkout main
git pull origin main
git checkout -b chore/post-audit5-hardening
```

- [ ] **Step 2: Gates verdes**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
npm run i18n:check
```

- [ ] **Step 3: Empty marker**

```bash
git commit --allow-empty -m "chore: start post-audit5-hardening branch"
```

---

## Fase A — middleware.ts → proxy.ts

### Task A.1: Renombrar middleware → proxy

Next.js 16.2 deprecó `middleware.ts` en favor de `proxy.ts`. Mismo contrato (export default function `proxy(request)` o `middleware(request)` — verificar qué nombre exporta), mismo `config.matcher`.

**Files:**
- Rename: `middleware.ts` → `proxy.ts`

- [ ] **Step 1: Rename file**

```bash
git mv middleware.ts proxy.ts
```

- [ ] **Step 2: Update export name**

Lee el archivo:

```bash
cat proxy.ts
```

Cambiar `export async function middleware(request: ...)` por `export async function proxy(request: ...)` (Next 16.2 acepta ambos nombres en `proxy.ts`, pero la convención es renombrar la función para coherencia).

```typescript
// proxy.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware-helper'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

(El `utils/supabase/middleware-helper.ts` se queda como está — el nombre del archivo es interno, no afecta a Next.)

- [ ] **Step 3: Build + verify deprecation gone**

```bash
npm run build 2>&1 | grep -i "middleware.*deprecated\|middleware-to-proxy" | head -3
```

Expected: vacío (sin warnings de deprecación).

- [ ] **Step 4: Smoke test**

```bash
npm run dev &
sleep 8
curl -sI http://localhost:3000/dashboard | head -5  # debería 307/302 a /login (auth required)
kill %1
```

(Si en lugar de redirect hay 200, el proxy no se está ejecutando — investigar.)

- [ ] **Step 5: Gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add proxy.ts
git commit -m "chore(next): rename middleware.ts to proxy.ts (Next 16.2 convention)"
```

---

## Fase B — Playwright E2E

### Task B.1: Configurar Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures.ts` (helpers compartidos)
- Modify: `package.json` (scripts npm para E2E)
- Modify: `.gitignore` (ignorar `playwright-report/`, `test-results/`)

- [ ] **Step 1: Crear playwright.config.ts**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run build && npm run start',
    url: BASE_URL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 2: Crear e2e/fixtures.ts (helpers)**

```typescript
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test'

export const test = base.extend({})
export { expect }

export const TEST_USERS = {
  member: {
    email: process.env.E2E_MEMBER_EMAIL ?? 'e2e-member@example.test',
    password: process.env.E2E_MEMBER_PASSWORD ?? 'changeme-e2e',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.test',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'changeme-e2e',
  },
}
```

- [ ] **Step 3: Añadir scripts a package.json**

Localizar el bloque `"scripts"` y añadir:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:report": "playwright show-report"
  }
}
```

- [ ] **Step 4: Update .gitignore**

Añadir al final:

```
# Playwright
/playwright-report/
/test-results/
/playwright/.cache/
```

(Verifica si ya están con `grep playwright .gitignore`. Si sí, omite.)

- [ ] **Step 5: Install browser**

```bash
npx playwright install chromium
```

(Solo Chromium para reducir CI time. Firefox/WebKit pueden añadirse luego.)

- [ ] **Step 6: Verify config loads**

```bash
npx playwright test --list 2>&1 | head -10
```

Expected: "no tests found" o lista vacía (no hay tests aún, pero la config carga).

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/fixtures.ts package.json package-lock.json .gitignore
git commit -m "test(e2e): bootstrap Playwright with chromium project + npm scripts"
```

---

### Task B.2: E2E para flujo público (homepage → courses → course preview)

Test sin login: visitar `/`, navegar a `/courses`, click en un curso, verificar que la preview shell renderiza con título + JSON-LD Course (audit5 C.5).

**Files:**
- Create: `e2e/public-flow.spec.ts`

- [ ] **Step 1: Test**

```typescript
// e2e/public-flow.spec.ts
import { test, expect } from './fixtures'

test.describe('Public flow — anonymous visitor', () => {
  test('homepage renders title and key sections', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Luis y Sara Bachatango/)
    await expect(page.locator('h1')).toBeVisible()
    // Skip-link target should exist (audit5 a11y)
    await expect(page.locator('#main-content')).toHaveCount(1)
  })

  test('homepage has Organization JSON-LD', async ({ page }) => {
    await page.goto('/')
    const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(ldScripts.length).toBeGreaterThan(0)
    const hasOrg = ldScripts.some(s => s.includes('"@type":"Organization"') || s.includes('"@type": "Organization"'))
    expect(hasOrg).toBe(true)
  })

  test('navigates from /courses to course detail preview shell', async ({ page }) => {
    await page.goto('/courses')
    await expect(page).toHaveTitle(/Cursos/)

    // Find first course card link. Selector adapts to actual markup.
    const firstCourseLink = page.locator('a[href*="/courses/"]').first()
    const courseHref = await firstCourseLink.getAttribute('href')
    if (!courseHref) test.skip(true, 'no published courses to navigate to')

    await firstCourseLink.click()
    await page.waitForURL(/\/courses\/[a-f0-9-]+/)

    // Anonymous user should see preview shell (audit5 C.5), NOT redirect to /login.
    expect(page.url()).not.toContain('/login')
    await expect(page.locator('h1')).toBeVisible()

    // Course JSON-LD must be present (the whole point of the preview shell).
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
    const hasCourse = ld.some(s => s.includes('"@type":"Course"') || s.includes('"@type": "Course"'))
    expect(hasCourse).toBe(true)

    // CTA to login should link with ?next=...
    const loginCta = page.locator('a[href*="/login"]')
    await expect(loginCta).toBeVisible()
  })

  test('robots.txt blocks /admin and /login', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('/admin')
    expect(body).toContain('/login')
  })

  test('sitemap.xml is accessible and has URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('<loc>')
  })
})
```

- [ ] **Step 2: Run**

```bash
npx playwright test e2e/public-flow.spec.ts
```

Si el web server tarda en arrancar (>2 min build), el test puede timeout. En dev local mejor:

```bash
# Terminal 1
npm run dev

# Terminal 2
E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/public-flow.spec.ts
```

(El config respeta `E2E_BASE_URL` y skipea levantar webServer.)

Si fallan tests por falta de cursos publicados en la BD local, el `test.skip` cubre eso. La BD apunta a la producción real (Supabase remoto), así que los cursos publicados existen.

- [ ] **Step 3: Iterate hasta verde**

Algunas adaptaciones probables:
- El selector `a[href*="/courses/"]` puede coger el link "Ver cursos" del menú. Refinar con `.first()` o un selector específico.
- El JSON-LD puede tener whitespace distinto.

Ajustar hasta que los 5 tests pasen.

- [ ] **Step 4: Commit**

```bash
git add e2e/public-flow.spec.ts
git commit -m "test(e2e): public flow — homepage, courses listing, preview shell, robots, sitemap"
```

---

### Task B.3: E2E para signup + login

Test del flujo de auth contra Supabase real (entorno de test). Creamos un usuario único por run (timestamp) y verificamos signup + login + logout.

**Files:**
- Create: `e2e/auth-flow.spec.ts`

- [ ] **Step 1: Test**

```typescript
// e2e/auth-flow.spec.ts
import { test, expect } from './fixtures'

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

test.describe('Auth flow', () => {
  test('signup creates account and shows email confirmation message', async ({ page }) => {
    const email = uniqueEmail()
    const password = 'TestPassword1234!'

    await page.goto('/signup')
    await expect(page.locator('h1')).toBeVisible()

    // Form labels were wired in audit5 B.4 — test by label text or by name attr.
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.locator('input[name="fullName"]').fill('E2E Test User')

    await page.locator('button[type="submit"]').click()

    // After submit, signup action redirects to /login?message=email_confirmation.
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toMatch(/message=email_confirmation/)
  })

  test('signup rejects invalid email format', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('input[name="email"]').fill('not-an-email')
    await page.locator('input[name="password"]').fill('LongPassword1234')
    await page.locator('input[name="fullName"]').fill('X')
    await page.locator('button[type="submit"]').click()

    // Server-side validation redirects to /login?error=invalid_email
    await page.waitForURL(/error=invalid_email|error=signup_failed/, { timeout: 10000 })
  })

  test('signup rejects too-short password', async ({ page }) => {
    const email = uniqueEmail()
    await page.goto('/signup')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill('short')
    await page.locator('input[name="fullName"]').fill('X')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL(/error=password_too_short/, { timeout: 10000 })
  })

  test('login with wrong credentials redirects with error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[name="email"]').fill('nonexistent@example.test')
    await page.locator('input[name="password"]').fill('WrongPassword123')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL(/error=invalid_credentials|error=login_failed/, { timeout: 10000 })
  })

  test('forgot-password always redirects to email_reset (no enumeration)', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.locator('input[name="email"]').fill('any-random@example.test')
    await page.locator('button[type="submit"]').click()

    // Audit2 fix: always same redirect regardless of whether email exists.
    await page.waitForURL(/message=email_reset/, { timeout: 10000 })
  })
})
```

- [ ] **Step 2: Run**

```bash
E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/auth-flow.spec.ts
```

NOTA: si el rate limiter de Upstash bloquea las pruebas (hicimos 3-5 signups consecutivos), o se acepta como bug benigno (corre solo localmente), o se mockea Upstash en dev. Para esta primera pasada, ejecutar con un delay si los rate limits afectan:

Si los tests fallan por rate limit, ajustar:
- En dev sin `UPSTASH_REDIS_REST_URL` configurada → fallback in-memory que se resetea por cada nuevo proceso. Si los tests corren en serie en el mismo proceso de webServer, el limiter persiste — usar `--workers 1` o esperar entre tests.

```bash
E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/auth-flow.spec.ts --workers 1
```

- [ ] **Step 3: Selector adjustments**

Si los selectors `input[name="email"]` no encuentran el input (porque el form está dentro de un Client Component que tarda en hidratar), añadir `await page.waitForSelector('input[name="email"]')`. Adaptar.

- [ ] **Step 4: Commit**

```bash
git add e2e/auth-flow.spec.ts
git commit -m "test(e2e): auth flow — signup validation, login error, forgot-password no-enum"
```

---

### Task B.4: E2E del flujo autenticado mínimo (login + dashboard)

Necesitamos un usuario sembrado para este test. El script `scripts/seed-e2e-users.mjs` existe pero no sabemos si está poblado en producción. Strategy:
- Si las credenciales de E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD están en `.env.local`, usarlas.
- Si no, marcar el test con `test.skip` y dejarlo como TODO documentado.

**Files:**
- Create: `e2e/authenticated-flow.spec.ts`

- [ ] **Step 1: Test**

```typescript
// e2e/authenticated-flow.spec.ts
import { test, expect, TEST_USERS } from './fixtures'

const HAS_MEMBER_CREDS = !!(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD
)

test.describe('Authenticated flow (member)', () => {
  test.skip(!HAS_MEMBER_CREDS, 'set E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD to enable')

  test('login as member lands on dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[name="email"]').fill(TEST_USERS.member.email)
    await page.locator('input[name="password"]').fill(TEST_USERS.member.password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    await expect(page.locator('h1')).toBeVisible()
  })

  test('logout returns to homepage', async ({ page }) => {
    // Login first.
    await page.goto('/login')
    await page.locator('input[name="email"]').fill(TEST_USERS.member.email)
    await page.locator('input[name="password"]').fill(TEST_USERS.member.password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/dashboard/)

    // Logout — adapt selector to actual logout button/link.
    // Common pattern: click avatar → "Cerrar sesión" link.
    const logoutLink = page.locator('a[href*="signout"], button:has-text("Cerrar sesión"), a:has-text("Cerrar sesión")').first()
    if (await logoutLink.count() === 0) {
      test.skip(true, 'logout selector not found — adapt to real markup')
    }
    await logoutLink.click()

    // Land on homepage or login.
    await page.waitForURL(/\/$|\/login/, { timeout: 10000 })
  })
})
```

- [ ] **Step 2: Try running**

```bash
E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/authenticated-flow.spec.ts
```

Probable: `test.skip` se dispara porque las env vars no están. Eso es OK — el test queda como infraestructura para cuando las credenciales se setean.

- [ ] **Step 3: Document seeding flow in README**

Crear `e2e/README.md`:

```markdown
# E2E tests

## Setup

```bash
npx playwright install chromium
```

## Run against local dev

```bash
# Terminal 1
npm run dev

# Terminal 2
E2E_BASE_URL=http://localhost:3000 npm run e2e
```

## Run against production / staging

```bash
E2E_BASE_URL=https://luisy-sara-bachatango.vercel.app npm run e2e -- e2e/public-flow.spec.ts
```

(Authenticated tests against production are NOT recommended — they create real auth records.)

## Authenticated flow tests

`authenticated-flow.spec.ts` requires a seeded test user. By default it `test.skip`s if the env vars are missing.

To enable:

1. Run `node scripts/seed-e2e-users.mjs` (creates e2e-member@... and e2e-admin@... in your Supabase project).
2. Copy the printed credentials to `.env.local`:
   ```
   E2E_MEMBER_EMAIL=...
   E2E_MEMBER_PASSWORD=...
   E2E_ADMIN_EMAIL=...
   E2E_ADMIN_PASSWORD=...
   ```
3. Re-run `npm run e2e`.

## Reports

```bash
npm run e2e:report  # opens HTML report from last run
```
```

- [ ] **Step 4: Commit**

```bash
git add e2e/authenticated-flow.spec.ts e2e/README.md
git commit -m "test(e2e): authenticated flow scaffold + e2e README"
```

---

## Fase C — Lighthouse contra producción

### Task C.1: Lighthouse CI smoke + report

Medición real de Web Vitals contra el dominio público.

**Files:**
- Create: `loadtest/lighthouse.sh` (helper script)
- Create: `docs/lighthouse-2026-05-results.md` (results)

- [ ] **Step 1: Install Lighthouse CLI**

```bash
npm install --save-dev lighthouse@latest
```

- [ ] **Step 2: Crear helper script**

```bash
# loadtest/lighthouse.sh
#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://luisy-sara-bachatango.vercel.app/}"
OUT_DIR="loadtest/lighthouse-reports"

mkdir -p "$OUT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT="$OUT_DIR/lighthouse-$TIMESTAMP.json"

npx lighthouse "$URL" \
  --output=json \
  --output=html \
  --output-path="$OUT_DIR/lighthouse-$TIMESTAMP" \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet

# Print scores.
node -e "
const r = require('./$OUT_DIR/lighthouse-$TIMESTAMP.report.json');
const cats = r.categories;
console.log('Performance:', Math.round(cats.performance.score * 100));
console.log('Accessibility:', Math.round(cats.accessibility.score * 100));
console.log('Best Practices:', Math.round(cats['best-practices'].score * 100));
console.log('SEO:', Math.round(cats.seo.score * 100));
console.log('');
console.log('LCP:', Math.round(r.audits['largest-contentful-paint'].numericValue), 'ms');
console.log('CLS:', r.audits['cumulative-layout-shift'].numericValue.toFixed(3));
console.log('TBT:', Math.round(r.audits['total-blocking-time'].numericValue), 'ms');
"
```

```bash
chmod +x loadtest/lighthouse.sh
```

- [ ] **Step 3: Run against production homepage**

```bash
bash loadtest/lighthouse.sh https://luisy-sara-bachatango.vercel.app/
```

Capturar la salida.

- [ ] **Step 4: Run against course listing**

```bash
bash loadtest/lighthouse.sh https://luisy-sara-bachatango.vercel.app/courses
```

- [ ] **Step 5: Update .gitignore para reports**

```bash
echo "loadtest/lighthouse-reports/" >> .gitignore
```

- [ ] **Step 6: Document results**

Crear `docs/lighthouse-2026-05-results.md`:

```markdown
# Lighthouse audit — 2026-05-07

## Setup
- URL: https://luisy-sara-bachatango.vercel.app/
- Tool: lighthouse CLI (latest)
- Mode: headless Chromium, mobile simulation
- Only-categories: performance, accessibility, best-practices, seo

## Homepage scores

| Category | Score |
|---|---|
| Performance | <fill from run> |
| Accessibility | <fill from run> |
| Best Practices | <fill from run> |
| SEO | <fill from run> |

## Web Vitals

| Metric | Value | Threshold |
|---|---|---|
| LCP | <ms> | < 2500 ms (good) |
| CLS | <value> | < 0.1 (good) |
| TBT | <ms> | < 200 ms (good) |

## /courses scores

(Same format — populate from second run.)

## Recommendations

(Top 3-5 audit failures from the JSON report; populate manually.)
```

(El implementador debe llenar los placeholders con los números reales del run.)

- [ ] **Step 7: Commit**

```bash
git add loadtest/lighthouse.sh docs/lighthouse-2026-05-results.md package.json package-lock.json .gitignore
git commit -m "feat(loadtest): Lighthouse CLI helper + production smoke results"
```

---

## Fase D — Cierre

### Task D.1: Validación + push + merge

- [ ] **Step 1: Final gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build && npm run i18n:check
```

- [ ] **Step 2: Push**

```bash
git push -u origin chore/post-audit5-hardening
```

- [ ] **Step 3: Merge a main**

```bash
git checkout main
git pull origin main
git merge --no-ff chore/post-audit5-hardening -m "Merge post-audit5 hardening: proxy.ts + Playwright + Lighthouse"
git push origin main
```

---

## Verificación final

### Spec coverage

- ✅ middleware → proxy → Task A.1
- ✅ Playwright bootstrap → Task B.1
- ✅ Public E2E → Task B.2
- ✅ Auth E2E → Task B.3
- ✅ Authenticated E2E (scaffold) → Task B.4
- ✅ Lighthouse production → Task C.1

### Sin placeholders

Cada step lleva código completo. Las secciones `<fill from run>` en el report markdown son específicamente para que el implementador rellene con datos reales — eso NO es un placeholder de implementación, es el reporte mismo.
