import { describe, it, expect } from 'vitest'
import {
  attributionFromMetadata,
  attributionToMetadata,
  buildFbcFromFbclid,
  collectAttribution,
  META_KEYS,
  STRIPE_METADATA_MAX,
} from '@/utils/analytics/meta-attribution'

const NOW = 1_760_000_000_000

describe('buildFbcFromFbclid', () => {
  it('usa el formato que documenta Meta', () => {
    expect(buildFbcFromFbclid('IwAR123abc', NOW)).toBe(`fb.1.${NOW}.IwAR123abc`)
  })

  it('rechaza un fbclid con caracteres que no son suyos', () => {
    // Un enlace manipulado no debe poder inyectar nada en session.metadata.
    for (const raw of ['abc;drop', 'a b', '<script>', 'x"y', 'é']) {
      expect(buildFbcFromFbclid(raw, NOW)).toBeNull()
    }
  })

  it('devuelve null sin fbclid', () => {
    for (const raw of ['', '   ', null, undefined]) {
      expect(buildFbcFromFbclid(raw, NOW)).toBeNull()
    }
  })
})

describe('collectAttribution', () => {
  const base = { marketingConsent: true, nowMs: NOW }

  it('prefiere la cookie _fbc al fbclid de la URL', () => {
    // La cookie la escribió el píxel con el clic real; el parámetro lo puede
    // pegar cualquiera.
    const a = collectAttribution({ ...base, fbcCookie: 'fb.1.111.COOKIE', fbclid: 'URLPARAM' })
    expect(a.fbc).toBe('fb.1.111.COOKIE')
  })

  it('reconstruye el fbc desde el fbclid si no hay cookie', () => {
    const a = collectAttribution({ ...base, fbclid: 'URLPARAM' })
    expect(a.fbc).toBe(`fb.1.${NOW}.URLPARAM`)
  })

  it('descarta la IP "anon" que devuelve getClientIp sin cabeceras', () => {
    expect(collectAttribution({ ...base, ip: 'anon' }).ip).toBeNull()
    expect(collectAttribution({ ...base, ip: '1.2.3.4' }).ip).toBe('1.2.3.4')
  })

  it('recorta al límite de Stripe para no tumbar la creación de la sesión', () => {
    const ua = 'Mozilla/'.repeat(200)
    const a = collectAttribution({ ...base, userAgent: ua })
    expect(a.ua!.length).toBe(STRIPE_METADATA_MAX)
  })

  it('arrastra el consentimiento tal cual', () => {
    expect(collectAttribution({ ...base, marketingConsent: false }).marketingConsent).toBe(false)
  })
})

describe('attributionToMetadata', () => {
  it('siempre escribe el consentimiento, también cuando es no', () => {
    const meta = attributionToMetadata({ fbp: null, fbc: null, ip: null, ua: null, marketingConsent: false })
    expect(meta).toEqual({ [META_KEYS.consent]: '0' })
  })

  it('no gasta claves de metadata en valores nulos', () => {
    const meta = attributionToMetadata({ fbp: 'fb.1.1.p', fbc: null, ip: null, ua: 'UA', marketingConsent: true })
    expect(Object.keys(meta).sort()).toEqual([META_KEYS.consent, META_KEYS.fbp, META_KEYS.ua].sort())
  })
})

describe('attributionFromMetadata', () => {
  it('recupera lo guardado sin pérdida', () => {
    const original = { fbp: 'fb.1.1.p', fbc: 'fb.1.2.c', ip: '1.2.3.4', ua: 'UA', marketingConsent: true }
    expect(attributionFromMetadata(attributionToMetadata(original))).toEqual(original)
  })

  it('sin consentimiento guardado asume que NO lo hay', () => {
    // Fail-closed: una sesión antigua, sin la clave, no autoriza nada.
    expect(attributionFromMetadata({}).marketingConsent).toBe(false)
    expect(attributionFromMetadata(null).marketingConsent).toBe(false)
    expect(attributionFromMetadata({ [META_KEYS.consent]: 'true' }).marketingConsent).toBe(false)
    expect(attributionFromMetadata({ [META_KEYS.consent]: '1' }).marketingConsent).toBe(true)
  })
})
