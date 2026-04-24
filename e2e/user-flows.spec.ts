import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures/auth'

/**
 * Flows for a non-admin authenticated user.
 *
 * Requires:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 */

const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD

test.describe('Authenticated user', () => {
  test.skip(!userEmail || !userPassword, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set')

  test('profile form loads with editable fields', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/profile')

    await expect(page.getByRole('heading', { name: /Mi Perfil|My Profile/i })).toBeVisible()
    await expect(page.locator('#fullName')).toBeVisible()
    await expect(page.locator('#instagram')).toBeVisible()
    await expect(page.locator('#facebook')).toBeVisible()
    await expect(page.locator('#tiktok')).toBeVisible()
    await expect(page.locator('#youtube')).toBeVisible()
    // Save button is disabled until the form is dirty.
    const saveButton = page.getByRole('button', { name: /Guardar Cambios|Save Changes/i })
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeDisabled()
  })

  test('dirtying fullName enables the save button and update persists', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/profile')

    const nameInput = page.locator('#fullName')
    const originalName = (await nameInput.inputValue()) || ''
    const stamped = `${originalName.replace(/\s*\[e2e-\d+\]$/, '')} [e2e-${Date.now()}]`.trim()

    await nameInput.fill(stamped)
    const saveButton = page.getByRole('button', { name: /Guardar Cambios|Save Changes/i })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Server action revalidates and the button goes back to disabled.
    await expect(saveButton).toBeDisabled({ timeout: 10_000 })
    await page.reload()
    await expect(page.locator('#fullName')).toHaveValue(stamped)

    // Restore original name so the next run starts from a clean state.
    if (originalName && originalName !== stamped) {
      await page.locator('#fullName').fill(originalName)
      await saveButton.click()
      await expect(saveButton).toBeDisabled({ timeout: 10_000 })
    }
  })

  test('dashboard renders for logged-in user', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Mis Cursos|My Courses/i })
    ).toBeVisible()
  })

  test('community: authenticated user sees Crear Post CTA', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/community')
    await expect(
      page.getByRole('heading', { name: /Comunidad|Community/i }).first()
    ).toBeVisible()
    await expect(page.locator('a[href="/community/create"]').first()).toBeVisible()
  })

  test('community: create a post and comment on it', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/community/create')

    const postTitle = `E2E post ${Date.now()}`
    await page.locator('#title').fill(postTitle)
    await page.locator('#content').fill('Post automated from Playwright e2e suite.')
    await page.getByRole('button', { name: /Publicar|Publish/i }).click()

    // The submitPost action redirects to the post detail page.
    await page.waitForURL(/\/community\/[^/]+$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: new RegExp(postTitle) })).toBeVisible()

    // Post a comment on the newly-created post.
    const commentTextarea = page.locator('form textarea[name="content"]')
    await commentTextarea.fill(`E2E comment ${Date.now()}`)
    await page.getByRole('button', { name: /Comentar|Comment/i }).click()

    // Comments count heading updates; new comment text appears on the page.
    await expect(page.getByText(/E2E comment/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('non-admin cannot access admin routes', async ({ page }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/courses/create')
    // The create page checks role === admin and redirects non-admins.
    await expect(page).not.toHaveURL(/\/courses\/create$/)
  })
})
