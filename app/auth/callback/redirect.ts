const SAFE_REDIRECT_PREFIXES = [
  '/dashboard',
  '/profile',
  '/courses',
  '/community',
  '/events',
  '/agenda',
] as const

export function isSafeRedirect(next: string | null | undefined): boolean {
  if (!next || typeof next !== 'string') return false
  if (!next.startsWith('/')) return false
  // Block protocol-relative and backslash/control-character tricks.
  if (next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/;')) return false
  // Reject any control characters or whitespace inside the path.
  if (/[\s\\]/.test(next)) return false
  if (next === '/') return true
  return SAFE_REDIRECT_PREFIXES.some(
    p => next === p || next.startsWith(`${p}/`) || next.startsWith(`${p}?`) || next.startsWith(`${p}#`)
  )
}
