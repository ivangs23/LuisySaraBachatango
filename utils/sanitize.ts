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
