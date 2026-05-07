/**
 * Validates that the first bytes of a File match the magic bytes expected
 * for the declared MIME type. Defends against clients that lie about
 * Content-Type to upload disguised executables or scripts.
 *
 * Returns true if the bytes match the type, false otherwise (including
 * when the type is unsupported or the file is too small to fingerprint).
 */
const MAGIC_BYTES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/gif': b => b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
  'image/webp': b => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

export async function validateImageMagicBytes(file: File): Promise<boolean> {
  const matcher = MAGIC_BYTES[file.type]
  if (!matcher) return false
  const buf = await file.slice(0, 12).arrayBuffer()
  return matcher(new Uint8Array(buf))
}
