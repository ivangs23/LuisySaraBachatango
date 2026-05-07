import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Module mocks ─────────────────────────────────────────────────────────────
// All vi.mock() calls must be at the top level before any imports.

vi.mock('server-only', () => ({}))

// Mux API mocks
const {
  muxUploadsCreate,
  muxUploadsCancel,
  muxAssetsDelete,
  muxAssetsCreateTrack,
  muxAssetsDeleteTrack,
} = vi.hoisted(() => ({
  muxUploadsCreate: vi.fn(),
  muxUploadsCancel: vi.fn(),
  muxAssetsDelete: vi.fn(),
  muxAssetsCreateTrack: vi.fn(),
  muxAssetsDeleteTrack: vi.fn(),
}))

vi.mock('@/utils/mux/server', () => ({
  mux: {
    video: {
      assets: {
        delete: muxAssetsDelete,
        createTrack: muxAssetsCreateTrack,
        deleteTrack: muxAssetsDeleteTrack,
      },
      uploads: {
        create: muxUploadsCreate,
        cancel: muxUploadsCancel,
      },
    },
  },
  signPlaybackToken: vi.fn(),
  signThumbnailToken: vi.fn(),
  signPlaybackTokenForUser: vi.fn(),
  signThumbnailTokenForUser: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

// Supabase client mock — controls both the requireAdmin check and lesson queries
const {
  mockGetUser,
  mockProfileSelect,
  mockLessonSelect,
  mockLessonUpdate,
  mockStorageUpload,
  mockStorageGetPublicUrl,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockLessonSelect: vi.fn(),
  mockLessonUpdate: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageGetPublicUrl: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: mockProfileSelect,
            }),
          }),
        }
      }
      if (table === 'lessons') {
        return {
          select: () => ({
            eq: () => ({
              single: mockLessonSelect,
            }),
          }),
          update: () => ({
            eq: mockLessonUpdate,
          }),
        }
      }
      return {}
    },
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  })),
}))

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Set up mocks so requireAdmin() returns an admin user. */
function setupAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
  mockProfileSelect.mockResolvedValue({ data: { role: 'admin' }, error: null })
}

/** Set up mocks so requireAdmin() returns Unauthorized (no user). */
function setupUnauthorized() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

/** Set up mocks so requireAdmin() returns Forbidden (non-admin user). */
function setupForbidden() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockProfileSelect.mockResolvedValue({ data: { role: 'member' }, error: null })
}

// ─── createMuxUpload ──────────────────────────────────────────────────────────

describe('createMuxUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error: "Unauthorized" } when not logged in', async () => {
    setupUnauthorized()
    const { createMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await createMuxUpload('lesson-1', 'https://localhost:3000')
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(muxUploadsCreate).not.toHaveBeenCalled()
  })

  it('returns { error: "Forbidden" } for non-admin user', async () => {
    setupForbidden()
    const { createMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await createMuxUpload('lesson-1', 'https://localhost:3000')
    expect(result).toEqual({ error: 'Forbidden' })
    expect(muxUploadsCreate).not.toHaveBeenCalled()
  })

  it('returns error when lesson is not found', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({ data: null, error: null })
    const { createMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await createMuxUpload('lesson-1', 'https://localhost:3000')
    expect(result).toEqual({ error: 'Lección no encontrada' })
    expect(muxUploadsCreate).not.toHaveBeenCalled()
  })

  it('creates an upload and returns uploadUrl + uploadId', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: null })
    muxUploadsCreate.mockResolvedValue({ id: 'up_1', url: 'https://mux.com/up_1' })

    const { createMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await createMuxUpload('lesson-1', 'https://localhost:3000')

    expect(muxUploadsCreate).toHaveBeenCalledOnce()
    expect(result).toEqual({ uploadUrl: 'https://mux.com/up_1', uploadId: 'up_1' })
  })

  it('deletes existing asset before creating new upload', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_asset_id: 'old_asset', course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: null })
    muxAssetsDelete.mockResolvedValue({})
    muxUploadsCreate.mockResolvedValue({ id: 'up_2', url: 'https://mux.com/up_2' })

    const { createMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await createMuxUpload('lesson-1', 'https://localhost:3000')

    expect(muxAssetsDelete).toHaveBeenCalledWith('old_asset')
    expect(muxUploadsCreate).toHaveBeenCalledOnce()
    expect(result).toEqual({ uploadUrl: 'https://mux.com/up_2', uploadId: 'up_2' })
  })

  it('returns db error if lesson update fails', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: { message: 'db write failed' } })
    muxUploadsCreate.mockResolvedValue({ id: 'up_3', url: 'https://mux.com/up_3' })

    const { createMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await createMuxUpload('lesson-1', 'https://localhost:3000')

    expect(result).toEqual({ error: 'db write failed' })
  })
})

// ─── cancelMuxUpload ──────────────────────────────────────────────────────────

describe('cancelMuxUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error: "Unauthorized" } when not logged in', async () => {
    setupUnauthorized()
    const { cancelMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await cancelMuxUpload('lesson-1')
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(muxUploadsCancel).not.toHaveBeenCalled()
    expect(muxAssetsDelete).not.toHaveBeenCalled()
  })

  it('returns { error: "Forbidden" } for non-admin user', async () => {
    setupForbidden()
    const { cancelMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await cancelMuxUpload('lesson-1')
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('cancels the upload ID when no asset exists yet', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_upload_id: 'up_1', mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: null })
    muxUploadsCancel.mockResolvedValue({})

    const { cancelMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await cancelMuxUpload('lesson-1')

    expect(muxUploadsCancel).toHaveBeenCalledWith('up_1')
    expect(result).toEqual({ success: true })
  })

  it('deletes the asset when mux_asset_id is present', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_upload_id: null, mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: null })
    muxAssetsDelete.mockResolvedValue({})

    const { cancelMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await cancelMuxUpload('lesson-1')

    expect(muxAssetsDelete).toHaveBeenCalledWith('asset_1')
    expect(muxUploadsCancel).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })

  it('returns error when lesson is not found', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({ data: null, error: null })
    const { cancelMuxUpload } = await import('@/app/courses/mux-actions')
    const result = await cancelMuxUpload('lesson-1')
    expect(result).toEqual({ error: 'Lección no encontrada' })
  })
})

// ─── deleteMuxAsset ───────────────────────────────────────────────────────────

describe('deleteMuxAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error: "Unauthorized" } when not logged in', async () => {
    setupUnauthorized()
    const { deleteMuxAsset } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxAsset('lesson-1')
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(muxAssetsDelete).not.toHaveBeenCalled()
  })

  it('returns { error: "Forbidden" } for non-admin user', async () => {
    setupForbidden()
    const { deleteMuxAsset } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxAsset('lesson-1')
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('returns error when lesson is not found', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({ data: null, error: null })
    const { deleteMuxAsset } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxAsset('lesson-1')
    expect(result).toEqual({ error: 'Lección no encontrada' })
  })

  it('deletes the Mux asset and clears lesson fields', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: null })
    muxAssetsDelete.mockResolvedValue({})

    const { deleteMuxAsset } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxAsset('lesson-1')

    expect(muxAssetsDelete).toHaveBeenCalledWith('asset_1')
    expect(result).toEqual({ success: true })
  })

  it('still clears lesson fields if asset has no mux_asset_id', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { id: 'lesson-1', mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })
    mockLessonUpdate.mockResolvedValue({ error: null })

    const { deleteMuxAsset } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxAsset('lesson-1')

    expect(muxAssetsDelete).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })
})

// ─── addMuxAudioTrack ─────────────────────────────────────────────────────────

describe('addMuxAudioTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for invalid language code', async () => {
    // validateLanguageCode runs before requireAdmin
    const { addMuxAudioTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxAudioTrack('lesson-1', 'x', 'Spanish', 'https://example.com/audio.mp3')
    expect(result).toEqual({ error: 'Idioma inválido.' })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('returns { error: "Unauthorized" } when not logged in', async () => {
    setupUnauthorized()
    const { addMuxAudioTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxAudioTrack('lesson-1', 'es', 'Spanish', 'https://example.com/audio.mp3')
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(muxAssetsCreateTrack).not.toHaveBeenCalled()
  })

  it('returns { error: "Forbidden" } for non-admin user', async () => {
    setupForbidden()
    const { addMuxAudioTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxAudioTrack('lesson-1', 'es', 'Spanish', 'https://example.com/audio.mp3')
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('returns error when lesson has no mux_asset_id', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })

    const { addMuxAudioTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxAudioTrack('lesson-1', 'es', 'Spanish', 'https://example.com/audio.mp3')
    expect(result).toEqual({ error: 'La lección no tiene un asset de Mux listo.' })
    expect(muxAssetsCreateTrack).not.toHaveBeenCalled()
  })

  it('creates an audio track and returns trackId + status', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    muxAssetsCreateTrack.mockResolvedValue({ id: 'track_1', status: 'preparing' })

    const { addMuxAudioTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxAudioTrack('lesson-1', 'es', 'Spanish', 'https://example.com/audio.mp3')

    expect(muxAssetsCreateTrack).toHaveBeenCalledWith(
      'asset_1',
      expect.objectContaining({ type: 'audio', language_code: 'es', name: 'Spanish' }),
    )
    expect(result).toEqual({ trackId: 'track_1', status: 'preparing' })
  })

  it('returns error message if mux createTrack throws', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    muxAssetsCreateTrack.mockRejectedValue(new Error('Mux API error'))

    const { addMuxAudioTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxAudioTrack('lesson-1', 'es', 'Spanish', 'https://example.com/audio.mp3')

    expect(result).toEqual({ error: 'No se pudo crear la pista de audio.' })
  })
})

// ─── addMuxTextTrack ──────────────────────────────────────────────────────────

describe('addMuxTextTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress fetch (used for VTT normalization) — default to failing fetch
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
  })

  it('returns error for invalid language code (runs before requireAdmin)', async () => {
    const { addMuxTextTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxTextTrack('lesson-1', 'x', 'Spanish', 'https://example.com/sub.vtt')
    expect(result).toEqual({ error: 'Idioma inválido.' })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('returns { error: "Unauthorized" } when not logged in', async () => {
    setupUnauthorized()
    const { addMuxTextTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxTextTrack('lesson-1', 'es', 'Spanish', 'https://example.com/sub.vtt')
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(muxAssetsCreateTrack).not.toHaveBeenCalled()
  })

  it('returns { error: "Forbidden" } for non-admin user', async () => {
    setupForbidden()
    const { addMuxTextTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxTextTrack('lesson-1', 'es', 'Spanish', 'https://example.com/sub.vtt')
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('returns error when lesson has no mux_asset_id', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })

    const { addMuxTextTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxTextTrack('lesson-1', 'es', 'Spanish', 'https://example.com/sub.vtt')
    expect(result).toEqual({ error: 'La lección no tiene un asset de Mux listo.' })
    expect(muxAssetsCreateTrack).not.toHaveBeenCalled()
  })

  it('creates a text track (skipping normalization on fetch failure) and returns trackId + status', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    muxAssetsCreateTrack.mockResolvedValue({ id: 'track_2', status: 'preparing' })

    const { addMuxTextTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxTextTrack('lesson-1', 'es', 'Spanish', 'https://example.com/sub.vtt')

    expect(muxAssetsCreateTrack).toHaveBeenCalledWith(
      'asset_1',
      expect.objectContaining({ type: 'text', language_code: 'es', name: 'Spanish' }),
    )
    expect(result).toEqual({ trackId: 'track_2', status: 'preparing' })
  })

  it('returns error message if mux createTrack throws', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    muxAssetsCreateTrack.mockRejectedValue(new Error('Mux API error'))

    const { addMuxTextTrack } = await import('@/app/courses/mux-actions')
    const result = await addMuxTextTrack('lesson-1', 'es', 'Spanish', 'https://example.com/sub.vtt')

    expect(result).toEqual({ error: 'No se pudo crear la pista de subtítulos.' })
  })
})

// ─── deleteMuxTrack ───────────────────────────────────────────────────────────

describe('deleteMuxTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { error: "Unauthorized" } when not logged in', async () => {
    setupUnauthorized()
    const { deleteMuxTrack } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxTrack('lesson-1', 'track_1')
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(muxAssetsDeleteTrack).not.toHaveBeenCalled()
  })

  it('returns { error: "Forbidden" } for non-admin user', async () => {
    setupForbidden()
    const { deleteMuxTrack } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxTrack('lesson-1', 'track_1')
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('returns error when lesson has no mux_asset_id', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: null, course_id: 'course-1' },
      error: null,
    })

    const { deleteMuxTrack } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxTrack('lesson-1', 'track_1')
    expect(result).toEqual({ error: 'La lección no tiene un asset de Mux.' })
    expect(muxAssetsDeleteTrack).not.toHaveBeenCalled()
  })

  it('deletes the track and returns success', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    muxAssetsDeleteTrack.mockResolvedValue({})

    const { deleteMuxTrack } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxTrack('lesson-1', 'track_1')

    expect(muxAssetsDeleteTrack).toHaveBeenCalledWith('asset_1', 'track_1')
    expect(result).toEqual({ success: true })
  })

  it('returns error message if mux deleteTrack throws', async () => {
    setupAdmin()
    mockLessonSelect.mockResolvedValue({
      data: { mux_asset_id: 'asset_1', course_id: 'course-1' },
      error: null,
    })
    muxAssetsDeleteTrack.mockRejectedValue(new Error('Mux API error'))

    const { deleteMuxTrack } = await import('@/app/courses/mux-actions')
    const result = await deleteMuxTrack('lesson-1', 'track_1')

    expect(result).toEqual({ error: 'No se pudo eliminar la pista.' })
  })
})
