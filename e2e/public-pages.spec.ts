import { test, expect } from '@playwright/test'

/**
 * Smoke tests for all public (anonymous-accessible) pages.
 *
 * Each test loads a route and asserts a heading/element that is stable across
 * content edits. Headings come from utils/dictionaries.ts (es locale, the
 * default when no `locale` cookie is set).
 */

test.describe('Public pages load', () => {
  const PAGES = [
    { path: '/events', heading: /Agenda & Eventos|Schedule & Events/i },
    { path: '/music', heading: /Nuestras Playlists|Our Playlists/i },
    { path: '/blog', heading: /Blog|Artículos/i },
    { path: '/sobre-nosotros', heading: /Pasión y Elegancia|Passion|About/i },
    { path: '/contact', heading: /Contrataciones|Booking|Contact/i },
    { path: '/legal/privacy', heading: /Política de Privacidad|Privacy/i },
    { path: '/legal/terms', heading: /Términos|Terms/i },
    { path: '/legal/cookies', heading: /Cookies/i },
    { path: '/legal/notice', heading: /Aviso Legal|Legal Notice/i },
    { path: '/login', heading: /Inicio de Sesión|Sign In/i },
    { path: '/signup', heading: /Regístrate|Sign Up|Register/i },
    { path: '/forgot-password', heading: /Recuperar Contraseña|Reset Password/i },
  ]

  for (const { path, heading } of PAGES) {
    test(`GET ${path} renders without errors`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `Expected 2xx for ${path}`).toBeLessThan(400)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    })
  }
})

test.describe('Contact form', () => {
  test('renders all required fields and submit button', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#type')).toBeVisible()
    await expect(page.locator('#message')).toBeVisible()
    await expect(page.locator('button[type="submit"]').first()).toBeVisible()
  })
})

test.describe('Language switcher', () => {
  test('changes UI language from ES to EN', async ({ page, context }) => {
    // Start fresh without locale cookie so es is the default.
    await context.clearCookies()
    await page.goto('/')

    // ES default: courses CTA link to /courses exists and dashboard label says "Dashboard"
    // The switcher is a button with aria-label="Select Language".
    await page.getByRole('button', { name: /Select Language/i }).click()

    // Pick English from the dropdown (option contains text "English").
    await page.getByRole('button', { name: /English/i }).click()

    // After switch, the home hero subtitle or any EN-only text should be present.
    // We navigate to /courses where the h1 switches to "Available Courses" (en) vs
    // "Cursos Disponibles" (es).
    await page.goto('/courses')
    await expect(
      page.getByRole('heading', { name: /Available Courses/i }).first()
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Unauthenticated redirects', () => {
  const PROTECTED_PATHS = [
    '/dashboard',
    '/profile',
    '/community/create',
    '/courses/create',
  ]

  for (const path of PROTECTED_PATHS) {
    test(`${path} → /login when not authenticated`, async ({ page, context }) => {
      await context.clearCookies()
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})
