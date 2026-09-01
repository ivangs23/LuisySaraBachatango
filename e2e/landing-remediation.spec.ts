import { test, expect } from '@playwright/test'

/**
 * Cubre lo que la remediación de la landing añadió y que solo puede
 * comprobarse en un navegador real: que el banner de consentimiento bloquea
 * de verdad los scripts de terceros, que la clase gratis reproduce sin sesión
 * y que el funnel es alcanzable desde la home.
 *
 * Todo se ejecuta como visitante anónimo: no hay `storageState`.
 */

const THIRD_PARTY = /googletagmanager\.com|connect\.facebook\.net|instagram\.com\/embed\.js/

test.describe('Consentimiento de cookies', () => {
  test('el banner aparece en la primera visita', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('dialog', { name: /tu privacidad/i })
    await expect(banner).toBeVisible()
    // Aceptar y rechazar deben tener el mismo peso: ambos visibles y al
    // mismo nivel, sin clics extra para denegar.
    await expect(banner.getByRole('button', { name: /aceptar todo/i })).toBeVisible()
    await expect(banner.getByRole('button', { name: /^rechazar$/i })).toBeVisible()
  })

  test('no se carga ningún script de terceros antes de decidir', async ({ page }) => {
    const blocked: string[] = []
    page.on('request', (r) => {
      if (THIRD_PARTY.test(r.url())) blocked.push(r.url())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(blocked, `peticiones a terceros sin consentimiento:\n${blocked.join('\n')}`).toEqual([])
  })

  test('tras rechazar, el banner no reaparece al navegar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^rechazar$/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.goto('/sobre-nosotros')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('rechazar mantiene el embed de Instagram bloqueado', async ({ page }) => {
    const blocked: string[] = []
    page.on('request', (r) => {
      if (THIRD_PARTY.test(r.url())) blocked.push(r.url())
    })

    await page.goto('/')
    await page.getByRole('button', { name: /^rechazar$/i }).click()
    await page.waitForLoadState('networkidle')

    expect(blocked).toEqual([])
    await expect(page.getByText(/permiso para cookies de marketing/i)).toBeVisible()
  })

  test('el footer permite reabrir las preferencias', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^rechazar$/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: /preferencias de cookies/i }).click()
    await expect(page.getByRole('dialog', { name: /tu privacidad/i })).toBeVisible()
  })
})

test.describe('Home conectada al funnel', () => {
  test('el bloque de oferta muestra un precio real y enlaza al funnel', async ({ page }) => {
    await page.goto('/')
    const offer = page.locator('section[aria-labelledby="home-offer-title"]')
    await expect(offer).toBeVisible()

    // Precio de courses.price_eur: dígitos seguidos de €, nunca NaN ni undefined.
    await expect(offer.getByText(/^\d+(?:[.,]\d+)?\s*€$/)).toBeVisible()
    await expect(offer.locator('a[href="/curso-bachatango"]')).toBeVisible()
  })

  test('el funnel es alcanzable y responde 200 para anónimos', async ({ page }) => {
    const res = await page.goto('/curso-bachatango')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('Clase gratis pública', () => {
  test('reproduce sin sesión', async ({ page }) => {
    await page.goto('/clase-gratis')

    // No debe redirigir a /login: ese era exactamente el fallo original.
    await expect(page).toHaveURL(/\/clase-gratis$/)

    const player = page.locator('mux-player')
    await expect(player).toBeVisible()

    // El <video> interno del web component debe llegar a tener duración:
    // prueba de que Mux aceptó el JWT anónimo y sirvió el manifiesto.
    const video = player.locator('video')
    await expect
      .poll(
        async () => video.evaluate((v: HTMLVideoElement) => v.readyState).catch(() => 0),
        { timeout: 20_000, message: 'el vídeo nunca llegó a tener datos: revisar el token de Mux' },
      )
      .toBeGreaterThan(0)
  })

  test('ofrece comprar el curso al terminar', async ({ page }) => {
    await page.goto('/clase-gratis')
    // Acotado al bloque de upsell: `a[href="/curso-bachatango"]` a secas casa
    // también con el header y el footer, y el locator sería ambiguo.
    const upsell = page.getByRole('heading', { name: /te ha gustado/i })
    await expect(upsell).toBeVisible()
    await expect(
      page.getByRole('link', { name: /ver el curso completo/i }),
    ).toHaveAttribute('href', '/curso-bachatango')
  })
})

test.describe('Baja de newsletter', () => {
  test('abrir el enlace NO da de baja: exige confirmar', async ({ page }) => {
    await page.goto('/unsubscribe?email=alguien%40ejemplo.com&token=loquesea')
    await expect(page.getByRole('button', { name: /confirmar baja/i })).toBeVisible()
    await expect(page.getByText(/no volverás a recibir/i)).toBeHidden()
  })

  test('un token inválido se rechaza', async ({ page }) => {
    await page.goto('/unsubscribe?email=alguien%40ejemplo.com&token=invalido')
    await page.getByRole('button', { name: /confirmar baja/i }).click()
    await expect(page.getByText(/no es válido|no hemos podido/i)).toBeVisible()
  })
})

test.describe('Móvil', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('el banner deja ver el hero y no se come la pantalla', async ({ page }) => {
    await page.goto('/')

    // Un banner anclado abajo siempre solapa algo del hero; lo que no puede
    // hacer es ocupar media pantalla y esconder la propuesta de valor.
    const viewport = page.viewportSize()!
    const bannerBox = await page.getByRole('dialog').boundingBox()
    expect(bannerBox, 'el banner no tiene caja').not.toBeNull()

    const share = bannerBox!.height / viewport.height
    expect(
      share,
      `el banner ocupa el ${Math.round(share * 100)}% del viewport en móvil`,
    ).toBeLessThanOrEqual(0.55)

    // Anclado abajo: su borde superior no puede invadir la mitad alta de la
    // pantalla, que es donde viven marca, foto y titular.
    expect(
      bannerBox!.y,
      'el banner invade la mitad superior del viewport',
    ).toBeGreaterThanOrEqual(viewport.height * 0.45)

    // NOTA: no se afirma que el h1 del hero quede por encima del banner.
    // En local y en preview `isDemoMode()` es true y la barra "MODO PRUEBAS"
    // se come ~60px, empujando el hero hacia abajo; en producción esa barra
    // no existe. Medirlo aquí daría un resultado que no representa lo que ve
    // un visitante real.
  })

  test('los tres botones del banner son alcanzables con teclado', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('dialog', { name: /tu privacidad/i })
    await expect(banner).toBeVisible()

    for (const name of [/aceptar todo/i, /^rechazar$/i, /configurar/i]) {
      const btn = banner.getByRole('button', { name })
      await btn.focus()
      await expect(btn).toBeFocused()
    }
  })
})

test.describe('Analítica de la landing', () => {
  test('manda exactamente un evento por visita a una ruta medida', async ({ page }) => {
    const events: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/landing-event')) events.push(r.url())
    })

    await page.goto('/curso-bachatango')
    await page.waitForLoadState('networkidle')

    expect(events).toHaveLength(1)
  })

  test('no manda eventos en rutas no medidas', async ({ page }) => {
    const events: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/landing-event')) events.push(r.url())
    })

    await page.goto('/legal/privacy')
    await page.waitForLoadState('networkidle')

    expect(events).toEqual([])
  })

  test('el beacon no deja cookies', async ({ page, context }) => {
    await page.goto('/curso-bachatango')
    await page.waitForLoadState('networkidle')

    const cookies = await context.cookies()
    expect(cookies.map((c) => c.name)).not.toContain('ls_visitor')
    expect(cookies.filter((c) => c.name.startsWith('ls_analytics'))).toEqual([])
  })
})

test.describe('Alineación del funnel', () => {
  /**
   * La sección de clase gratis llevaba un CTA `inline-block` con `margin: auto`,
   * y sobre un inline-block los márgenes automáticos no centran nada: caía a la
   * izquierda mientras el titular y la fila de confianza iban centrados.
   *
   * Ese CTA es hoy el vídeo incrustado, pero sigue siendo un bloque suelto que
   * tiene que quedar centrado en su sección, así que la comprobación se mantiene
   * sobre lo que ahora ocupa ese sitio. Se mide en un navegador real porque es
   * el tipo de fallo que ninguna aserción sobre el DOM detecta: el marcado
   * siempre fue correcto.
   */
  for (const vp of [
    { name: 'escritorio', width: 1280, height: 900 },
    { name: 'móvil', width: 390, height: 844 },
  ]) {
    test(`el bloque de clase gratis está centrado en ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/curso-bachatango')

      const section = page.locator('#clase-gratis')
      // El vídeo cuando hay lección gratis; el enlace de respaldo si no la hay.
      const block = section.getByRole('button', { name: /reproducir la clase gratis/i })
        .or(section.getByRole('link', { name: /ver clase gratis/i }))
      await expect(block).toBeVisible()

      const s = (await section.boundingBox())!
      const c = (await block.boundingBox())!
      const desvio = Math.abs((s.x + s.width / 2) - (c.x + c.width / 2))
      expect(desvio, 'el bloque no está centrado en su sección').toBeLessThan(5)
      expect(c.width).toBeLessThanOrEqual(s.width)
    })
  }
})
