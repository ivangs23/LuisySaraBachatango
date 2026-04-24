import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures/auth'

/**
 * Admin CRUD flows: create / edit a course, access the submissions grading page.
 *
 * Requires:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *
 * IMPORTANT: there is no course-delete UI or action in the app, so courses
 * created by these tests LEAK. To keep the test corpus from polluting public
 * views we always create courses with `isPublished = false`.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

async function findFirstCourseId(page: import('@playwright/test').Page): Promise<string | null> {
  await page.goto('/courses')
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/courses/"]'))
    const match = anchors.find((a) => /^\/courses\/[0-9a-f-]{10,}$/i.test(a.getAttribute('href') || ''))
    const href = match?.getAttribute('href') || null
    return href ? href.replace('/courses/', '') : null
  })
}

test.describe('Admin CRUD flows', () => {
  test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set')

  test('admin creates a course (unpublished) via /courses/create', async ({ page }) => {
    await loginAs(page, adminEmail!, adminPassword!)
    await page.goto('/courses/create')

    await expect(page.getByRole('heading', { name: /Crear Nuevo Curso/i })).toBeVisible()

    const title = `E2E course ${Date.now()}`
    await page.locator('#title').fill(title)
    await page.locator('#description').fill('Unpublished course created by Playwright e2e suite.')
    await page.locator('#year').fill('2030')
    await page.locator('#month').selectOption('1')
    await page.locator('#category').selectOption('bachatango')
    // Leave courseType at default (membership). If the form renders priceEur
    // conditionally, we skip filling it.
    // Ensure isPublished is unchecked so this course never appears publicly.
    const publishedCheckbox = page.locator('#isPublished')
    if (await publishedCheckbox.isChecked()) {
      await publishedCheckbox.uncheck()
    }

    await page.getByRole('button', { name: /Crear Curso|Create Course/i }).click()

    // Server action redirects to the new course detail page.
    await page.waitForURL(/\/courses\/[0-9a-f-]{10,}$/i, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible()
  })

  test('admin edit page loads with prepopulated fields', async ({ page }) => {
    await loginAs(page, adminEmail!, adminPassword!)
    const courseId = await findFirstCourseId(page)
    test.skip(!courseId, 'No published courses in DB to edit')

    await page.goto(`/courses/${courseId}/edit`)
    await expect(page.getByRole('heading', { name: /Editar Curso|Edit Course/i })).toBeVisible()
    // Title input must carry a non-empty value (prepopulated from DB).
    const titleValue = await page.locator('#title').inputValue()
    expect(titleValue.length).toBeGreaterThan(0)

    // Save button is disabled until the form becomes dirty.
    const saveButton = page.getByRole('button', { name: /Guardar Cambios|Save Changes/i })
    await expect(saveButton).toBeDisabled()

    // Dirty the description to enable the save button.
    const descInput = page.locator('#description')
    const originalDesc = (await descInput.inputValue()) || ''
    await descInput.fill(`${originalDesc} [touched-${Date.now()}]`)
    await expect(saveButton).toBeEnabled()

    // Restore original to avoid leaving edits behind.
    await descInput.fill(originalDesc)
    await expect(saveButton).toBeDisabled()
  })

  test('admin can reach /courses/create (is not redirected like non-admins)', async ({ page }) => {
    await loginAs(page, adminEmail!, adminPassword!)
    await page.goto('/courses/create')
    await expect(page).toHaveURL(/\/courses\/create$/)
    await expect(page.getByRole('heading', { name: /Crear Nuevo Curso/i })).toBeVisible()
  })

  test('submissions page is gated to admins', async ({ page }) => {
    await loginAs(page, adminEmail!, adminPassword!)
    // Find any course → its first lesson. We need a lesson id to hit the
    // submissions route. If none exists, skip.
    const courseId = await findFirstCourseId(page)
    test.skip(!courseId, 'No published courses')

    await page.goto(`/courses/${courseId}`)
    const firstLessonLink = page.locator(`a[href^="/courses/${courseId}/"]`).first()
    if ((await firstLessonLink.count()) === 0) {
      test.skip(true, 'Course has no lessons')
      return
    }
    const lessonHref = await firstLessonLink.getAttribute('href')
    const lessonId = lessonHref?.split('/').pop()
    test.skip(!lessonId, 'Could not resolve lesson id')

    const submissionsPath = `/courses/${courseId}/${lessonId}/submissions`
    const response = await page.goto(submissionsPath)
    // The page either renders the grading UI (when an assignment exists) or
    // calls notFound() (404). In either case, it must NOT redirect away.
    const status = response?.status() ?? 0
    const onTargetPath = page.url().includes('/submissions')
    expect(status === 404 || onTargetPath).toBe(true)
  })
})
