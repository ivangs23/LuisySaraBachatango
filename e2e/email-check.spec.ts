import { test, expect } from '@playwright/test'

const NUEVO = 'luisysarabachatango@gmail.com'
const VIEJO = 'contacto@luisysarabachatango.com'

test('los cinco documentos legales publican el correo definitivo', async ({ page }) => {
  for (const slug of ['notice', 'privacy', 'cookies', 'terms', 'redes-sociales']) {
    await page.goto(`/legal/${slug}`)
    const html = await page.content()
    expect(html, `${slug}: falta el correo nuevo`).toContain(NUEVO)
    expect(html, `${slug}: sigue el correo antiguo`).not.toContain(VIEJO)
  }
})

test('los avisos de los formularios llevan el mismo correo', async ({ page }) => {
  // El aviso va plegado en un <details>: se lee el DOM, no lo visible.
  await page.goto('/curso-bachatango/comprar?courseId=f89a576f-4a77-40f7-93e9-23e6c820ee92')
  expect(await page.content()).toContain(NUEVO)
  await page.goto('/contact')
  expect(await page.content()).toContain(NUEVO)
})

test('la baja de la newsletter apunta al mismo canal', async ({ page }) => {
  await page.goto('/unsubscribe')
  const html = await page.content()
  expect(html).toContain(NUEVO)
  expect(html).not.toContain(VIEJO)
})
