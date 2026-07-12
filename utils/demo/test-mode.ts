/**
 * Modo pruebas activable por admin, con alcance PER-NAVEGADOR.
 *
 * Una cookie firmada (`lsb_test_mode`) es la CAPACIDAD que activa el pago
 * simulado. Solo un admin la emite (server action tras requireAdmin). La
 * verificación NO confía en el rol: la cookie es la prueba de que un admin la
 * emitió, lo que permite probar también el flujo guest (deslogueado).
 *
 * Fail-closed: sin TEST_MODE_SECRET, verifyToken→false y signToken lanza.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { isDemoMode } from './mode'

export const TEST_COOKIE = 'lsb_test_mode'
export const TEST_TTL_MS = 2 * 60 * 60 * 1000 // 2h

export const TEST_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: TEST_TTL_MS / 1000, // 7200s
}

function secret(): string | null {
  return process.env.TEST_MODE_SECRET || null
}

function hmac(s: string, data: string): string {
  return createHmac('sha256', s).update(data).digest('hex')
}

export function isTestModeConfigured(): boolean {
  return !!secret()
}

export function signToken(expiryMs: number): string {
  const s = secret()
  if (!s) throw new Error('TEST_MODE_SECRET no configurado')
  return `${expiryMs}.${hmac(s, String(expiryMs))}`
}

export function verifyToken(value: string | undefined): boolean {
  const s = secret()
  if (!s || !value) return false
  const dot = value.indexOf('.')
  if (dot <= 0) return false
  const expiryStr = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expiryMs = Number(expiryStr)
  if (!Number.isFinite(expiryMs)) return false
  const expected = hmac(s, expiryStr)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  if (!timingSafeEqual(a, b)) return false
  return Date.now() < expiryMs
}

export async function readTestCookie(): Promise<boolean> {
  const store = await cookies()
  return verifyToken(store.get(TEST_COOKIE)?.value)
}

export async function isTestPurchaseMode(): Promise<boolean> {
  return isDemoMode() || (await readTestCookie())
}

export async function testCookieExpiry(): Promise<number | null> {
  const store = await cookies()
  const value = store.get(TEST_COOKIE)?.value
  if (!verifyToken(value)) return null
  return Number(value!.slice(0, value!.indexOf('.')))
}
