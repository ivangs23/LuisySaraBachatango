import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword } from '@/utils/checkout/password-hash'

describe('hashPassword', () => {
  it('produces a bcrypt $2a/$2b hash at cost 12 that verifies', async () => {
    const hash = await hashPassword('Bachata2026')
    expect(hash).toMatch(/^\$2[ab]\$12\$/)
    expect(await bcrypt.compare('Bachata2026', hash)).toBe(true)
    expect(await bcrypt.compare('wrong', hash)).toBe(false)
  })
  it('produces distinct hashes for the same input (salted)', async () => {
    expect(await hashPassword('Bachata2026')).not.toBe(await hashPassword('Bachata2026'))
  })
})
