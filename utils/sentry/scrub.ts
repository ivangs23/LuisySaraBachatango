const SENSITIVE = new Set(['password', 'repeatPassword', 'repeat_password', 'password_hash'])

function walk(node: unknown, seen: WeakSet<object>): void {
  if (!node || typeof node !== 'object') return
  if (seen.has(node as object)) return
  seen.add(node as object)
  if (Array.isArray(node)) {
    for (const item of node) walk(item, seen)
    return
  }
  const obj = node as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (SENSITIVE.has(key)) obj[key] = '[Filtered]'
    else walk(obj[key], seen)
  }
}

/**
 * Recursively replaces any password-family field with '[Filtered]' in a Sentry
 * event's request.data and extra. Wired into beforeSend AND
 * beforeSendTransaction in all three sentry configs.
 */
export function scrubSensitive(event: { request?: { data?: unknown }; extra?: Record<string, unknown> }): void {
  const seen = new WeakSet<object>()
  walk(event.request?.data, seen)
  walk(event.extra, seen)
}
