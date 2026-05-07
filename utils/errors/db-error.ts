import 'server-only'

type ErrorLike = { code?: string; message?: string; details?: string } | null | undefined | unknown

/**
 * Logs the raw DB error to the server (Sentry/Vercel logs) and returns a
 * generic, safe message for the client. Use whenever a server action would
 * otherwise return `error.message` to avoid leaking schema details to
 * authenticated users.
 */
export function dbErrorMessage(scope: string, err: ErrorLike): string {
  const errObj = (typeof err === 'object' && err !== null) ? err as { code?: string; message?: string; details?: string } : null
  console.error(`[${scope}] db error`, {
    code: errObj?.code,
    message: errObj?.message,
    details: errObj?.details,
  })
  return 'server_error'
}
