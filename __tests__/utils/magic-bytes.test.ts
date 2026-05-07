import { describe, it, expect } from 'vitest'
import { validateImageMagicBytes } from '@/utils/uploads/magic-bytes'

function mkFile(bytes: number[], type: string, name = 'f.jpg'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('validateImageMagicBytes', () => {
  it('accepts JPEG (FF D8 FF)', async () => {
    expect(await validateImageMagicBytes(mkFile([0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'))).toBe(true)
  })

  it('accepts PNG (89 50 4E 47)', async () => {
    expect(await validateImageMagicBytes(mkFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'))).toBe(true)
  })

  it('accepts WebP (RIFF + WEBP)', async () => {
    const bytes = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
    expect(await validateImageMagicBytes(mkFile(bytes, 'image/webp'))).toBe(true)
  })

  it('accepts GIF (GIF87a or GIF89a)', async () => {
    const gif89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
    const gif87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]
    expect(await validateImageMagicBytes(mkFile(gif89, 'image/gif'))).toBe(true)
    expect(await validateImageMagicBytes(mkFile(gif87, 'image/gif'))).toBe(true)
  })

  it('rejects PHP file disguised as JPEG', async () => {
    const php = [0x3c, 0x3f, 0x70, 0x68, 0x70]
    expect(await validateImageMagicBytes(mkFile(php, 'image/jpeg'))).toBe(false)
  })

  it('rejects unknown content-type', async () => {
    expect(await validateImageMagicBytes(mkFile([0xff, 0xd8, 0xff], 'application/octet-stream'))).toBe(false)
  })

  it('rejects file too small to fingerprint', async () => {
    expect(await validateImageMagicBytes(mkFile([0xff], 'image/jpeg'))).toBe(false)
  })
})
