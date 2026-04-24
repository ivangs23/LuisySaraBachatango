/**
 * Validates that a URL is a safe absolute HTTPS URL.
 * Returns the trimmed URL if valid, or null otherwise.
 */
export function sanitizeUrl(value: string | FormDataEntryValue | null | undefined): string | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'https:') return null
    return value.trim()
  } catch {
    return null
  }
}

/**
 * Returns a sanitized HTTPS URL or a safe fallback.
 * Use in components to render user-provided social links.
 */
export function safeSocialUrl(url: string | null | undefined, fallback: string): string {
  return sanitizeUrl(url) ?? fallback
}

/**
 * Hosts allowed for avatar URLs. Must stay in sync with next.config.ts
 * `images.remotePatterns`, otherwise <Image> throws at render time and
 * breaks the page for that user.
 */
const ALLOWED_AVATAR_HOSTS = new Set<string>([
  'jytokoxbsykoyifzbjkd.supabase.co',
])

/**
 * Validates an avatar URL is HTTPS and on an allowlisted host.
 * Returns the URL if safe, null otherwise (caller should fall back to placeholder).
 */
export function safeAvatarUrl(value: string | FormDataEntryValue | null | undefined): string | null {
  const url = sanitizeUrl(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!ALLOWED_AVATAR_HOSTS.has(parsed.hostname)) return null
    return url
  } catch {
    return null
  }
}
