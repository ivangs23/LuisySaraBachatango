import { describe, it, expect } from 'vitest'
import { normalizeVtt } from '@/utils/vtt'

describe('normalizeVtt', () => {
  it('shifts DaVinci 01:xx:xx cues to 00:xx:xx', () => {
    const input = `WEBVTT\n\n1\n01:00:01.000 --> 01:00:01.960\nHola\n`
    const { normalized, changed } = normalizeVtt(input)
    expect(normalized).toContain('00:00:01.000 --> 00:00:01.960')
    expect(changed).toBe(true)
  })

  it('strips <font color="..."> and </font> tags', () => {
    const input = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\n<font color='#ffdeaa'>Hola</font>\n`
    const { normalized } = normalizeVtt(input)
    expect(normalized).not.toContain('<font')
    expect(normalized).not.toContain('</font>')
    expect(normalized).toContain('Hola')
  })

  it('leaves already-normalized VTT unchanged', () => {
    const input = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nHola\n`
    const { normalized, changed } = normalizeVtt(input)
    expect(normalized).toBe(input)
    expect(changed).toBe(false)
  })

  it('applies the same offset to every cue (not just the first)', () => {
    const input =
      `WEBVTT\n\n` +
      `1\n01:00:01.000 --> 01:00:02.000\nA\n\n` +
      `2\n01:00:03.000 --> 01:00:04.000\nB\n\n` +
      `3\n01:00:05.000 --> 01:00:06.000\nC\n`
    const { normalized } = normalizeVtt(input)
    expect(normalized).toContain('00:00:01.000 --> 00:00:02.000')
    expect(normalized).toContain('00:00:03.000 --> 00:00:04.000')
    expect(normalized).toContain('00:00:05.000 --> 00:00:06.000')
  })

  it('detects offset from first timing line regardless of cue label format', () => {
    // Cues may or may not have numeric IDs before the timing line.
    const input = `WEBVTT\n\n02:00:01.000 --> 02:00:02.000\nHola\n`
    const { normalized } = normalizeVtt(input)
    // First cue at 02:xx:xx → offset = 2 h
    expect(normalized).toContain('00:00:01.000 --> 00:00:02.000')
  })

  it('does not shift when first cue starts below 01:00:00', () => {
    const input = `WEBVTT\n\n1\n00:30:00.000 --> 00:30:02.000\nHola\n`
    const { normalized, changed } = normalizeVtt(input)
    expect(normalized).toContain('00:30:00.000 --> 00:30:02.000')
    expect(changed).toBe(false)
  })

  it('never creates negative timestamps', () => {
    // Pathological: first cue at 01:xx but a later cue is somehow at 00:xx.
    const input =
      `WEBVTT\n\n` +
      `1\n01:00:01.000 --> 01:00:02.000\nA\n\n` +
      `2\n00:00:01.000 --> 00:00:02.000\nB\n`
    const { normalized } = normalizeVtt(input)
    expect(normalized).toContain('00:00:01.000 --> 00:00:02.000') // first cue shifted
    expect(normalized).toContain('00:00:01.000 --> 00:00:02.000') // second kept as-is (no negative)
  })
})
