/**
 * ¿Puede `next/image` optimizar esta URL?
 *
 * Importa porque `<Image>` LANZA en render si el `src` no casa con
 * `images.remotePatterns` de next.config.ts. En la landing eso no sería una
 * imagen rota: sería un 500 en la página que vende, provocable por un admin
 * que pegue en el formulario de curso una URL de cualquier otro dominio.
 *
 * Esta función es el espejo exacto del `remotePatterns` de Supabase que hay en
 * next.config.ts. Si allí se añade un host, aquí también — y al revés.
 *
 * No sustituye a `sanitizeUrl()`: aquella valida la forma, esta la pertenencia.
 * El hero llama a las dos.
 */
export function isOptimizableImageUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string' || !raw) return false

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Fail-closed: sin la variable no se puede saber qué host es legítimo, así
  // que no se optimiza nada y la landing sale sin portada en vez de caerse.
  if (!base) return false

  let host: string
  try {
    host = new URL(base).host
  } catch {
    return false
  }

  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      url.host === host &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}
