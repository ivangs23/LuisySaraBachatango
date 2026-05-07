/**
 * audit-coverage.spec.ts
 *
 * Tests específicos para verificar lo introducido en los audits 1-5
 * y que NO están cubiertas por specs existentes:
 *
 * - JSON-LD Organization en homepage                   (audit1)
 * - JSON-LD Course en /courses/:id para anon           (audit5 C.5)
 * - Course preview shell sin redirect a /login         (audit5 C.5)
 * - robots.txt bloquea /admin y auth pages             (audit5 A.2)
 * - sitemap.xml accesible con URLs                     (audit5 C.3)
 * - manifest.webmanifest accesible                     (audit5 C.4)
 * - Skip-link + #main-content target                   (audit5 B.6)
 * - html lang attribute (defaulta a es y respeta cookie) (audit5 B.5)
 */

import { test, expect } from './fixtures'

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

test.describe('Audit coverage — SEO', () => {
  test('homepage exposes Organization JSON-LD', async ({ page }) => {
    await page.goto('/')
    const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(ldScripts.length).toBeGreaterThan(0)
    const hasOrg = ldScripts.some(
      (s) => s.includes('"@type":"Organization"') || s.includes('"@type": "Organization"'),
    )
    expect(hasOrg).toBe(true)
  })

  test('robots.txt blocks /admin, /login and /dashboard', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('/admin')
    expect(body).toContain('/login')
    expect(body).toContain('/dashboard')
  })

  test('sitemap.xml is accessible and contains URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('<loc>')
  })

  test('manifest.webmanifest is accessible with required fields', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('theme_color')
  })
})

// ---------------------------------------------------------------------------
// Course preview shell (audit5 C.5)
// ---------------------------------------------------------------------------

test.describe('Audit coverage — Course preview shell (audit5 C.5)', () => {
  test(
    'anonymous user visiting /courses/:id sees preview shell, NOT /login redirect',
    async ({ page }) => {
      // Find the first published course card on the listing page.
      await page.goto('/courses')

      // CoursesClient renders: <Link href="/courses/:uuid" aria-label={course.title} …>
      // We avoid links containing "create" (the admin "create course" button).
      const courseLink = page
        .locator('a[href^="/courses/"]')
        .filter({ hasNotText: /crear|create/i })
        .first()

      const count = await courseLink.count()
      if (count === 0) {
        test.skip(true, 'No published courses visible to anonymous user — preview shell test cannot run')
        return
      }

      const href = await courseLink.getAttribute('href')
      // href must be a UUID-shaped course detail URL (/courses/<uuid>), not a
      // sub-path like /courses/:id/edit or /courses/create.
      if (!href || !/^\/courses\/[0-9a-f-]{36}$/.test(href)) {
        test.skip(true, `First course link "${href}" is not a bare UUID course URL`)
        return
      }

      await page.goto(href)

      // Should NOT have been redirected to /login
      expect(page.url()).not.toMatch(/\/login/)

      // Preview shell always renders the course title in h1
      await expect(page.locator('h1').first()).toBeVisible()

      // Course JSON-LD injected by the page server component
      const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents()
      const hasCourse = ldScripts.some(
        (s) => s.includes('"@type":"Course"') || s.includes('"@type": "Course"'),
      )
      expect(hasCourse).toBe(true)

      // CoursePreviewShell renders <Link href="/login?next=/courses/:id">
      const loginCta = page.locator('a[href*="/login"]')
      const ctaCount = await loginCta.count()
      expect(ctaCount).toBeGreaterThan(0)
    },
  )
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test.describe('Audit coverage — a11y', () => {
  test('homepage has skip-to-content link pointing to #main-content', async ({ page }) => {
    await page.goto('/')
    // Skip link is rendered in layout.tsx as <a href="#main-content">
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toHaveCount(1)
    // The link target <main id="main-content"> must also exist
    await expect(page.locator('#main-content')).toHaveCount(1)
  })

  test('html lang attribute defaults to "es" when no locale cookie is set', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('es')
  })

  test('html lang attribute respects the locale cookie', async ({ page, context, baseURL }) => {
    if (!baseURL) {
      test.skip(true, 'No baseURL configured — cannot set domain-scoped cookie')
      return
    }
    const url = new URL(baseURL)
    await context.addCookies([
      {
        name: 'locale',
        value: 'en',
        domain: url.hostname,
        path: '/',
      },
    ])
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('en')
  })
})
