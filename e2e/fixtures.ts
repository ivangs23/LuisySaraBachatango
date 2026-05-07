import { test as base, expect } from '@playwright/test'

export const test = base.extend({})
export { expect }

export const TEST_USERS = {
  member: {
    email: process.env.E2E_MEMBER_EMAIL ?? 'e2e-member@example.test',
    password: process.env.E2E_MEMBER_PASSWORD ?? 'changeme-e2e',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.test',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'changeme-e2e',
  },
}
