'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/auth/require-admin'
import { TEST_COOKIE, TEST_COOKIE_OPTS, TEST_TTL_MS, signToken } from '@/utils/demo/test-mode'

export async function enableTestMode(): Promise<void> {
  await requireAdmin()
  const token = signToken(Date.now() + TEST_TTL_MS) // lanza si falta el secreto
  const store = await cookies()
  store.set(TEST_COOKIE, token, TEST_COOKIE_OPTS)
  revalidatePath('/admin/pruebas')
  revalidatePath('/', 'layout')
}

export async function disableTestMode(): Promise<void> {
  await requireAdmin()
  const store = await cookies()
  store.delete({ name: TEST_COOKIE, path: '/' })
  revalidatePath('/admin/pruebas')
  revalidatePath('/', 'layout')
}
