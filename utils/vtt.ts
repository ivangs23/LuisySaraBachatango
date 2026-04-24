/**
 * Normalize WebVTT exported by DaVinci Resolve.
 *
 * DaVinci's default timeline start is 01:00:00:00 (broadcast convention),
 * so exported VTTs end up with every cue offset by +1 h (or whatever the
 * project start timecode is). This helper detects that pattern and shifts
 * every timestamp back so the first cue starts near 00:00:00.
 *
 * Also strips `<font>` tags which DaVinci inserts for cue colouring.
 * WebVTT does not allow arbitrary HTML; `<font>` is non-standard and is
 * ignored (or rendered as text) by spec-compliant players.
 *
 * Detection is conservative: if the first cue doesn't start at >= 01:00:00
 * the offset is 0 (no change). Lessons longer than 1 h with legitimately
 * high timestamps are unaffected because we use the first cue's hour as
 * the offset, not a fixed "subtract 1 h".
 */

const TIMING_LINE = /^(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})/

export function normalizeVtt(text: string): { normalized: string; changed: boolean } {
  // Find the first cue timing line to detect the offset.
  let offsetHours = 0
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(TIMING_LINE)
    if (m) {
      offsetHours = parseInt(m[1], 10)
      break
    }
  }

  let out = text

  // Only shift if the first cue starts at >= 01:00:00. This avoids
  // shrinking timestamps for genuinely long-form content (lessons
  // where the first cue is legitimately past the 1 h mark).
  const shouldShift = offsetHours >= 1
  if (shouldShift) {
    out = out.replace(/(\d{2}):(\d{2}):(\d{2}\.\d{3})/g, (match, h, mm, ss) => {
      const newH = parseInt(h, 10) - offsetHours
      if (newH < 0) return match // don't create negative timestamps
      return `${String(newH).padStart(2, '0')}:${mm}:${ss}`
    })
  }

  // Strip <font ...> and </font> tags (DaVinci colouring, invalid in VTT).
  const withoutFont = out.replace(/<font[^>]*>/gi, '').replace(/<\/font>/gi, '')

  const changed = withoutFont !== text
  return { normalized: withoutFont, changed }
}
