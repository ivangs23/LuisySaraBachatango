# Mux Video Migration — Design Spec

**Date:** 2026-04-23
**Status:** Approved for planning
**Scope:** Full swap of Supabase Storage video pipeline to Mux Video, with signed playback and feature parity for multi-language audio + subtitles.

## 1. Motivation

The current video system streams `.mp4` files from Supabase Storage through a signed-URL proxy (`/api/video/[lessonId]`). Shortcomings:

- No adaptive bitrate (one fixed-quality MP4, poor on mobile/slow connections).
- Downloadable in seconds from DevTools (the 5-minute TTL is trivially captured).
- Multi-language audio + subtitles are custom-built in [components/LessonVideoPlayer.tsx](../../../components/LessonVideoPlayer.tsx) (639 lines) and require per-file manual signing.
- No analytics on viewer engagement or playback quality.

Mux provides HLS adaptive streaming, built-in signed playback via JWT, native multi-track audio + subtitle management, and viewer analytics. A player component (`@mux/mux-player-react`) handles language/subtitle UI natively, letting us delete the custom track-switching code.

## 2. Goals and non-goals

### Goals
- Replace Supabase Storage video storage and serving with Mux.
- Preserve feature parity: admin can add alternate audio tracks and subtitles per lesson.
- Protect paid content with signed playback IDs + JWT (4 h TTL, see §7).
- Remove the 639-line custom player component and the video proxy route.
- Enable Mux Data (analytics) from day 1 (free, no extra config).

### Non-goals
- **DRM** (Widevine/FairPlay). Signed playback + anti-download UX is enough for the current risk profile. Adding DRM later is a config change on new assets, not architectural.
- **Auto-generated captions + AI translation** (`@mux/ai`). Evaluate later with real content.
- **Coexistence with Supabase Storage videos.** Not needed — no production video content exists today (test-only content is disposable).
- **YouTube/Vimeo iframe support.** Dropped. If marketing videos are needed later, they can live outside `lessons`.
- **Migration script for existing `storage://` videos.** No content to migrate.

## 3. Architecture overview

```
Admin                  Browser                Next.js server           Mux
─────                  ───────                ──────────────           ───
Upload video    →      @mux/upchunk      →                       →    Direct Upload URL
                                               createUpload()
                   ← playback_id (poll) ←      getAssetStatus()   ←
Add audio track →                         →    addMuxAudioTrack() →   POST /assets/:id/tracks
Add VTT         →                         →    addMuxTextTrack()  →   POST /assets/:id/tracks

User                   Browser                Next.js server           Mux
────                   ───────                ──────────────           ───
Open lesson      →     <MuxPlayer             getPlaybackToken()
                         playback-id
                         playback-token/>     verify access +
                                               sign JWT (4h TTL)
                   ← HLS segments ←           Mux CDN
```

**Bytes never flow through our server.** Admin uploads go browser→Mux directly. Playback streams Mux CDN→browser directly. Our server signs short-lived JWTs and persists minimal metadata.

## 4. Data model

### Changes to `lessons` table

**Added columns (aditive migration first):**
- `mux_asset_id text` — Mux asset ID, used server-side (add tracks, delete, poll).
- `mux_playback_id text` — signed playback ID passed to `<MuxPlayer>`.
- `mux_upload_id text` — tracks the in-flight direct upload; null once resolved.
- `mux_status text not null default 'pending_upload'` — one of `'pending_upload' | 'preparing' | 'ready' | 'errored'`.

**Removed columns (second migration, after code paths no longer reference them):**
- `video_url` — replaced by `mux_playback_id`.
- `video_source` — no longer a url/upload dichotomy (Mux is the only source).
- `media_config` — track metadata lives in Mux, not our DB.

**Unchanged:**
- `thumbnail_url`, `title`, `description`, `order`, `release_date`, `duration`, `is_free`, `course_id`, `created_at`.

### Tracks: source of truth is Mux

Audio and subtitle tracks are **not persisted in our DB**. On admin edit page render, the server calls `GET /video/v1/assets/:asset_id` and lists tracks directly from Mux. Trade-off: ~100 ms extra latency per admin page load; benefit: no sync issues.

### New storage bucket

- **Name:** `mux-track-sources`
- **Visibility:** public read (Mux fetches files by URL during track creation).
- **Write policy:** admin-only (enforced in server actions).
- **Contents:** `.mp4`/`.m4a` for audio tracks, `.vtt` for subtitles. Path convention: `<lessonId>/<uuid>.<ext>`.
- **Cleanup:** source files remain after Mux ingests them. VTTs are ~KB, audio tracks ~50–200 MB. Not critical; cleanup job can be added later.

## 5. Admin upload flow

### State machine

```
(new lesson)  →  pending_upload  →  preparing  →  ready
                                        ↓
                                     errored
ready  →  preparing  (when admin replaces video)
```

### Step-by-step

1. Admin clicks "+ Añadir lección". Form has title, description, order, etc. — **no video field**.
2. On submit, lesson is inserted with `mux_status = 'pending_upload'`. Redirect to the lesson's edit page.
3. Edit page detects no `mux_asset_id` and renders a **video upload widget**.
4. Admin drops a file and clicks "Subir".
5. Client calls server action `createMuxUpload(lessonId)`:
   - Server requests a Mux Direct Upload with:
     ```json
     {
       "cors_origin": "<origin>",
       "new_asset_settings": {
         "playback_policy": ["signed"],
         "mp4_support": "none",
         "passthrough": "<lessonId>",
         "max_resolution_tier": "1080p"
       }
     }
     ```
   - Response: `{ id, url }`. Server persists `mux_upload_id = id`, returns `{ uploadUrl, uploadId }`.
6. Client instantiates `UpChunk.createUpload({ endpoint: uploadUrl, file })`. Chunks upload directly to Mux.
7. On upload completion, client polls `GET /api/mux/status/:lessonId` every 3 seconds:
   - Server calls `GET /video/v1/uploads/:uploadId`. When `asset_id` appears, calls `GET /video/v1/assets/:assetId`.
   - When `asset.status === 'ready'`, server extracts `playback_ids[0].id` (signed), persists `mux_asset_id`, `mux_playback_id`, `mux_status = 'ready'`, clears `mux_upload_id`. Returns `{ status: 'ready', playbackId }`.
   - If `asset.status === 'errored'`, server persists `mux_status = 'errored'` and returns the error.
   - Polling max duration: 5 minutes. After that, UI shows "upload took too long" with manual retry.
8. UI swaps to preview + "Reemplazar vídeo" button + audio/subtitle track sections (§6).

### Replace video

If admin uploads a new file to a lesson that already has `mux_asset_id`:
- Server calls `DELETE /video/v1/assets/:old_asset_id` **before** creating the new direct upload.
- Resets `mux_status = 'preparing'`, clears `mux_playback_id`, `mux_asset_id`.
- Then the normal upload flow runs.

### Delete lesson

When a lesson is deleted, the server action must call `DELETE /video/v1/assets/:asset_id` before removing the DB row (ignore errors if asset is already gone).

### Error handling

| Failure | Behavior |
|---|---|
| Upload network error | upchunk retries automatically; if exhausted, UI shows error and admin can retry. `mux_status` stays `pending_upload`. |
| Asset transcoding fails (`errored`) | `mux_status = 'errored'`, UI shows "file could not be processed" with re-upload option. |
| Admin closes tab mid-upload | Mux cancels the upload after its timeout. On return, admin sees `pending_upload` and can re-initiate. |
| Polling timeout (5 min) | UI shows "taking longer than expected, check back later"; admin can refresh to poll again. |

## 6. Audio + subtitle track management

### UI (visible only when `mux_status === 'ready'`)

```
━━━ Pistas de audio alternativas ━━━━━━━━━━━━━━
 🔊 English                           [ status: ready ] [Eliminar]
 🔊 Italiano                           [ status: preparing ] [Eliminar]
 [ + Añadir pista de audio ]

━━━ Subtítulos ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 💬 Español                           [Eliminar]
 💬 English                           [Eliminar]
 💬 Français                          [Eliminar]
 [ + Añadir subtítulos ]
```

The track list on page render comes from `GET /video/v1/assets/:asset_id`, filtered by `type` (`audio` / `text`).

### Add track flow

1. Admin opens modal: selects language (`es | en | fr | de | it | ja`, or "other" with free-text language code) and picks a file.
2. Client uploads file to Supabase Storage bucket `mux-track-sources` under path `<lessonId>/<uuid>.<ext>`. Retrieves public URL.
3. Client calls server action `addMuxAudioTrack(lessonId, languageCode, name, fileUrl)` or `addMuxTextTrack(lessonId, languageCode, name, fileUrl)`.
4. Server calls `POST /video/v1/assets/:asset_id/tracks` with the appropriate body:

   Audio:
   ```json
   {
     "url": "<publicFileUrl>",
     "type": "audio",
     "language_code": "en",
     "name": "English"
   }
   ```

   Subtitle:
   ```json
   {
     "url": "<publicFileUrl>",
     "type": "text",
     "text_type": "subtitles",
     "closed_captions": false,
     "language_code": "es",
     "name": "Español"
   }
   ```

5. Mux responds with `{ id, status: 'preparing' }`.
6. `revalidatePath` on the edit page. Admin sees the new track in `preparing` status and can refresh to check when it reaches `ready`.

### UI limits

- **Audio tracks**: max 6 alternates. Accepted MIME: `audio/*` or `video/mp4`.
- **Subtitles**: max 20. Accepted MIME: `text/vtt` only (SRT rejected client-side).
- **File size**: audio < 500 MB, VTT < 1 MB.

### Delete track

- Admin confirms → server action calls `DELETE /video/v1/assets/:asset_id/tracks/:track_id`.
- For MVP: do **not** delete the source file from `mux-track-sources`. Cleanup can be added as a follow-up job if storage costs become relevant.

## 7. Playback flow

### Server component (lesson page)

The existing access-control logic in [app/courses/[courseId]/[lessonId]/page.tsx](../../../app/courses/%5BcourseId%5D/%5BlessonId%5D/page.tsx) is unchanged. Once `hasAccess` is computed:

```ts
import Mux from '@mux/mux-node';

if (hasAccess && lesson.mux_status === 'ready' && lesson.mux_playback_id) {
  const playbackToken = Mux.JWT.signPlaybackId(lesson.mux_playback_id, {
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
    expiration: '4h',
    type: 'video',
  });
  return <LessonPlayer
    playbackId={lesson.mux_playback_id}
    playbackToken={playbackToken}
    lessonId={lesson.id}
    courseId={course.id}
    viewerUserId={user.id}
  />;
}
```

If `mux_status !== 'ready'`, render the existing "video in preparation" / "error" state UI.

### Client component

```tsx
'use client';
import MuxPlayer from '@mux/mux-player-react';
import { markLessonAsCompleted } from '@/app/courses/actions';
import { useRouter } from 'next/navigation';

export default function LessonPlayer({
  playbackId, playbackToken, lessonId, lessonTitle, courseId, viewerUserId,
}: Props) {
  const router = useRouter();
  return (
    <MuxPlayer
      playbackId={playbackId}
      tokens={{ playback: playbackToken }}
      metadata={{
        video_id: lessonId,
        video_title: lessonTitle,
        viewer_user_id: viewerUserId,
      }}
      onEnded={async () => {
        await markLessonAsCompleted(courseId, lessonId);
        router.refresh();
      }}
    />
  );
}
```

### Token decisions

- **Algorithm:** RS256. Public/private key pair generated in Mux Dashboard. Private key lives in `MUX_SIGNING_KEY_PRIVATE` (base64-encoded PEM).
- **TTL:** 4 hours. Covers any realistic lesson length with margin. Not refreshed mid-session (acceptable trade-off; revisit if lessons ever exceed 4 h).
- **Type:** `video`. Separate thumbnail token could be added later if we want Mux-generated thumbnails (currently `thumbnail_url` lives in Supabase Storage, unchanged).

### Anti-download UX

Mux Player includes `controlsList="nodownload"`, blocks right-click, disables PiP by default. No extra work needed on the client.

## 8. Cleanup (code and assets that get removed)

| Item | Reason |
|---|---|
| [components/LessonVideoPlayer.tsx](../../../components/LessonVideoPlayer.tsx) | Replaced by `<MuxPlayer>`. |
| [components/LessonVideoPlayer.module.css](../../../components/LessonVideoPlayer.module.css) | Same. |
| [app/api/video/[lessonId]/route.ts](../../../app/api/video/%5BlessonId%5D/route.ts) | No more storage proxy. |
| Track/subtitle signing loop in lesson server component | Tracks are in Mux. |
| TUS upload code in [components/LessonForm.tsx](../../../components/LessonForm.tsx) (`uploadVideoWithTus`, `uploadFileStandard` for video) | Replaced by upchunk. |
| `video_url`, `video_source`, `media_config` columns in `lessons` | See §4. |
| Supabase Storage bucket `course-content` video files | Empty post-migration. Bucket kept if used for other purposes; inspect before removing. |
| [utils/rate-limit.ts](../../../utils/rate-limit.ts) | Check usages; remove if only used by the deleted video proxy. |
| Dictionary keys that no longer apply (if any) | Verified at end: most lesson strings (locked message, etc.) still apply. |

## 9. Configuration and setup

User (non-code) steps, required before running the new code:

1. Create a Mux account (Starter plan for dev: 10 h encoding + 1 TB streaming free).
2. Mux Dashboard → **Settings → Access Tokens** → create a token with Video Read/Write permissions. Copy `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`.
3. Mux Dashboard → **Settings → Signing Keys** → create a signing key. Copy the `MUX_SIGNING_KEY_ID`. Download the private key PEM and base64-encode it → store as `MUX_SIGNING_KEY_PRIVATE`.
4. Append to `.env.local`:
   ```
   MUX_TOKEN_ID=...
   MUX_TOKEN_SECRET=...
   MUX_SIGNING_KEY_ID=...
   MUX_SIGNING_KEY_PRIVATE=...
   ```
5. Supabase Dashboard → Storage → create a bucket named `mux-track-sources`. **Public read** (Mux fetches by HTTPS URL). **Admin-only write/update/delete** (RLS policy checks `profiles.role = 'admin'`).

### New NPM dependencies
- `@mux/mux-node` (server)
- `@mux/mux-player-react` (client)
- `@mux/upchunk` (client)

## 10. Testing

### Automated
- Vitest mock for `@mux/mux-node` in `vitest.setup.ts` (same pattern as Stripe/Supabase mocks).
- `__tests__/actions/mux.test.ts` — covers `createMuxUpload`, `addMuxAudioTrack`, `addMuxTextTrack`, `deleteMuxTrack`, `deleteMuxAsset`. Assertions: correct Mux API calls, correct DB writes, admin-role guard.
- `__tests__/api/mux-status.test.ts` — covers polling endpoint state transitions (preparing → ready → errored).
- No tests against real Mux API in CI.

### Manual (documented in implementation plan)
- Upload a short test video. Confirm it reaches `ready` in the admin UI.
- Add an English audio track and a Spanish VTT. Confirm both appear with correct statuses.
- In a second browser, log in as a non-admin user with course access. Open the lesson; confirm `<MuxPlayer>` plays, language selector shows Spanish + English, subtitle selector shows Spanish VTT.
- Log in as a user without access. Confirm playback is blocked (no JWT emitted).
- Replace the video. Confirm the old Mux asset is deleted and the new one plays.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mux costs exceed expectations | Starter plan includes 10 h encoding + 1 TB streaming free. Watch Mux dashboard for the first week. Max resolution capped at 1080p. |
| Polling flood when many admins uploading | Polling is per-user, rate-limited by the existing session. Only 1–2 admins; not a concern. |
| Signing key leak | `MUX_SIGNING_KEY_PRIVATE` only referenced in server code. Review before merge. Not exposed in any client bundle. |
| JWT expires mid-playback | 4 h TTL covers all realistic cases. If it becomes an issue, Mux Player supports a refresh handler. |
| Track upload succeeds in Storage but fails in Mux | Admin retries from the same file already in Storage (no re-upload). Track creation is idempotent by Mux from their side (duplicate = two tracks; admin deletes duplicate). |
| Regression during swap | No production content → no regression surface. |

## 12. Implementation order (preview for planning phase)

1. Install SDKs, add env vars, create Mux signing key, set up Vitest mock.
2. Schema migration (add columns; do not drop old ones yet).
3. Server action `createMuxUpload` + status polling endpoint.
4. Rewrite `LessonForm` with upchunk upload widget.
5. Track management server actions + admin UI.
6. `<MuxPlayer>` with JWT signing in lesson server component.
7. Delete obsolete code (`LessonVideoPlayer`, `/api/video`, TUS upload).
8. Schema migration (drop `video_url`, `video_source`, `media_config`).
9. Run tests; manual end-to-end verification.

Details to be fleshed out in the implementation plan (writing-plans skill).
