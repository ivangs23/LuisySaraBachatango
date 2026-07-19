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

const SOCIAL_HOSTS: Record<string, ReadonlySet<string>> = {
  instagram: new Set(['instagram.com', 'www.instagram.com']),
  facebook: new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com']),
  tiktok: new Set(['tiktok.com', 'www.tiktok.com']),
  youtube: new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']),
}

export type SocialNetwork = keyof typeof SOCIAL_HOSTS

/**
 * Validates that a user-supplied URL is a HTTPS link to the canonical host
 * of a known social network. Rejects look-alike domains, http, and any URL
 * not on the whitelist. Returns the normalized URL or null.
 *
 * Use this at write time (when accepting profile updates), so untrusted
 * data never lands in the DB.
 */
export function safeSocialUrl(
  value: string | FormDataEntryValue | null | undefined,
  network: SocialNetwork,
): string | null {
  const url = sanitizeUrl(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    const allowed = SOCIAL_HOSTS[network]
    if (!allowed.has(parsed.hostname)) return null
    return url
  } catch {
    return null
  }
}

/**
 * Hosts allowed for images rendered via next/image. Must stay in sync with
 * next.config.ts `images.remotePatterns`, otherwise <Image> throws at render
 * time and breaks the page for that user. Derived from the Supabase URL (same
 * source next.config uses) with the prod host as fallback when the env var is
 * unset (e.g. some test contexts).
 */
const SUPABASE_IMAGE_HOST =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^https?:\/\//, '') ||
  'jytokoxbsykoyifzbjkd.supabase.co'
const ALLOWED_IMAGE_HOSTS = new Set<string>([SUPABASE_IMAGE_HOST])

/**
 * Validates an image URL is HTTPS and on an allowlisted host.
 * Returns the URL if safe, null otherwise (caller should fall back to placeholder).
 */
export function safeImageUrl(value: string | FormDataEntryValue | null | undefined): string | null {
  const url = sanitizeUrl(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return null
    return url
  } catch {
    return null
  }
}

/**
 * Avatars use the same allowlist as any other next/image source.
 * Kept as a named export for call-site clarity.
 */
export const safeAvatarUrl = safeImageUrl

/**
 * Masks an email for display on semi-public surfaces (e.g. /gracias, whose
 * session_id arrives via URL and could be replayed by a third party).
 * "ivan@gmail.com" -> "i***@g***.com". Returns null for invalid input.
 */
export function maskEmail(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const at = value.indexOf('@')
  if (at <= 0 || at === value.length - 1) return null
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  const lastDot = domain.lastIndexOf('.')
  const maskedLocal = `${local[0]}***`
  if (lastDot <= 0) return `${maskedLocal}@***`
  const maskedDomain = `${domain[0]}***${domain.slice(lastDot)}`
  return `${maskedLocal}@${maskedDomain}`
}
