import { test, expect } from '@playwright/test'
const SP = process.env.SP!

test('la landing muestra el vídeo sin reproducir y arranca al pulsar', async ({ page }) => {
  const muxRequests: string[] = []
  page.on('request', r => { if (r.url().includes('mux')) muxRequests.push(r.url()) })

  await page.goto('/curso-bachatango')
  await page.getByRole('button', { name: /rechazar/i }).click().catch(() => {})

  const section = page.locator('#clase-gratis')
  await section.scrollIntoViewIfNeeded()

  // 1. Ya no hay botón-enlace a /clase-gratis en esta sección
  await expect(section.locator('a[href="/clase-gratis"]')).toHaveCount(0)

  // 2. Hay una fachada pulsable con la miniatura firmada
  const facade = section.getByRole('button', { name: /reproducir la clase gratis/i })
  await expect(facade).toBeVisible()
  const poster = facade.locator('img')
  await expect(poster).toHaveAttribute('src', /image\.mux\.com\/.+thumbnail\.jpg\?token=/)
  // la miniatura carga de verdad (no 403 por token ausente o caducado)
  await expect.poll(() => poster.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThan(0)

  // 3. El reproductor NO se ha descargado todavía
  expect(muxRequests.filter(u => u.includes('mux-player')), 'el player se cargó sin pulsar')
    .toHaveLength(0)

  await section.screenshot({ path: `${SP}/embed-parado.png` })

  // 4. Al pulsar aparece el reproductor en el mismo sitio
  await facade.click()
  await expect(section.locator('mux-player')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(2500)
  await section.screenshot({ path: `${SP}/embed-reproduciendo.png` })

  // 5. Y está reproduciendo, no solo montado
  const t = await section.locator('mux-player')
    .evaluate((el: HTMLMediaElement & Element) => (el as unknown as HTMLMediaElement).currentTime)
  expect(t, 'el vídeo no avanzó tras pulsar').toBeGreaterThan(0)
})
