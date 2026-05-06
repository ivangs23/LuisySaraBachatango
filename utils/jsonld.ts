/**
 * JSON.stringify with `<` escaped as `<` so the result is safe to inline
 * inside an HTML <script type="application/ld+json"> block. Without this,
 * a string in the data containing `</script>` would close the tag.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
