/**
 * Re-exports from the memoized require-admin helper so existing imports of
 * `@/utils/admin/guard` continue to work without changes.
 *
 * The actual implementation lives in `@/utils/auth/require-admin`, which uses
 * `react/cache` to memoize the profiles lookup per request.
 */
export type { AdminUser } from '@/utils/auth/require-admin'
export { AdminGuardError, requireAdmin, getCurrentRole } from '@/utils/auth/require-admin'
