import { test, expect } from '@playwright/test'
const SP = process.env.SP!

test('el subtítulo del catálogo es solo la promesa corta', async ({ page }) => {
  await page.goto('/courses')
  await page.getByRole('button', { name: /rechazar/i }).click().catch(() => {})

  // El subtítulo es el párrafo inmediatamente posterior al h1.
  const sub = page.locator('h1').locator('xpath=following::p[1]')
  await expect(sub).toHaveText('Precio fijo · Acceso permanente')

  // El detalle de los mensuales ya no cuelga de la cabecera. Sigue existiendo
  // en la cabecera de su propia sección, que solo se pinta si hay cursos
  // mensuales publicados — por eso no se afirma nada sobre su presencia.
  await expect(page.locator('h1').locator('..')).not.toContainText('4 clases por mes')

  await page.screenshot({ path: `${SP}/courses-sub.png`, clip: { x: 0, y: 0, width: 1280, height: 620 } })
})
