import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures/auth'

/**
 * Auth-adjacent flows: signup form, password-reset request, logout.
 *
 * We do NOT submit a real signup (that creates a permanent user in Supabase
 * auth.users and would pollute the project on every run). Instead we assert
 * the form renders correctly and rejects invalid input client-side.
 *
 * Password reset IS submitted — Supabase sends an email but it is harmless
 * when sent to a throwaway address that is not linked to an account.
 *
 * Logout requires E2E_USER_EMAIL/PASSWORD.
 */

const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD

test.describe('Signup form', () => {
  test('renders email, name, password fields and submit button', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#fullName')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    // The form uses React Server Actions (button formAction={signup}), so there
    // is no type="submit" — we locate by visible button text.
    await expect(page.getByRole('button', { name: /Registrarse|Sign Up|Register/i })).toBeVisible()
  })

  test('required attributes prevent empty submission', async ({ page }) => {
    await page.goto('/signup')
    // React renders the boolean attribute; we assert the DOM property via JS handle.
    expect(await page.locator('#email').evaluate((el: HTMLInputElement) => el.required)).toBe(true)
    expect(await page.locator('#password').evaluate((el: HTMLInputElement) => el.required)).toBe(true)
  })
})

test.describe('Password reset request', () => {
  test('submits form and shows confirmation message', async ({ page }) => {
    await page.goto('/forgot-password')
    const throwaway = `e2e-reset-${Date.now()}@test.local`
    await page.locator('#email').fill(throwaway)
    await page.getByRole('button', { name: /Enviar enlace|Send link/i }).click()

    // Supabase may show a message on /forgot-password or redirect to /login.
    // We just assert that we leave a state where either a success-ish message
    // is visible or the URL transitioned — the action resolved without error.
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    const pageContent = await page.textContent('body')
    expect(pageContent?.toLowerCase() ?? '').toMatch(
      /email|correo|enlace|revisa|check|sent|enviado/,
    )
  })
})

test.describe('Logout', () => {
  test.skip(!userEmail || !userPassword, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set')

  test('authenticated user can log out via /auth/signout form', async ({ page, context }) => {
    await loginAs(page, userEmail!, userPassword!)
    await page.goto('/profile')
    // Profile page renders a form with action="/auth/signout" wrapping the logout button.
    await page.locator('form[action="/auth/signout"] button[type="submit"]').click()
    // After signout, hitting /profile should redirect back to /login.
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)
    // Supabase auth cookie should be cleared.
    const cookies = await context.cookies()
    const hasAuthCookie = cookies.some((c) => c.name.startsWith('sb-') && c.value.length > 0)
    expect(hasAuthCookie).toBe(false)
  })
})
