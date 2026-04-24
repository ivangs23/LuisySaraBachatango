import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures/auth'

/**
 * Authenticated non-admin user smoke tests.
 *
 * Requires:
 *   E2E_USER_EMAIL    — email of a non-admin (member/premium) account
 *   E2E_USER_PASSWORD — password for that account
 *
 * Tests are skipped automatically when the env vars are not set.
 */

const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD

test.describe('Authenticated user flows', () => {
  test.skip(!userEmail || !userPassword, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set')

  test('logged-in user reaches dashboard', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/dashboard')
    // Dashboard renders t.dashboard.title = "Mis Cursos" (es)
    await expect(
      page.getByRole('heading', { name: /Mis Cursos|My Courses/i })
    ).toBeVisible()
  })

  test('non-admin cannot reach /courses/:id/add-lesson (redirects away)', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    // Navigate to courses list to grab a real course id
    await page.goto('/courses')
    const firstCourse = page.locator('a[href^="/courses/"]').first()
    if ((await firstCourse.count()) === 0) {
      test.skip(true, 'No published courses in DB')
      return
    }
    const href = await firstCourse.getAttribute('href')
    await page.goto(`${href}/add-lesson`)
    // Non-admin users are redirected to the course detail page, not /add-lesson
    await expect(page).not.toHaveURL(/add-lesson/)
  })
})
