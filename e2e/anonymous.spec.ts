import { test, expect } from '@playwright/test'

/**
 * Anonymous user smoke tests — no login required.
 *
 * Selector notes:
 * - Home hero CTA uses `t.hero.cta` which is locale-specific text (e.g.
 *   "SUSCRÍBETE AL CURSO DE NOVIEMBRE"). We match the <Link href="/courses">
 *   element by role + href attribute instead, so the test does not break when
 *   the CTA copy changes.
 * - Courses page heading uses `t.coursesPage.title` = "Cursos Disponibles" (es).
 * - Community anonymous heading uses `t.communityPage.joinTitle` = "Únete a la Comunidad" (es).
 * - Login error is from `t.errors.invalid_credentials` = "Credenciales incorrectas…"
 */

test.describe('Anonymous user flows', () => {
  test('home page loads and hero CTA links to /courses', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Luis y Sara/i)
    // The hero CTA is a <Link href="/courses"> rendered as an <a>.
    // We locate it by its href to be resilient to CTA copy changes.
    const cta = page.locator('a[href="/courses"]').first()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/courses')
  })

  test('courses page loads with section heading or empty state', async ({ page }) => {
    await page.goto('/courses')
    // Either the "Cursos Disponibles" h1 or one of the section h2s must be visible.
    const heading = page.getByRole('heading', {
      name: /Cursos Disponibles|Available Courses|Cursos Completos|Clases Mensuales/i,
    })
    await expect(heading.first()).toBeVisible()
  })

  test('/dashboard redirects anonymous users to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('community page shows login CTA when anonymous', async ({ page }) => {
    await page.goto('/community')
    // Anonymous users see the joinTitle heading and a link to /login
    await expect(
      page.getByRole('heading', { name: /Únete a la Comunidad|Join the Community/i })
    ).toBeVisible()
    // The login link is a plain <a href="/login"> inside the community component
    const loginLink = page.locator('a[href="/login"]').first()
    await expect(loginLink).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill('nobody-exists@example.com')
    await page.locator('#password').fill('wrongwrongwrong')
    await page.getByRole('button', { name: /iniciar sesión|sign in/i }).click()
    // Server redirects to /login?error=invalid_credentials which renders the
    // error message from t.errors.invalid_credentials
    await expect(
      page.getByText(/Credenciales incorrectas|Invalid credentials/i)
    ).toBeVisible({ timeout: 10_000 })
  })
})
