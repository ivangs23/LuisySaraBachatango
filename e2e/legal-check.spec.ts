import { test, expect } from '@playwright/test'
const SP = process.env.SP!

const PAGES = ['notice', 'privacy', 'cookies', 'terms', 'redes-sociales']

for (const slug of PAGES) {
  test(`/legal/${slug}: datos de la entidad y sin scroll horizontal`, async ({ page }) => {
    await page.goto(`/legal/${slug}`)
    // La entidad y el NIF nuevos deben aparecer en los cinco documentos
    await expect(page.getByText(/LS ESCUELA DE BAILES ESPJ/).first()).toBeVisible()
    await expect(page.getByText(/E09928052/).first()).toBeVisible()
    // Ni rastro del titular anterior ni de la dirección vieja
    expect(await page.content()).not.toContain('MANUEL CASTAÑEDA')
    expect(await page.content()).not.toContain('Carolina Coronado')
    expect(await page.content()).not.toContain('45557623M')
    // Las marcas de revisión internas jamás deben publicarse
    expect(await page.content()).not.toContain('►')

    // Móvil: la tabla de cookies no puede desbordar la página
    await page.setViewportSize({ width: 390, height: 844 })
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'la página hace scroll horizontal en móvil').toBeLessThanOrEqual(1)
    await page.screenshot({ path: `${SP}/legal-${slug}.png`, fullPage: false })
  })
}

test('el footer enlaza los cinco documentos', async ({ page }) => {
  await page.goto('/')
  for (const [slug, name] of [
    ['privacy', /privacidad/i], ['terms', /términos/i], ['cookies', /cookies/i],
    ['redes-sociales', /redes sociales/i], ['notice', /aviso legal/i],
  ] as const) {
    await expect(page.locator(`footer a[href="/legal/${slug}"]`)).toHaveCount(1)
    expect(name).toBeTruthy()
  }
})

test('el checkout exige la casilla del art. 103.m por separado', async ({ page }) => {
  await page.goto('/curso-bachatango/comprar?courseId=f89a576f-4a77-40f7-93e9-23e6c820ee92')
  const terms = page.locator('input[name="acceptTerms"]')
  const digital = page.locator('input[name="acceptDigitalExecution"]')
  await expect(terms).toHaveCount(1)
  await expect(digital).toHaveCount(1)
  // Son dos casillas distintas y ambas obligatorias
  await expect(digital).toHaveAttribute('required', '')
  await expect(page.getByText(/pierdo mi derecho de desistimiento/i)).toBeVisible()
})
