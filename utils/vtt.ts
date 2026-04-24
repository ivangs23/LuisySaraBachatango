/**
 * Normalize WebVTT exported by DaVinci Resolve.
 *
 * DaVinci's export has two distinct quirks:
 *
 * 1. When the project's start timecode is 01:00:00:00 (DaVinci default,
 *    broadcast convention), some cues end up with BOTH start and end at
 *    01:xx:xx. Others come out asymmetric: start at 00:xx:xx but end at
 *    01:xx:xx (the end time picks up the timeline offset while the start
 *    resets to zero for some reason). Asymmetric cues are catastrophic —
 *    their end time is one hour in the future, so the cue stays on screen
 *    for the entire video and subtitles pile up on top of each other.
 *
 * 2. DaVinci inserts `<font color='#xxxxxx'>` tags for cue colouring.
 *    These are not part of the WebVTT spec; colour is applied via
 *    `::cue` CSS rules. We strip them so the text is clean.
 *
 * Strategy (per cue):
 *   - If end_hour > start_hour, clamp end_hour down to start_hour
 *     (fixes asymmetric cues). The minutes/seconds stay as-is — the
 *     hour was the wrong part.
 *   - If start_hour >= 1 AND end_hour >= 1 after the clamp above, shift
 *     both down by start_hour so the cue lands at hour 0 (fixes uniform
 *     offset cues).
 *
 * Detection is per-cue (not based on the first cue alone) so we catch
 * mixed exports where some cues are asymmetric and others aren't.
 */

const CUE_TIMING =
  /^(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})(.*)$/

function normalizeCueTiming(line: string): string {
  const m = line.match(CUE_TIMING)
  if (!m) return line

  let sh = parseInt(m[1], 10)
  const sm = m[2]
  const ss = m[3]
  let eh = parseInt(m[4], 10)
  const em = m[5]
  const es = m[6]
  const rest = m[7] ?? ''

  // 1. Fix asymmetric cues: end hour must not be greater than start hour.
  //    If it is, clamp it (DaVinci puts the timeline offset on the end only).
  if (eh > sh) {
    eh = sh
  }

  // 2. Fix uniform offset: if both sides are >= 1, shift to hour 0.
  if (sh >= 1 && eh >= 1) {
    const offset = sh
    sh -= offset
    eh -= offset
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(sh)}:${sm}:${ss} --> ${pad(eh)}:${em}:${es}${rest}`
}

export function normalizeVtt(text: string): { normalized: string; changed: boolean } {
  const lines = text.split(/\r?\n/)
  const normalizedLines = lines.map(normalizeCueTiming)

  const withTimingsFixed = normalizedLines.join('\n')

  // Strip <font ...> and </font> tags (DaVinci colouring, invalid in VTT).
  const withoutFont = withTimingsFixed
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')

  const changed = withoutFont !== text
  return { normalized: withoutFont, changed }
}
