import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_LANGUAGES,
  validateLanguageCode,
  validateAudioFile,
  validateSubtitleFile,
  buildAudioTrackPayload,
  buildSubtitleTrackPayload,
} from '@/utils/mux/validation'

describe('validateLanguageCode', () => {
  it('accepts 2-letter lowercase ISO codes', () => {
    expect(validateLanguageCode('es')).toBeNull()
    expect(validateLanguageCode('en')).toBeNull()
    expect(validateLanguageCode('ja')).toBeNull()
  })
  it('rejects empty string', () => {
    expect(validateLanguageCode('')).toContain('Idioma')
  })
  it('rejects strings longer than 5 chars', () => {
    expect(validateLanguageCode('spanishhh')).toContain('Idioma')
  })
})

describe('validateAudioFile', () => {
  it('accepts audio/mpeg', () => {
    expect(validateAudioFile({ type: 'audio/mpeg', size: 1024 })).toBeNull()
  })
  it('accepts audio/mp4', () => {
    expect(validateAudioFile({ type: 'audio/mp4', size: 1024 })).toBeNull()
  })
  it('accepts video/mp4 (muxed mp4 carrying audio)', () => {
    expect(validateAudioFile({ type: 'video/mp4', size: 1024 })).toBeNull()
  })
  it('rejects non-audio types', () => {
    expect(validateAudioFile({ type: 'image/jpeg', size: 1024 })).toContain('audio')
  })
  it('rejects files > 500MB', () => {
    expect(validateAudioFile({ type: 'audio/mpeg', size: 500 * 1024 * 1024 + 1 })).toContain('grande')
  })
})

describe('validateSubtitleFile', () => {
  it('accepts text/vtt', () => {
    expect(validateSubtitleFile({ type: 'text/vtt', size: 1024 })).toBeNull()
  })
  it('accepts octet-stream with .vtt name', () => {
    expect(validateSubtitleFile({ type: 'application/octet-stream', size: 1024, name: 'es.vtt' })).toBeNull()
  })
  it('rejects .srt files', () => {
    expect(validateSubtitleFile({ type: 'application/x-subrip', size: 1024, name: 'es.srt' })).toContain('VTT')
  })
  it('rejects files > 1MB', () => {
    expect(validateSubtitleFile({ type: 'text/vtt', size: 1024 * 1024 + 1 })).toContain('grande')
  })
})

describe('buildAudioTrackPayload', () => {
  it('builds the Mux request body for an audio track', () => {
    const body = buildAudioTrackPayload('https://example.com/en.mp4', 'en', 'English')
    expect(body).toEqual({
      url: 'https://example.com/en.mp4',
      type: 'audio',
      language_code: 'en',
      name: 'English',
    })
  })
})

describe('buildSubtitleTrackPayload', () => {
  it('builds the Mux request body for a subtitle track', () => {
    const body = buildSubtitleTrackPayload('https://example.com/es.vtt', 'es', 'Español')
    expect(body).toEqual({
      url: 'https://example.com/es.vtt',
      type: 'text',
      text_type: 'subtitles',
      closed_captions: false,
      language_code: 'es',
      name: 'Español',
    })
  })
})

describe('SUPPORTED_LANGUAGES', () => {
  it('contains the 6 app locales', () => {
    expect(SUPPORTED_LANGUAGES.map(l => l.code).sort()).toEqual(['de','en','es','fr','it','ja'])
  })
})
