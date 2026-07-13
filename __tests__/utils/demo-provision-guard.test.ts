import { describe, it, expect } from 'vitest'
import { canProvisionInline, supabaseRefFromUrl, PROD_SUPABASE_REF } from '@/utils/checkout/demo-provision-guard'

const PROD = `https://${PROD_SUPABASE_REF}.supabase.co`
const OTHER = 'https://abcdefabcdefabcdefgh.supabase.co'

describe('supabaseRefFromUrl', () => {
  it('extracts the project ref', () => {
    expect(supabaseRefFromUrl(PROD)).toBe(PROD_SUPABASE_REF)
    expect(supabaseRefFromUrl('not a url')).toBe(null)
  })
})

describe('canProvisionInline', () => {
  it('admin cookie: allowed on any DB incl prod', () => {
    expect(canProvisionInline({ triggeredByAdminCookie: true, supabaseUrl: PROD })).toBe(true)
    expect(canProvisionInline({ triggeredByAdminCookie: true, supabaseUrl: OTHER })).toBe(true)
  })
  it('env-trigger (isDemoMode) allowed only on non-prod DB', () => {
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: OTHER })).toBe(true)
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: PROD })).toBe(false)
  })
  it('unknown url with env-trigger fails closed', () => {
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: undefined })).toBe(false)
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: 'garbage' })).toBe(false)
  })
  it('uppercase-cased prod host is still treated as prod (env-trigger refuses)', () => {
    const UP = 'https://JYTOKOXBSYKOYIFZBJKD.supabase.co'
    expect(supabaseRefFromUrl(UP)).toBe(PROD_SUPABASE_REF)
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: UP })).toBe(false)
    expect(canProvisionInline({ triggeredByAdminCookie: true, supabaseUrl: UP })).toBe(true)
  })
  it('prod-ref lookalike host (suffix) is treated as prod, not non-prod', () => {
    const EVIL = 'https://jytokoxbsykoyifzbjkd.supabase.co.evil.com'
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: EVIL })).toBe(false)
  })
})
