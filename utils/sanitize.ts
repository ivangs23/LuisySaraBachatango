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
