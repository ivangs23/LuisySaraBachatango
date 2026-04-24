#!/usr/bin/env node
// Diagnose why /api/mux/status/:lessonId isn't transitioning a lesson from
// preparing -> ready. Fetches every lesson whose mux_status is not 'ready'
// and compares against the live Mux asset state.

import { createClient } from '@supabase/supabase-js'
import Mux from '@mux/mux-node'
import { readFileSync } from 'node:fs'

const envFile = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const mux = new Mux({
  tokenId: env.MUX_TOKEN_ID,
  tokenSecret: env.MUX_TOKEN_SECRET,
})

const { data: lessons, error } = await supabase
  .from('lessons')
  .select('id, title, mux_upload_id, mux_asset_id, mux_playback_id, mux_status')
  .neq('mux_status', 'ready')

if (error) {
  console.error('DB query error:', error)
  process.exit(1)
}

console.log(`Found ${lessons.length} lesson(s) not in 'ready' state:\n`)

for (const lesson of lessons) {
  console.log('─'.repeat(60))
  console.log(`Lesson: ${lesson.title} (${lesson.id})`)
  console.log(`  DB status: ${lesson.mux_status}`)
  console.log(`  DB upload_id: ${lesson.mux_upload_id ?? '(none)'}`)
  console.log(`  DB asset_id:  ${lesson.mux_asset_id ?? '(none)'}`)
  console.log(`  DB playback:  ${lesson.mux_playback_id ?? '(none)'}`)

  let assetId = lesson.mux_asset_id

  if (!assetId && lesson.mux_upload_id) {
    try {
      const upload = await mux.video.uploads.retrieve(lesson.mux_upload_id)
      console.log(`  Mux upload status: ${upload.status}`)
      console.log(`  Mux upload asset_id: ${upload.asset_id ?? '(none)'}`)
      assetId = upload.asset_id
    } catch (e) {
      console.log(`  Mux upload lookup FAILED: ${e.message}`)
    }
  }

  if (assetId) {
    try {
      const asset = await mux.video.assets.retrieve(assetId)
      console.log(`  Mux asset status: ${asset.status}`)
      console.log(`  Mux asset duration: ${asset.duration}s`)
      console.log(`  Mux asset playback_ids:`, JSON.stringify(asset.playback_ids, null, 2))
    } catch (e) {
      console.log(`  Mux asset lookup FAILED: ${e.message}`)
    }
  } else {
    console.log(`  → Can't proceed: no asset_id available`)
  }
}

console.log('\nDone.')
