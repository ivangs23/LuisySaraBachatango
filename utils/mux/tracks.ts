import { mux } from '@/utils/mux/server'

export type MuxTrackSummary = {
  id: string
  type: 'audio' | 'text'
  languageCode: string | null
  name: string | null
  status: string | null
}

/**
 * Server-side helper (NOT a server action) to list tracks for an asset.
 * Called from the admin edit page server component. Lives in a plain module
 * (no 'use server') so it isn't serialized through the server-actions transport.
 */
export async function listMuxTracks(assetId: string): Promise<MuxTrackSummary[]> {
  try {
    const asset = await mux.video.assets.retrieve(assetId)
    const tracks = asset.tracks ?? []
    return tracks
      .filter(t => t.type === 'audio' || t.type === 'text')
      .map(t => ({
        id: t.id ?? '',
        type: t.type as 'audio' | 'text',
        languageCode: (t as { language_code?: string | null }).language_code ?? null,
        name: (t as { name?: string | null }).name ?? null,
        status: (t as { status?: string | null }).status ?? null,
      }))
  } catch (err) {
    console.error('listMuxTracks error:', err)
    return []
  }
}
