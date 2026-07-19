import { test as base, expect } from '@playwright/test'

export const test = base.extend({})
export { expect }

/**
 * Test account credentials, read from the same E2E_USER_* / E2E_ADMIN_*
 * env vars the spec files use (see e2e/README.md). No hardcoded fallbacks:
 * when a credential is missing the fields are undefined — call
 * `skipWithoutUser(...)` (or `test.skip`) so the dependent tests skip
 * instead of running with bogus credentials.
 */
export const TEST_USERS = {
  member: {
    email: process.env.E2E_USER_EMAIL,
    password: process.env.E2E_USER_PASSWORD,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
  },
}

/** Skips the current suite/test when the given account is not configured. */
export function skipWithoutUser(role: keyof typeof TEST_USERS) {
  const { email, password } = TEST_USERS[role]
  const prefix = role === 'admin' ? 'E2E_ADMIN' : 'E2E_USER'
  test.skip(!email || !password, `${prefix}_EMAIL / ${prefix}_PASSWORD not set`)
}
