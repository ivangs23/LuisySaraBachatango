export type LanguageOption = { code: string; label: string };

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
];

export function validateLanguageCode(code: string): string | null {
  if (!code || code.length < 2 || code.length > 5) {
    return 'Idioma inválido.';
  }
  return null;
}

const AUDIO_MIME = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-m4a', 'video/mp4'];
const AUDIO_MAX = 500 * 1024 * 1024;

export function validateAudioFile(file: { type: string; size: number }): string | null {
  if (!AUDIO_MIME.includes(file.type)) return 'Tipo de archivo no permitido. Se esperaba audio (MP3, M4A, WAV) o MP4.';
  if (file.size > AUDIO_MAX) return 'El archivo es demasiado grande. Máximo 500 MB.';
  return null;
}

const SUBTITLE_MAX = 1024 * 1024;

export function validateSubtitleFile(file: { type: string; size: number; name?: string }): string | null {
  const isVtt = file.type === 'text/vtt' || (file.name ?? '').toLowerCase().endsWith('.vtt');
  if (!isVtt) return 'Solo se admiten subtítulos en formato VTT.';
  if (file.size > SUBTITLE_MAX) return 'El archivo es demasiado grande. Máximo 1 MB.';
  return null;
}

export function buildAudioTrackPayload(url: string, languageCode: string, name: string) {
  return {
    url,
    type: 'audio' as const,
    language_code: languageCode,
    name,
  };
}

export function buildSubtitleTrackPayload(url: string, languageCode: string, name: string) {
  return {
    url,
    type: 'text' as const,
    text_type: 'subtitles' as const,
    closed_captions: false,
    language_code: languageCode,
    name,
  };
}

export function buildDirectUploadParams(origin: string, lessonId: string) {
  return {
    cors_origin: origin,
    new_asset_settings: {
      playback_policy: ['signed'] as ['signed'],
      mp4_support: 'none' as const,
      passthrough: lessonId,
      max_resolution_tier: '1080p' as const,
    },
  };
}
