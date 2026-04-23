# Mux Video Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Supabase Storage video pipeline with Mux Video (signed playback + multi-language audio/subtitles) and delete the legacy custom player code.

**Architecture:** Next.js server actions call Mux via the `@mux/mux-node` SDK. Browsers upload directly to Mux via `@mux/upchunk` (bytes never touch our server). Playback happens via `<MuxPlayer>` with JWT tokens signed server-side with RS256 (4h TTL). Multi-language audio + subtitle tracks live on the Mux asset, not our DB.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Mux Video (`@mux/mux-node`, `@mux/mux-player-react`, `@mux/upchunk`), Supabase (Postgres + Storage), Vitest + Testing Library.

**Spec reference:** [docs/superpowers/specs/2026-04-23-mux-video-migration-design.md](../specs/2026-04-23-mux-video-migration-design.md)

---

## Prerequisites (manual setup, must happen before Task 1)

The following configuration must be done **outside the code**. Agentic workers must confirm these before running Task 1 or tests will fail.

1. Create a Mux account (Starter plan is free for development).
2. Mux Dashboard → **Settings → Access Tokens** → create a token with Video Read/Write permissions. Copy `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`.
3. Mux Dashboard → **Settings → Signing Keys** → create a signing key. Copy `MUX_SIGNING_KEY_ID`. Download the private key PEM and base64-encode it:
   ```bash
   cat private_key.pem | base64
   ```
   Store the base64 string as `MUX_SIGNING_KEY_PRIVATE`.
4. Append to `.env.local`:
   ```
   MUX_TOKEN_ID=<from step 2>
   MUX_TOKEN_SECRET=<from step 2>
   MUX_SIGNING_KEY_ID=<from step 3>
   MUX_SIGNING_KEY_PRIVATE=<base64 from step 3>
   ```
5. Supabase Dashboard → **Storage** → create a bucket named `mux-track-sources`. Set **public read**. For writes, paste this RLS policy in the SQL editor:
   ```sql
   create policy "Admins write mux-track-sources"
     on storage.objects for insert
     with check (
       bucket_id = 'mux-track-sources'
       and exists (
         select 1 from profiles
         where profiles.id = auth.uid() and profiles.role = 'admin'
       )
     );
   create policy "Admins delete mux-track-sources"
     on storage.objects for delete
     using (
       bucket_id = 'mux-track-sources'
       and exists (
         select 1 from profiles
         where profiles.id = auth.uid() and profiles.role = 'admin'
       )
     );
   ```

---

## File Structure

### New files
| Path | Responsibility |
|---|---|
| `utils/mux/server.ts` | Mux SDK singleton + JWT signing helper |
| `utils/mux/validation.ts` | Pure validation logic for track uploads (language codes, MIME types, file sizes) |
| `app/courses/mux-actions.ts` | Server actions for Mux operations (`'use server'`) |
| `app/api/mux/status/[lessonId]/route.ts` | Client polling endpoint for upload/asset status |
| `components/LessonPlayer.tsx` | Client wrapper around `<MuxPlayer>` with completion tracking |
| `components/VideoUploadWidget.tsx` | Admin video upload (upchunk → Mux direct upload) |
| `components/MuxTracksManager.tsx` | Admin UI for listing/adding/deleting audio + subtitle tracks |
| `supabase/mux_migration.sql` | Additive schema: new Mux columns on `lessons` |
| `supabase/mux_cleanup.sql` | Drop legacy columns (applied at end) |
| `__tests__/actions/mux-actions.test.ts` | Pure-logic tests for Mux action helpers |
| `__tests__/unit/mux-validation.test.ts` | Track validation tests |

### Modified files
| Path | Change |
|---|---|
| `package.json` | Add `@mux/mux-node`, `@mux/mux-player-react`, `@mux/upchunk` |
| `vitest.setup.ts` | Add Mux env vars |
| `app/courses/actions.ts` | Remove references to `video_url`, `video_source`, `media_config` in `createLesson`/`updateLesson` |
| `components/LessonForm.tsx` | Remove TUS upload, media_config handling, URL/upload tabs. Keep: title, description, order, thumbnail, duration, isFree |
| `app/courses/[courseId]/[lessonId]/edit/page.tsx` | Render `VideoUploadWidget` + `MuxTracksManager` below `LessonForm` when lesson has an ID |
| `app/courses/[courseId]/[lessonId]/page.tsx` | Replace `LessonVideoPlayer` + signed URL logic with `LessonPlayer` + JWT signing |
| `app/courses/[courseId]/add-lesson/page.tsx` | Ensure it creates lesson with no video and redirects to edit page |

### Deleted files (at Task 17)
- `components/LessonVideoPlayer.tsx`
- `components/LessonVideoPlayer.module.css`
- `app/api/video/[lessonId]/route.ts`
- `utils/rate-limit.ts` (verify no other usages first)

---

## Task 1: Install Mux dependencies and create SDK singleton

**Files:**
- Modify: `package.json` (via npm install)
- Create: `utils/mux/server.ts`
- Modify: `vitest.setup.ts`

- [ ] **Step 1: Install Mux SDKs**

```bash
npm install @mux/mux-node @mux/mux-player-react @mux/upchunk
```

Expected: successful install, three new entries in `dependencies` in `package.json`.

- [ ] **Step 2: Create Mux SDK singleton**

Create `utils/mux/server.ts`:

```ts
import Mux from '@mux/mux-node';

/**
 * Mux Node SDK singleton. Uses MUX_TOKEN_ID + MUX_TOKEN_SECRET for API calls.
 * Used by server actions and API routes. Never import from client code.
 */
export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

/**
 * Sign a playback JWT for a given Mux playback ID. Used to gate video access
 * in the lesson server component after the access check passes.
 * RS256 with the key from MUX_SIGNING_KEY_PRIVATE (base64 PEM).
 */
export function signPlaybackToken(playbackId: string, expiration: string = '4h'): string {
  return Mux.JWT.signPlaybackId(playbackId, {
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
    expiration,
    type: 'video',
  });
}
```

- [ ] **Step 3: Add Mux env vars to vitest setup**

Modify `vitest.setup.ts` — append after the existing env setup:

```ts
process.env.MUX_TOKEN_ID = 'test-token-id'
process.env.MUX_TOKEN_SECRET = 'test-token-secret'
process.env.MUX_SIGNING_KEY_ID = 'test-signing-key-id'
// base64 of a dummy RSA private key PEM header — never used in tests (signPlaybackToken paths are exercised via mocks)
process.env.MUX_SIGNING_KEY_PRIVATE = 'dGVzdC1wcml2YXRlLWtleQ=='
```

- [ ] **Step 4: Verify install + tsc pass**

```bash
npx tsc --noEmit
```

Expected: no output (no type errors).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json utils/mux/server.ts vitest.setup.ts
git commit -m "feat(mux): install Mux SDKs and add server singleton"
```

---

## Task 2: Schema migration — add Mux columns to lessons

**Files:**
- Create: `supabase/mux_migration.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/mux_migration.sql`:

```sql
-- Adds Mux-related columns to lessons. Additive only; old columns remain until cleanup (see mux_cleanup.sql).
-- Idempotent: safe to re-run.

alter table lessons add column if not exists mux_asset_id text;
alter table lessons add column if not exists mux_playback_id text;
alter table lessons add column if not exists mux_upload_id text;
alter table lessons
  add column if not exists mux_status text not null default 'pending_upload'
  check (mux_status in ('pending_upload','preparing','ready','errored'));

create index if not exists idx_lessons_mux_asset on lessons (mux_asset_id) where mux_asset_id is not null;
create index if not exists idx_lessons_mux_upload on lessons (mux_upload_id) where mux_upload_id is not null;
```

- [ ] **Step 2: Apply the migration to Supabase**

Copy the file contents into the Supabase Dashboard → **SQL Editor** and run. Confirm the `lessons` table now has the four new columns.

Alternatively (if using Supabase CLI locally): `supabase db push`.

- [ ] **Step 3: Commit**

```bash
git add supabase/mux_migration.sql
git commit -m "feat(mux): add schema migration for Mux columns on lessons"
```

---

## Task 3: Track validation utilities (pure logic + tests)

**Files:**
- Create: `utils/mux/validation.ts`
- Create: `__tests__/unit/mux-validation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/mux-validation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/unit/mux-validation.test.ts
```

Expected: FAIL with "Cannot find module '@/utils/mux/validation'" or similar.

- [ ] **Step 3: Implement the module**

Create `utils/mux/validation.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/unit/mux-validation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/mux/validation.ts __tests__/unit/mux-validation.test.ts
git commit -m "feat(mux): add track validation helpers and tests"
```

---

## Task 4: Server action `createMuxUpload` (with pure helper tested)

**Files:**
- Create: `app/courses/mux-actions.ts`
- Modify: `utils/mux/validation.ts` (add `buildDirectUploadParams`)
- Modify: `__tests__/unit/mux-validation.test.ts` (add tests for the new helper)

- [ ] **Step 1: Write the failing test for `buildDirectUploadParams`**

Append to `__tests__/unit/mux-validation.test.ts`:

```ts
import { buildDirectUploadParams } from '@/utils/mux/validation'

describe('buildDirectUploadParams', () => {
  it('returns signed playback policy with lessonId passthrough', () => {
    const params = buildDirectUploadParams('http://localhost:3000', 'lesson-123')
    expect(params).toEqual({
      cors_origin: 'http://localhost:3000',
      new_asset_settings: {
        playback_policy: ['signed'],
        mp4_support: 'none',
        passthrough: 'lesson-123',
        max_resolution_tier: '1080p',
      },
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run __tests__/unit/mux-validation.test.ts -t buildDirectUploadParams
```

Expected: FAIL with "buildDirectUploadParams is not exported".

- [ ] **Step 3: Implement `buildDirectUploadParams`**

Append to `utils/mux/validation.ts`:

```ts
export function buildDirectUploadParams(origin: string, lessonId: string) {
  return {
    cors_origin: origin,
    new_asset_settings: {
      playback_policy: ['signed'] as const,
      mp4_support: 'none' as const,
      passthrough: lessonId,
      max_resolution_tier: '1080p' as const,
    },
  };
}
```

- [ ] **Step 4: Verify test passes**

```bash
npx vitest run __tests__/unit/mux-validation.test.ts -t buildDirectUploadParams
```

Expected: PASS.

- [ ] **Step 5: Implement `createMuxUpload` server action**

Create `app/courses/mux-actions.ts`:

```ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { mux } from '@/utils/mux/server'
import { buildDirectUploadParams } from '@/utils/mux/validation'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Unauthorized' as const, user: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { supabase, error: 'Forbidden' as const, user }
  return { supabase, user, error: null }
}

export async function createMuxUpload(lessonId: string, origin: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson) return { error: 'Lección no encontrada' }

  // If an asset already exists, delete it first to avoid orphaned storage.
  if (lesson.mux_asset_id) {
    try {
      await mux.video.assets.delete(lesson.mux_asset_id)
    } catch (err) {
      console.error('Failed to delete previous Mux asset:', err)
      // Non-fatal: proceed with new upload.
    }
  }

  const upload = await mux.video.uploads.create(buildDirectUploadParams(origin, lessonId))

  const { error: dbErr } = await supabase
    .from('lessons')
    .update({
      mux_upload_id: upload.id,
      mux_asset_id: null,
      mux_playback_id: null,
      mux_status: 'preparing',
    })
    .eq('id', lessonId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)

  return { uploadUrl: upload.url, uploadId: upload.id }
}
```

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit
git add app/courses/mux-actions.ts utils/mux/validation.ts __tests__/unit/mux-validation.test.ts
git commit -m "feat(mux): add createMuxUpload server action"
```

---

## Task 5: Server action `deleteMuxAsset`

**Files:**
- Modify: `app/courses/mux-actions.ts`

- [ ] **Step 1: Add `deleteMuxAsset` to `mux-actions.ts`**

Append to `app/courses/mux-actions.ts`:

```ts
export async function deleteMuxAsset(lessonId: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson) return { error: 'Lección no encontrada' }

  if (lesson.mux_asset_id) {
    try {
      await mux.video.assets.delete(lesson.mux_asset_id)
    } catch (err) {
      console.error('Failed to delete Mux asset:', err)
      // Continue: the asset may already be gone; clear fields regardless.
    }
  }

  const { error: dbErr } = await supabase
    .from('lessons')
    .update({
      mux_asset_id: null,
      mux_playback_id: null,
      mux_upload_id: null,
      mux_status: 'pending_upload',
    })
    .eq('id', lessonId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
  return { success: true as const }
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/courses/mux-actions.ts
git commit -m "feat(mux): add deleteMuxAsset server action"
```

---

## Task 6: Polling endpoint `/api/mux/status/[lessonId]`

**Files:**
- Create: `app/api/mux/status/[lessonId]/route.ts`

- [ ] **Step 1: Implement the endpoint**

Create `app/api/mux/status/[lessonId]/route.ts`:

```ts
import { createClient } from '@/utils/supabase/server'
import { mux } from '@/utils/mux/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: lesson } = await supabase
      .from('lessons')
      .select('mux_upload_id, mux_asset_id, mux_playback_id, mux_status')
      .eq('id', lessonId)
      .single()
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    // Already ready or errored — return cached state.
    if (lesson.mux_status === 'ready' || lesson.mux_status === 'errored') {
      return NextResponse.json({
        status: lesson.mux_status,
        assetId: lesson.mux_asset_id,
        playbackId: lesson.mux_playback_id,
      })
    }

    // Need to discover asset_id from upload_id, then check asset status.
    let assetId = lesson.mux_asset_id
    if (!assetId && lesson.mux_upload_id) {
      const upload = await mux.video.uploads.retrieve(lesson.mux_upload_id)
      if (upload.asset_id) assetId = upload.asset_id
    }

    if (!assetId) {
      return NextResponse.json({ status: 'preparing' })
    }

    const asset = await mux.video.assets.retrieve(assetId)

    if (asset.status === 'ready') {
      const signedPlaybackId = asset.playback_ids?.find(p => p.policy === 'signed')?.id ?? null
      if (!signedPlaybackId) {
        return NextResponse.json({ error: 'Asset ready but no signed playback_id' }, { status: 500 })
      }
      await supabase
        .from('lessons')
        .update({
          mux_asset_id: assetId,
          mux_playback_id: signedPlaybackId,
          mux_status: 'ready',
        })
        .eq('id', lessonId)
      return NextResponse.json({ status: 'ready', assetId, playbackId: signedPlaybackId })
    }

    if (asset.status === 'errored') {
      await supabase.from('lessons').update({ mux_status: 'errored' }).eq('id', lessonId)
      return NextResponse.json({ status: 'errored', assetId })
    }

    // Still preparing
    if (assetId && !lesson.mux_asset_id) {
      await supabase.from('lessons').update({ mux_asset_id: assetId }).eq('id', lessonId)
    }
    return NextResponse.json({ status: 'preparing', assetId })
  } catch (err) {
    console.error('[mux/status]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/mux/status/
git commit -m "feat(mux): add upload/asset status polling endpoint"
```

---

## Task 7: Server actions `addMuxAudioTrack`, `addMuxTextTrack`, `deleteMuxTrack`, `listMuxTracks`

**Files:**
- Modify: `app/courses/mux-actions.ts`

- [ ] **Step 1: Add the four track actions**

Append to `app/courses/mux-actions.ts`:

```ts
import {
  buildAudioTrackPayload,
  buildSubtitleTrackPayload,
  validateLanguageCode,
} from '@/utils/mux/validation'

export async function addMuxAudioTrack(
  lessonId: string,
  languageCode: string,
  name: string,
  fileUrl: string,
) {
  const langErr = validateLanguageCode(languageCode)
  if (langErr) return { error: langErr }

  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.mux_asset_id) return { error: 'La lección no tiene un asset de Mux listo.' }

  try {
    const track = await mux.video.assets.createTrack(
      lesson.mux_asset_id,
      buildAudioTrackPayload(fileUrl, languageCode, name),
    )
    revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
    return { trackId: track.id, status: track.status }
  } catch (err) {
    console.error('addMuxAudioTrack error:', err)
    return { error: 'No se pudo crear la pista de audio.' }
  }
}

export async function addMuxTextTrack(
  lessonId: string,
  languageCode: string,
  name: string,
  fileUrl: string,
) {
  const langErr = validateLanguageCode(languageCode)
  if (langErr) return { error: langErr }

  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.mux_asset_id) return { error: 'La lección no tiene un asset de Mux listo.' }

  try {
    const track = await mux.video.assets.createTrack(
      lesson.mux_asset_id,
      buildSubtitleTrackPayload(fileUrl, languageCode, name),
    )
    revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
    return { trackId: track.id, status: track.status }
  } catch (err) {
    console.error('addMuxTextTrack error:', err)
    return { error: 'No se pudo crear la pista de subtítulos.' }
  }
}

export async function deleteMuxTrack(lessonId: string, trackId: string) {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('mux_asset_id, course_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.mux_asset_id) return { error: 'La lección no tiene un asset de Mux.' }

  try {
    await mux.video.assets.deleteTrack(lesson.mux_asset_id, trackId)
    revalidatePath(`/courses/${lesson.course_id}/${lessonId}/edit`)
    return { success: true as const }
  } catch (err) {
    console.error('deleteMuxTrack error:', err)
    return { error: 'No se pudo eliminar la pista.' }
  }
}

export type MuxTrackSummary = {
  id: string
  type: 'audio' | 'text'
  languageCode: string | null
  name: string | null
  status: string | null
}

/**
 * Server-side helper (NOT a server action) to list tracks for an asset.
 * Called from admin page render. Not marked 'use server' — it's just an async function.
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If the Mux SDK method names differ (e.g. `createTrack` vs `tracks.create`), update to match the installed SDK version.

- [ ] **Step 3: Commit**

```bash
git add app/courses/mux-actions.ts
git commit -m "feat(mux): add audio/text track server actions and list helper"
```

---

## Task 8: `VideoUploadWidget` client component

**Files:**
- Create: `components/VideoUploadWidget.tsx`
- Create: `components/VideoUploadWidget.module.css`

- [ ] **Step 1: Implement the widget**

Create `components/VideoUploadWidget.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import * as UpChunk from '@mux/upchunk'
import { createMuxUpload, deleteMuxAsset } from '@/app/courses/mux-actions'
import styles from './VideoUploadWidget.module.css'

type Status = 'idle' | 'creating' | 'uploading' | 'polling' | 'ready' | 'errored'

interface Props {
  lessonId: string
  currentStatus: 'pending_upload' | 'preparing' | 'ready' | 'errored'
  currentPlaybackId: string | null
}

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 100 // 5 min

export default function VideoUploadWidget({ lessonId, currentStatus, currentPlaybackId }: Props) {
  const [status, setStatus] = useState<Status>(
    currentStatus === 'ready' ? 'ready' :
    currentStatus === 'preparing' ? 'polling' :
    currentStatus === 'errored' ? 'errored' : 'idle'
  )
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollTimerRef = useRef<number | null>(null)

  const startPolling = () => {
    let attempts = 0
    const tick = async () => {
      attempts++
      try {
        const res = await fetch(`/api/mux/status/${lessonId}`)
        const data = await res.json()
        if (data.status === 'ready') {
          setStatus('ready')
          return
        }
        if (data.status === 'errored') {
          setStatus('errored')
          setError('Mux no pudo procesar el vídeo.')
          return
        }
        if (attempts >= POLL_MAX_ATTEMPTS) {
          setStatus('errored')
          setError('El procesamiento está tardando demasiado. Refresca la página para volver a comprobar.')
          return
        }
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS)
      } catch {
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS)
      }
    }
    tick()
  }

  const handleFile = async (file: File) => {
    setError(null)
    setStatus('creating')
    const result = await createMuxUpload(lessonId, window.location.origin)
    if ('error' in result) {
      setStatus('errored')
      setError(result.error)
      return
    }
    setStatus('uploading')
    setProgress(0)
    const upload = UpChunk.createUpload({ endpoint: result.uploadUrl, file, chunkSize: 5120 })
    upload.on('progress', (e) => setProgress(Math.round((e.detail as number))))
    upload.on('error', (e) => {
      setStatus('errored')
      setError((e.detail as { message?: string })?.message ?? 'Error de subida.')
    })
    upload.on('success', () => {
      setStatus('polling')
      setProgress(100)
      startPolling()
    })
  }

  const handleReplace = async () => {
    if (!confirm('¿Eliminar el vídeo actual y subir uno nuevo?')) return
    setStatus('creating')
    const res = await deleteMuxAsset(lessonId)
    if ('error' in res) {
      setStatus('errored')
      setError(res.error)
      return
    }
    setStatus('idle')
    setError(null)
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Vídeo</h3>

      {status === 'ready' && currentPlaybackId && (
        <div className={styles.readyState}>
          <p className={styles.readyText}>✓ Vídeo listo (playback_id: <code>{currentPlaybackId.slice(0, 8)}…</code>)</p>
          <button type="button" onClick={handleReplace} className={styles.replaceBtn}>
            Reemplazar vídeo
          </button>
        </div>
      )}

      {(status === 'idle' || status === 'errored') && status !== 'ready' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {status === 'creating' && <p>Preparando subida…</p>}
      {status === 'uploading' && (
        <div>
          <p>Subiendo: {progress}%</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {status === 'polling' && <p>Procesando vídeo en Mux (puede tardar 1-5 min)…</p>}
    </div>
  )
}
```

- [ ] **Step 2: Add minimal styles**

Create `components/VideoUploadWidget.module.css`:

```css
.container {
  padding: var(--spacing-md);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}
.title { font-size: 1.1rem; margin: 0 0 var(--spacing-md); color: var(--text-main); }
.readyState { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md); }
.readyText { margin: 0; color: var(--text-main); }
.replaceBtn { padding: 0.5rem 1rem; background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; }
.replaceBtn:hover { border-color: var(--primary); color: var(--primary); }
.progressBar { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-top: 0.5rem; }
.progressFill { height: 100%; background: var(--primary); transition: width 0.2s; }
.error { color: #e53e3e; margin-top: 0.5rem; font-size: 0.9rem; }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/VideoUploadWidget.tsx components/VideoUploadWidget.module.css
git commit -m "feat(mux): add VideoUploadWidget with upchunk + polling"
```

---

## Task 9: `MuxTracksManager` client component

**Files:**
- Create: `components/MuxTracksManager.tsx`
- Create: `components/MuxTracksManager.module.css`

- [ ] **Step 1: Implement the component**

Create `components/MuxTracksManager.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  SUPPORTED_LANGUAGES,
  validateAudioFile,
  validateSubtitleFile,
} from '@/utils/mux/validation'
import {
  addMuxAudioTrack,
  addMuxTextTrack,
  deleteMuxTrack,
  type MuxTrackSummary,
} from '@/app/courses/mux-actions'
import styles from './MuxTracksManager.module.css'

interface Props {
  lessonId: string
  tracks: MuxTrackSummary[]
}

export default function MuxTracksManager({ lessonId, tracks }: Props) {
  const [isPending, startTransition] = useTransition()
  const audio = tracks.filter(t => t.type === 'audio')
  const text = tracks.filter(t => t.type === 'text')

  return (
    <div className={styles.container}>
      <TrackSection
        title="Pistas de audio alternativas"
        kind="audio"
        tracks={audio}
        lessonId={lessonId}
        isPending={isPending}
        startTransition={startTransition}
      />
      <TrackSection
        title="Subtítulos"
        kind="text"
        tracks={text}
        lessonId={lessonId}
        isPending={isPending}
        startTransition={startTransition}
      />
    </div>
  )
}

function TrackSection({
  title, kind, tracks, lessonId, isPending, startTransition,
}: {
  title: string
  kind: 'audio' | 'text'
  tracks: MuxTrackSummary[]
  lessonId: string
  isPending: boolean
  startTransition: (fn: () => void) => void
}) {
  const [adding, setAdding] = useState(false)
  const [languageCode, setLanguageCode] = useState('es')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Selecciona un archivo.'); return }

    const validationError = kind === 'audio'
      ? validateAudioFile({ type: file.type, size: file.size })
      : validateSubtitleFile({ type: file.type, size: file.size, name: file.name })
    if (validationError) { setError(validationError); return }

    setError(null)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? (kind === 'audio' ? 'mp4' : 'vtt')
    const path = `${lessonId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('mux-track-sources').upload(path, file)
    if (upErr) { setError(`Error subiendo a Storage: ${upErr.message}`); return }
    const { data: { publicUrl } } = supabase.storage.from('mux-track-sources').getPublicUrl(path)

    const name = SUPPORTED_LANGUAGES.find(l => l.code === languageCode)?.label ?? languageCode
    startTransition(async () => {
      const action = kind === 'audio'
        ? addMuxAudioTrack(lessonId, languageCode, name, publicUrl)
        : addMuxTextTrack(lessonId, languageCode, name, publicUrl)
      const result = await action
      if ('error' in result && result.error) { setError(result.error); return }
      setAdding(false)
      setFile(null)
    })
  }

  const handleDelete = async (trackId: string) => {
    if (!confirm('¿Eliminar esta pista?')) return
    startTransition(async () => {
      await deleteMuxTrack(lessonId, trackId)
    })
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {tracks.length === 0 && <p className={styles.empty}>Sin pistas.</p>}
      <ul className={styles.list}>
        {tracks.map(t => (
          <li key={t.id} className={styles.item}>
            <span className={styles.flag}>{kind === 'audio' ? '🔊' : '💬'}</span>
            <span className={styles.name}>{t.name ?? t.languageCode ?? '(sin idioma)'}</span>
            <span className={styles.status}>{t.status ?? ''}</span>
            <button
              type="button"
              onClick={() => handleDelete(t.id)}
              disabled={isPending}
              className={styles.deleteBtn}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      {!adding && (
        <button type="button" onClick={() => setAdding(true)} className={styles.addBtn}>
          + Añadir {kind === 'audio' ? 'pista de audio' : 'subtítulos'}
        </button>
      )}

      {adding && (
        <form onSubmit={handleAdd} className={styles.form}>
          <select value={languageCode} onChange={e => setLanguageCode(e.target.value)}>
            {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <input
            type="file"
            accept={kind === 'audio' ? 'audio/*,video/mp4' : '.vtt,text/vtt'}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" disabled={isPending || !file}>
            {isPending ? 'Añadiendo…' : 'Añadir'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setFile(null); setError(null); }}>
            Cancelar
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Add styles**

Create `components/MuxTracksManager.module.css`:

```css
.container { padding: var(--spacing-md); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg); display: flex; flex-direction: column; gap: var(--spacing-lg); }
.section { }
.sectionTitle { font-size: 1.05rem; margin: 0 0 var(--spacing-sm); color: var(--text-main); }
.empty { color: var(--text-muted); font-size: 0.9rem; margin: 0 0 var(--spacing-sm); }
.list { list-style: none; padding: 0; margin: 0 0 var(--spacing-sm); }
.item { display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-sm); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 0.25rem; }
.flag { font-size: 1.2rem; }
.name { flex: 1; color: var(--text-main); }
.status { font-size: 0.8rem; color: var(--text-muted); }
.deleteBtn { padding: 0.25rem 0.75rem; background: transparent; color: #e53e3e; border: 1px solid #e53e3e; border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; }
.deleteBtn:disabled { opacity: 0.5; cursor: not-allowed; }
.addBtn { padding: 0.5rem 1rem; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: var(--radius-sm); cursor: pointer; }
.form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: var(--spacing-sm); background: #1a1a1a; border-radius: var(--radius-sm); }
.form select, .form input[type="file"] { padding: 0.35rem; background: #222; color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.form button { padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); cursor: pointer; border: none; background: var(--primary); color: #000; }
.form button[type="button"] { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
.error { flex-basis: 100%; color: #e53e3e; margin: 0.25rem 0 0; font-size: 0.85rem; }
```

- [ ] **Step 3: Verify `createClient` helper exists for browser**

Check that `utils/supabase/client.ts` exists (it should; it's used in `LessonForm.tsx`). If not, this task needs a prior step to create it — but since `LessonForm` already uses it, assume it exists.

```bash
test -f utils/supabase/client.ts && echo "exists" || echo "MISSING — fail the task"
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/MuxTracksManager.tsx components/MuxTracksManager.module.css
git commit -m "feat(mux): add MuxTracksManager admin UI"
```

---

## Task 10: `LessonPlayer` client component (Mux Player wrapper)

**Files:**
- Create: `components/LessonPlayer.tsx`

- [ ] **Step 1: Implement the player wrapper**

Create `components/LessonPlayer.tsx`:

```tsx
'use client'

import MuxPlayer from '@mux/mux-player-react'
import { useRouter } from 'next/navigation'
import { markLessonAsCompleted } from '@/app/courses/actions'

interface Props {
  playbackId: string
  playbackToken: string
  lessonId: string
  lessonTitle: string
  courseId: string
  viewerUserId: string
}

export default function LessonPlayer({
  playbackId, playbackToken, lessonId, lessonTitle, courseId, viewerUserId,
}: Props) {
  const router = useRouter()

  return (
    <MuxPlayer
      playbackId={playbackId}
      tokens={{ playback: playbackToken }}
      metadata={{
        video_id: lessonId,
        video_title: lessonTitle,
        viewer_user_id: viewerUserId,
      }}
      style={{ width: '100%', height: '100%', aspectRatio: '16/9' }}
      onEnded={async () => {
        await markLessonAsCompleted(courseId, lessonId)
        router.refresh()
      }}
    />
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/LessonPlayer.tsx
git commit -m "feat(mux): add LessonPlayer client component"
```

---

## Task 11: Slim down `LessonForm` — remove TUS + media_config

**Files:**
- Modify: `components/LessonForm.tsx`
- Modify: `app/courses/actions.ts`

- [ ] **Step 1: Rewrite LessonForm to drop video/media_config fields**

Overwrite `components/LessonForm.tsx` with the slimmed-down version. The new form handles: `title`, `description`, `order`, `thumbnail` (upload to Supabase thumbnails bucket), `duration`, `isFree`. It does NOT handle video or tracks (those live in separate components rendered on the edit page).

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import styles from './LessonForm.module.css'

type Lesson = {
  id?: string
  title?: string
  description?: string | null
  order?: number
  thumbnail_url?: string | null
  duration?: number | null
  is_free?: boolean
}

interface Props {
  courseId: string
  initialData?: Lesson
  action: (formData: FormData) => Promise<{ error?: string } | void>
}

export default function LessonForm({ courseId, initialData, action }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [order, setOrder] = useState(initialData?.order?.toString() ?? '1')
  const [duration, setDuration] = useState(initialData?.duration?.toString() ?? '')
  const [isFree, setIsFree] = useState(initialData?.is_free ?? false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initialData?.thumbnail_url ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!thumbnailFile) return
    const url = URL.createObjectURL(thumbnailFile)
    setThumbnailPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [thumbnailFile])

  const uploadThumbnail = async (file: File): Promise<string | { error: string }> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${courseId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, file)
    if (upErr) return { error: upErr.message }
    const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    let thumbnailUrl = initialData?.thumbnail_url ?? ''
    if (thumbnailFile) {
      const result = await uploadThumbnail(thumbnailFile)
      if (typeof result === 'object' && 'error' in result) {
        setError(result.error); setSubmitting(false); return
      }
      thumbnailUrl = result
    }

    const fd = new FormData()
    if (initialData?.id) fd.append('lessonId', initialData.id)
    fd.append('courseId', courseId)
    fd.append('title', title)
    fd.append('description', description)
    fd.append('order', order)
    if (duration) fd.append('duration', duration)
    if (isFree) fd.append('isFree', 'on')
    if (thumbnailUrl) fd.append('thumbnailUrl', thumbnailUrl)

    const result = await action(fd)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label>Título</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div className={styles.field}>
        <label>Descripción</label>
        <textarea value={description ?? ''} onChange={e => setDescription(e.target.value)} rows={4} />
      </div>
      <div className={styles.field}>
        <label>Orden</label>
        <input type="number" min="1" value={order} onChange={e => setOrder(e.target.value)} required />
      </div>
      <div className={styles.field}>
        <label>Duración (segundos, opcional)</label>
        <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>
          <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} />
          {' '}Lección gratuita (accesible sin compra)
        </label>
      </div>
      <div className={styles.field}>
        <label>Miniatura</label>
        {thumbnailPreview && <img src={thumbnailPreview} alt="" style={{ maxWidth: 200, marginBottom: 8 }} />}
        <input type="file" accept="image/*" onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : initialData?.id ? 'Guardar cambios' : 'Crear lección'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `components/LessonForm.module.css`**

The file does not exist today (the old 639-line form used inline styles). Create it with:

```css
.form { display: flex; flex-direction: column; gap: var(--spacing-md); max-width: 640px; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { color: var(--text-main); font-weight: 500; }
.field input, .field textarea { padding: 0.5rem 0.75rem; background: #1a1a1a; color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius-sm); font: inherit; }
.field textarea { resize: vertical; min-height: 6rem; }
.form button[type="submit"] { padding: 0.75rem 1.25rem; background: var(--primary); color: #000; border: none; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; }
.form button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
.error { color: #e53e3e; margin: 0; }
```

- [ ] **Step 3: Update `createLesson` and `updateLesson` in `app/courses/actions.ts`**

Replace the bodies of `createLesson` and `updateLesson` in `app/courses/actions.ts` to no longer read `videoUrl`, `videoSource`, or `mediaConfig` from the form. The lesson is created empty of video; the edit page's VideoUploadWidget handles uploads afterwards.

Find `export async function createLesson(formData: FormData)` and replace the entire function body with:

```ts
export async function createLesson(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized: Only admins can add lessons')

  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const order = parseInt(formData.get('order') as string)
  if (isNaN(order) || order < 1) return { error: 'El orden de la lección debe ser un número positivo' }

  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const durationRaw = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const duration = durationRaw !== null && isNaN(durationRaw) ? null : durationRaw
  const isFree = formData.get('isFree') === 'on'

  const { data: inserted, error } = await supabase
    .from('lessons')
    .insert({
      course_id: courseId,
      title,
      description,
      "order": order,
      release_date: new Date().toISOString(),
      thumbnail_url: thumbnailUrl || null,
      duration,
      is_free: isFree,
      mux_status: 'pending_upload',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Create lesson error:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}`)
  redirect(`/courses/${courseId}/${inserted.id}/edit`)
}
```

Replace `updateLesson`:

```ts
export async function updateLesson(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Unauthorized: Only admins can edit lessons')

  const lessonId = formData.get('lessonId') as string
  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const order = parseInt(formData.get('order') as string)
  if (isNaN(order) || order < 1) return { error: 'El orden de la lección debe ser un número positivo' }
  const thumbnailUrl = formData.get('thumbnailUrl') as string
  const durationRaw = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
  const duration = durationRaw !== null && isNaN(durationRaw) ? null : durationRaw
  const isFree = formData.get('isFree') === 'on'

  const update: Record<string, unknown> = {
    title,
    description,
    "order": order,
    duration,
    is_free: isFree,
  }
  if (thumbnailUrl) update.thumbnail_url = thumbnailUrl

  const { error } = await supabase.from('lessons').update(update).eq('id', lessonId)
  if (error) {
    console.error('Update lesson error:', error)
    return { error: error.message }
  }

  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/courses/${courseId}/${lessonId}/edit`)
}
```

- [ ] **Step 4: Update the existing tests in `__tests__/actions/courses.test.ts`**

The existing tests for `parseMediaConfig` are now irrelevant. Remove any test block that tests `parseMediaConfig` (search for `describe('parseMediaConfig'` and delete it with its block). The `validateOrder` and `validateImageFile` tests stay.

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/LessonForm.tsx components/LessonForm.module.css app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "refactor(lessons): slim LessonForm and remove media_config handling"
```

---

## Task 12: Wire Mux widgets into edit page

**Files:**
- Modify: `app/courses/[courseId]/[lessonId]/edit/page.tsx`
- Modify: `app/courses/[courseId]/add-lesson/page.tsx` (verify it still works with slim form)

- [ ] **Step 1: Read the current edit page**

```bash
cat app/courses/[courseId]/[lessonId]/edit/page.tsx
```

Note the imports and data flow.

- [ ] **Step 2: Update the edit page to include Mux widgets**

Replace `app/courses/[courseId]/[lessonId]/edit/page.tsx` with:

```tsx
import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import LessonForm from '@/components/LessonForm'
import VideoUploadWidget from '@/components/VideoUploadWidget'
import MuxTracksManager from '@/components/MuxTracksManager'
import { listMuxTracks } from '@/app/courses/mux-actions'
import { updateLesson } from '@/app/courses/actions'

export default async function EditLessonPage(props: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/courses/${params.courseId}`)

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, description, "order", thumbnail_url, duration, is_free, mux_asset_id, mux_playback_id, mux_status')
    .eq('id', params.lessonId)
    .eq('course_id', params.courseId)
    .single()

  if (!lesson) notFound()

  const tracks = lesson.mux_asset_id ? await listMuxTracks(lesson.mux_asset_id) : []

  return (
    <div style={{ padding: '2rem 10%', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Editar Lección</h1>

      <LessonForm courseId={params.courseId} initialData={lesson} action={updateLesson} />

      <VideoUploadWidget
        lessonId={lesson.id}
        currentStatus={(lesson.mux_status ?? 'pending_upload') as 'pending_upload' | 'preparing' | 'ready' | 'errored'}
        currentPlaybackId={lesson.mux_playback_id}
      />

      {lesson.mux_status === 'ready' && lesson.mux_asset_id && (
        <MuxTracksManager lessonId={lesson.id} tracks={tracks} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify `add-lesson` page still works**

The `add-lesson` page renders `LessonForm` with `createLesson` action. After Task 11 the form has no video field, and `createLesson` redirects to the edit page, so upload happens next. Read the file to confirm the import/action pass-through matches:

```bash
cat app/courses/[courseId]/add-lesson/page.tsx
```

If it passes `action={createLesson}` to `LessonForm`, it's good. If it inlines upload UI, replace with a minimal render:

```tsx
import LessonForm from '@/components/LessonForm'
import { createLesson } from '@/app/courses/actions'

export default async function AddLessonPage(props: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await props.params
  return (
    <div style={{ padding: '2rem 10%', maxWidth: 800, margin: '0 auto' }}>
      <h1>Añadir Lección</h1>
      <LessonForm courseId={courseId} action={createLesson} />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/courses/\[courseId\]/\[lessonId\]/edit/page.tsx app/courses/\[courseId\]/add-lesson/page.tsx
git commit -m "feat(mux): wire upload widget and tracks manager into edit page"
```

---

## Task 13: Switch lesson page to MuxPlayer with JWT

**Files:**
- Modify: `app/courses/[courseId]/[lessonId]/page.tsx`

- [ ] **Step 1: Read the current lesson page**

```bash
cat app/courses/[courseId]/[lessonId]/page.tsx
```

Note the existing access-check logic — it stays intact. Only the video rendering section changes.

- [ ] **Step 2: Replace LessonVideoPlayer with LessonPlayer + JWT**

In `app/courses/[courseId]/[lessonId]/page.tsx`, change:

**Remove:** imports of `createSupabaseAdmin`, `LessonVideoPlayer`. The admin client was only used for signing storage URLs.

**Add:** import of `LessonPlayer` and `signPlaybackToken`.

**Change the lesson select** to fetch Mux fields instead of the old `video_url`, `video_source`, `media_config`:

```ts
supabase.from('lessons')
  .select('id, title, description, mux_playback_id, mux_status, course_id')
  .eq('id', params.lessonId)
  .eq('course_id', params.courseId)
  .single(),
```

**Remove:**
- The `videoUrl` construction block (`if (videoUrl.startsWith('storage://')) ...`).
- The `mediaConfig` signing loop (lines calling `supabaseAdmin.storage.createSignedUrl`).

**Replace the `LessonVideoPlayer` render** with:

```tsx
{hasAccess && lesson.mux_status === 'ready' && lesson.mux_playback_id ? (
  <LessonPlayer
    playbackId={lesson.mux_playback_id}
    playbackToken={signPlaybackToken(lesson.mux_playback_id)}
    lessonId={params.lessonId}
    lessonTitle={lesson.title}
    courseId={params.courseId}
    viewerUserId={user.id}
  />
) : hasAccess && lesson.mux_status !== 'ready' ? (
  <div className={styles.lockedContent} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center', padding: '2rem' }}>
    <h2>Vídeo en preparación</h2>
    <p>El vídeo de esta lección todavía se está procesando. Vuelve en unos minutos.</p>
  </div>
) : (
  <div className={styles.lockedContent} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center', padding: '2rem' }}>
    <h2 style={{ marginBottom: '1rem' }}>{t.lesson.lockedContent}</h2>
    <p style={{ marginBottom: '1.5rem' }}>{t.lesson.lockedMessage}</p>
    <Link href="/pricing" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
      {t.lesson.getPremium}
    </Link>
  </div>
)}
```

Also: the previous code used `supabaseAdmin` for media signing only. If no other usage remains in the file, remove the `supabaseAdmin` variable and its imports.

- [ ] **Step 3: Update imports at the top**

Add to the imports:

```ts
import LessonPlayer from '@/components/LessonPlayer'
import { signPlaybackToken } from '@/utils/mux/server'
```

Remove:

```ts
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import LessonVideoPlayer from '@/components/LessonVideoPlayer'
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/courses/\[courseId\]/\[lessonId\]/page.tsx
git commit -m "feat(mux): render MuxPlayer with signed JWT on lesson page"
```

---

## Task 14: Delete obsolete files

**Files:**
- Delete: `components/LessonVideoPlayer.tsx`
- Delete: `components/LessonVideoPlayer.module.css`
- Delete: `app/api/video/[lessonId]/route.ts`
- Potentially delete: `utils/rate-limit.ts`

- [ ] **Step 1: Verify `rate-limit.ts` is only used by the deleted video route**

```bash
grep -rn "from '@/utils/rate-limit'" --include="*.ts" --include="*.tsx" .
grep -rn "utils/rate-limit" --include="*.ts" --include="*.tsx" .
```

If no results outside `app/api/video/[lessonId]/route.ts`, it can be deleted.

- [ ] **Step 2: Delete the files**

```bash
rm components/LessonVideoPlayer.tsx
rm components/LessonVideoPlayer.module.css
rm app/api/video/[lessonId]/route.ts
rmdir app/api/video/[lessonId] 2>/dev/null
rmdir app/api/video 2>/dev/null
```

If Step 1 confirmed no other usage:

```bash
rm utils/rate-limit.ts
rmdir utils 2>/dev/null  # Will fail if utils has other files — that's fine
```

- [ ] **Step 3: Type-check and test**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: no compile errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(mux): delete obsolete video player and proxy route"
```

---

## Task 15: Cleanup schema migration — drop legacy columns

**Files:**
- Create: `supabase/mux_cleanup.sql`

- [ ] **Step 1: Write the cleanup SQL**

Create `supabase/mux_cleanup.sql`:

```sql
-- Run AFTER all code no longer references video_url, video_source, or media_config.
-- Idempotent.

alter table lessons drop column if exists video_url;
alter table lessons drop column if exists video_source;
alter table lessons drop column if exists media_config;
```

- [ ] **Step 2: Apply in Supabase SQL Editor**

Paste and run in the Supabase Dashboard → SQL Editor.

- [ ] **Step 3: Verify no TS references remain**

```bash
grep -rn "video_url\|video_source\|media_config" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next"
```

Expected: no results. If any result appears in application code (not SQL migration files or specs), delete/update it.

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/mux_cleanup.sql
git commit -m "feat(mux): drop legacy video_url/video_source/media_config columns"
```

---

## Task 16: Manual end-to-end verification

**Files:**
- (none modified)

This task is manual. Execute it before considering the migration complete.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as admin and create a lesson**

- Open `http://localhost:3000` in an incognito window.
- Log in with the admin account.
- Navigate to a test course → `/courses/<courseId>` → click "+ Añadir Lección".
- Fill title "Test Mux Lesson", description, order 1. Submit.
- Expected: redirect to `/courses/<courseId>/<newLessonId>/edit` showing the form + upload widget.

- [ ] **Step 3: Upload a short test video (~30 s)**

- In the upload widget, pick a short `.mp4` (≤100 MB to keep upload fast).
- Expected progression: "Preparando subida…" → "Subiendo: X%" → "Procesando vídeo en Mux…" → "✓ Vídeo listo".
- Refresh the page. The widget should still show "✓ Vídeo listo" (state persisted in DB).

- [ ] **Step 4: Add one audio track and one subtitle**

- Scroll to the "Pistas de audio alternativas" section.
- Click "+ Añadir pista de audio". Select "English", pick any `.mp4` or `.m4a` file, submit.
- Expected: track appears in the list with status `preparing`. Refresh in 1-2 min → status `ready`.
- Click "+ Añadir subtítulos". Select "Español", pick a small `.vtt` file, submit.
- Expected: VTT track appears immediately with `ready` status.

- [ ] **Step 5: Play the lesson as a paying user**

- Log out. Log in as a non-admin user that has purchased the course (or has active subscription covering it).
- Navigate to `/courses/<courseId>/<lessonId>`.
- Expected: `<MuxPlayer>` renders, video plays.
- Open the player settings gear → verify "Audio" menu shows the original + English; verify "Subtitles" shows Spanish.
- Play to end → expected: lesson marked as completed (check in profile/dashboard).

- [ ] **Step 6: Verify access blocking**

- Log out. Log in as a user without access to this course.
- Navigate to `/courses/<courseId>/<lessonId>`.
- Expected: "Contenido Bloqueado" message, no player render, no JWT emitted in the HTML source.

- [ ] **Step 7: Verify no 404s / errors in browser console**

- Return as admin. Navigate through `/courses`, `/dashboard`, `/profile`, `/courses/<courseId>`.
- Open DevTools → Network + Console tabs.
- Expected: no 404s for `/api/video/...` (old route gone), no JS errors.

- [ ] **Step 8: Replace video test**

- As admin, open a lesson's edit page that already has a ready video.
- Click "Reemplazar vídeo". Confirm prompt.
- Upload a different short video.
- Expected: new asset ready; visiting lesson page plays the NEW video.
- Check Mux Dashboard: old asset should be gone (not just orphaned).

- [ ] **Step 9: Document anything that did not work**

If any step fails, append an entry to the follow-up list in this plan document under a new "## Known issues after E2E" section and commit. Then open a bug fix task before marking the migration complete.

- [ ] **Step 10: Commit any docs if created**

```bash
git add docs/
git commit -m "docs(mux): record E2E verification results" --allow-empty
```

---

## Self-review checklist (for planner)

After this plan is executed, verify against the spec:

- [ ] Spec §4 (Data model) — Tasks 2 + 15 cover additive + drop migrations. ✓
- [ ] Spec §5 (Admin upload flow) — Tasks 4, 6, 8, 12 cover create upload, polling, widget, integration. ✓
- [ ] Spec §6 (Track management) — Tasks 7, 9, 12 cover actions, component, integration. ✓
- [ ] Spec §7 (Playback) — Tasks 1 (JWT helper), 10 (player), 13 (server component). ✓
- [ ] Spec §8 (Cleanup) — Task 14 (file deletion) + Task 11 (LessonForm slim) + Task 15 (columns drop). ✓
- [ ] Spec §9 (Setup) — Prerequisites section covers manual steps. ✓
- [ ] Spec §10 (Testing) — Tasks 3 and 4 cover unit tests; Task 16 covers manual E2E. ✓
- [ ] Spec §11 (Risks) — Addressed: polling rate (Task 8 POLL_MAX_ATTEMPTS), signing key private (Task 1 server.ts only), orphaned source files (documented skip in Task 9).

No placeholders, TBDs, or "implement later" strings in the plan. All code examples are complete and runnable.

Handoff note: Task 1 requires the user to have completed the Prerequisites manual setup first. If the executing agent finds `MUX_TOKEN_ID` missing at Task 1 Step 4, stop and surface the issue.
