import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCookieGet, mockIsDemoMode } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockIsDemoMode: vi.fn().mockReturnValue(false),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))

import {
  signToken, verifyToken, readTestCookie, isTestPurchaseMode,
  testCookieExpiry, isTestModeConfigured, TEST_COOKIE, TEST_COOKIE_OPTS,
} from '@/utils/demo/test-mode'

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDemoMode.mockReturnValue(false)
  process.env.TEST_MODE_SECRET = 'unit-test-secret'
})
afterEach(() => { delete process.env.TEST_MODE_SECRET })

describe('signToken / verifyToken', () => {
  it('roundtrip válido → true', () => {
    expect(verifyToken(signToken(Date.now() + 60_000))).toBe(true)
  })
  it('expirado → false', () => {
    expect(verifyToken(signToken(Date.now() - 1000))).toBe(false)
  })
  it('hmac manipulado → false', () => {
    const t = signToken(Date.now() + 60_000)
    const bad = t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a')
    expect(verifyToken(bad)).toBe(false)
  })
  it('expiry manipulado (firma no cuadra) → false', () => {
    const t = signToken(Date.now() + 60_000)
    const sig = t.slice(t.indexOf('.') + 1)
    expect(verifyToken(`${Date.now() + 9_000_000}.${sig}`)).toBe(false)
  })
  it('ausente / vacía / sin punto → false', () => {
    expect(verifyToken(undefined)).toBe(false)
    expect(verifyToken('')).toBe(false)
    expect(verifyToken('nodot')).toBe(false)
  })
  it('firma de longitud distinta → false (sin excepción)', () => {
    const t = signToken(Date.now() + 60_000)
    const expiry = t.slice(0, t.indexOf('.'))
    expect(verifyToken(`${expiry}.abc`)).toBe(false)
  })
  it('sin secreto: verify siempre false, sign lanza', () => {
    const t = signToken(Date.now() + 60_000)
    delete process.env.TEST_MODE_SECRET
    expect(verifyToken(t)).toBe(false)
    expect(() => signToken(Date.now() + 60_000)).toThrow()
  })
  it('isTestModeConfigured refleja el secreto', () => {
    expect(isTestModeConfigured()).toBe(true)
    delete process.env.TEST_MODE_SECRET
    expect(isTestModeConfigured()).toBe(false)
  })
  it('TEST_COOKIE_OPTS tiene los flags de seguridad', () => {
    expect(TEST_COOKIE_OPTS).toEqual({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7200,
    })
    expect(TEST_COOKIE).toBe('lsb_test_mode')
  })
})

describe('readTestCookie / isTestPurchaseMode / testCookieExpiry', () => {
  it('cookie válida → readTestCookie true', async () => {
    mockCookieGet.mockReturnValue({ value: signToken(Date.now() + 60_000) })
    expect(await readTestCookie()).toBe(true)
  })
  it('sin cookie → readTestCookie false', async () => {
    mockCookieGet.mockReturnValue(undefined)
    expect(await readTestCookie()).toBe(false)
  })
  it('env demo true → isTestPurchaseMode true aunque no haya cookie', async () => {
    mockIsDemoMode.mockReturnValue(true)
    mockCookieGet.mockReturnValue(undefined)
    expect(await isTestPurchaseMode()).toBe(true)
  })
  it('sin env demo + cookie válida → isTestPurchaseMode true', async () => {
    mockIsDemoMode.mockReturnValue(false)
    mockCookieGet.mockReturnValue({ value: signToken(Date.now() + 60_000) })
    expect(await isTestPurchaseMode()).toBe(true)
  })
  it('sin env demo + sin cookie → isTestPurchaseMode false', async () => {
    mockIsDemoMode.mockReturnValue(false)
    mockCookieGet.mockReturnValue(undefined)
    expect(await isTestPurchaseMode()).toBe(false)
  })
  it('testCookieExpiry: expiryMs si válida, null si no', async () => {
    const exp = Date.now() + 60_000
    mockCookieGet.mockReturnValue({ value: signToken(exp) })
    expect(await testCookieExpiry()).toBe(exp)
    mockCookieGet.mockReturnValue(undefined)
    expect(await testCookieExpiry()).toBe(null)
  })
})
