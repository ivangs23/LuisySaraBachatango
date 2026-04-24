import { Page } from '@playwright/test'

/**
 * Signs in via the real login form at /login.
 *
 * The login page uses labels without `for` attributes (plain <label> wrapping
 * the input text, with `id="email"` / `id="password"` on the inputs).
 * We target by id to keep selectors stable across locale changes.
 *
 * On error the server redirects to /login?error=invalid_credentials — the
 * function will time out at `waitForURL` in that case, which surfaces the
 * failure clearly in test output.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /iniciar sesión|inicio de sesión|sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}
