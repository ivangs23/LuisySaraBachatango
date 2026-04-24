# Notifications Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the notifications system to deliver in-app notifications for likes/replies on comments (lesson + community) and likes/comments on community posts, with per-entity dedupe and clickable navigation.

**Architecture:** Schema-first migration adds `type/entity_type/entity_id/link/actor_ids` to `notifications`, plus a new `post_likes` table. A SECURITY DEFINER PL/pgSQL function `upsert_notification` provides atomic dedupe semantics. A single server-side helper `notify()` is invoked from existing server actions (`toggleLike`, `addComment`, `submitComment`, `gradeSubmission`) and a new `togglePostLike`. The `NotificationBell` client component is rewritten to read a JOIN view, render text by `type`, and mark items as read on click.

**Tech Stack:** Next.js 16 (Server Components + Server Actions), Supabase (Postgres + RLS + RPC), Vitest, CSS Modules.

**Spec:** [docs/superpowers/specs/2026-04-24-notifications-expansion-design.md](../specs/2026-04-24-notifications-expansion-design.md)

---

## File Map

**Created:**
- `supabase/notifications_v2.sql` — schema migration (notifications columns, post_likes table, RLS)
- `supabase/upsert_notification_fn.sql` — RPC function + view
- `utils/notifications/server.ts` — `notify()` helper
- `app/actions/notifications.ts` — `markAsRead`, `markAllRead` server actions
- `app/actions/community-likes.ts` — `togglePostLike` server action
- `components/PostLikeButton.tsx` (+ `.module.css`) — client component for post likes
- `components/CommunityCommentTree.tsx` (+ `.module.css`) — nested community comments + likes
- `__tests__/notifications/notify.test.ts`
- `__tests__/actions/notifications.test.ts`
- `__tests__/actions/community-likes.test.ts`
- `__tests__/actions/comments-notifications.test.ts`
- `__tests__/actions/community-notifications.test.ts`

**Modified:**
- `app/actions/comments.ts` — `toggleLike` and `addComment` call `notify`
- `app/community/actions.ts` — `submitComment` accepts optional `parentId`, calls `notify`
- `app/courses/actions.ts` — `gradeSubmission` migrated to use `notify` helper
- `components/NotificationBell.tsx` (+ `.module.css`) — view-driven rendering, mark-as-read
- `app/community/page.tsx` — show like + comment counts per post
- `app/community/[id]/page.tsx` — mount `PostLikeButton` and `CommunityCommentTree`

---

## Task 1: Schema migration — notifications columns + post_likes

**Files:**
- Create: `supabase/notifications_v2.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/notifications_v2.sql`:

```sql
-- Notifications: enrich with type/entity/link/actor_ids/updated_at
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'generic'
    CHECK (type IN ('comment_like','comment_reply','post_comment','post_like','assignment_graded','generic')),
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS actor_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key
  ON notifications (user_id, type, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);

-- New table: likes on community posts (comments_likes already covers both contexts)
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by all authenticated"
  ON post_likes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own"
  ON post_likes FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration in Supabase**

Open Supabase dashboard → SQL editor → paste and run. Verify with:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position;
SELECT * FROM post_likes LIMIT 1;
```

Expected: see new columns; `post_likes` returns no rows but no error.

- [ ] **Step 3: Verify legacy compatibility**

```sql
SELECT type, COUNT(*) FROM notifications GROUP BY type;
```

Expected: existing rows have `type='generic'`. (If the project has no notifications yet, the result is empty — also OK.)

- [ ] **Step 4: Commit**

```bash
git add supabase/notifications_v2.sql
git commit -m "feat(notifications): add type/entity/link/actor_ids columns and post_likes table"
```

---

## Task 2: RPC function + view

**Files:**
- Create: `supabase/upsert_notification_fn.sql`

- [ ] **Step 1: Write the SQL**

Create `supabase/upsert_notification_fn.sql`:

```sql
CREATE OR REPLACE FUNCTION upsert_notification(
  recipient_id uuid,
  actor_id uuid,
  n_type text,
  ent_type text,
  ent_id uuid,
  n_link text
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, entity_type, entity_id, link, actor_ids, is_read, updated_at)
  VALUES (recipient_id, n_type, ent_type, ent_id, n_link, ARRAY[actor_id], false, now())
  ON CONFLICT (user_id, type, entity_type, entity_id)
    WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL
  DO UPDATE SET
    actor_ids = (
      CASE WHEN actor_id = ANY(notifications.actor_ids)
        THEN notifications.actor_ids
        ELSE array_append(notifications.actor_ids, actor_id)
      END
    ),
    is_read = false,
    updated_at = now(),
    link = EXCLUDED.link;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION upsert_notification(uuid, uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_notification(uuid, uuid, text, text, uuid, text) TO service_role;

CREATE OR REPLACE VIEW notifications_with_actor AS
  SELECT n.*,
    p.full_name AS actor_name,
    p.avatar_url AS actor_avatar,
    array_length(n.actor_ids, 1) AS actor_count
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_ids[1];

GRANT SELECT ON notifications_with_actor TO authenticated;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply in Supabase dashboard**

Run the SQL. Verify:

```sql
SELECT upsert_notification(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'comment_like', 'comment',
  '00000000-0000-0000-0000-000000000003'::uuid,
  '/test'
);
SELECT * FROM notifications WHERE entity_id = '00000000-0000-0000-0000-000000000003'::uuid;
```

Expected: one row inserted with `actor_ids = {00000000-...02}`. Then call again with a different `actor_id` and verify the array grows.

After verifying, clean up:

```sql
DELETE FROM notifications WHERE entity_id = '00000000-0000-0000-0000-000000000003'::uuid;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/upsert_notification_fn.sql
git commit -m "feat(notifications): add upsert_notification RPC and notifications_with_actor view"
```

---

## Task 3: `notify()` helper — write the failing test

**Files:**
- Create: `__tests__/notifications/notify.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockAdminClient = { rpc: mockRpc }

vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: vi.fn(() => mockAdminClient),
}))

beforeEach(() => {
  mockRpc.mockReset()
  mockRpc.mockResolvedValue({ data: null, error: null })
})

describe('notify()', () => {
  it('skips when actor === recipient (no self-notify)', async () => {
    const { notify } = await import('@/utils/notifications/server')
    await notify({
      recipientId: 'user-1',
      actorId: 'user-1',
      type: 'comment_like',
      entityType: 'comment',
      entityId: 'comment-1',
      link: '/x',
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls upsert_notification RPC with mapped params', async () => {
    const { notify } = await import('@/utils/notifications/server')
    await notify({
      recipientId: 'user-1',
      actorId: 'user-2',
      type: 'comment_like',
      entityType: 'comment',
      entityId: 'comment-1',
      link: '/courses/c/lessons/l#comment-comment-1',
    })
    expect(mockRpc).toHaveBeenCalledWith('upsert_notification', {
      recipient_id: 'user-1',
      actor_id: 'user-2',
      n_type: 'comment_like',
      ent_type: 'comment',
      ent_id: 'comment-1',
      n_link: '/courses/c/lessons/l#comment-comment-1',
    })
  })
})
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx vitest run __tests__/notifications/notify.test.ts
```

Expected: FAIL — `Cannot find module '@/utils/notifications/server'` and `@/utils/supabase/admin`.

---

## Task 4: `createSupabaseAdmin` factory (if missing)

**Files:**
- Create or verify: `utils/supabase/admin.ts`

- [ ] **Step 1: Check if it already exists**

```bash
ls utils/supabase/admin.ts 2>/dev/null && cat utils/supabase/admin.ts
```

If the file exists and exports `createSupabaseAdmin`, skip to Task 5.

- [ ] **Step 2: Create the factory if missing**

```ts
import { createClient } from '@supabase/supabase-js'

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 3: Commit (if file created)**

```bash
git add utils/supabase/admin.ts
git commit -m "feat(supabase): expose createSupabaseAdmin factory"
```

---

## Task 5: Implement `notify()` helper

**Files:**
- Create: `utils/notifications/server.ts`

- [ ] **Step 1: Write the helper**

```ts
import { createSupabaseAdmin } from '@/utils/supabase/admin'

export type NotifyInput = {
  recipientId: string
  actorId: string
  type:
    | 'comment_like'
    | 'comment_reply'
    | 'post_comment'
    | 'post_like'
    | 'assignment_graded'
  entityType: 'comment' | 'post' | 'submission'
  entityId: string
  link: string
}

export async function notify(input: NotifyInput): Promise<void> {
  if (input.recipientId === input.actorId) return

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.rpc('upsert_notification', {
    recipient_id: input.recipientId,
    actor_id: input.actorId,
    n_type: input.type,
    ent_type: input.entityType,
    ent_id: input.entityId,
    n_link: input.link,
  })

  if (error) {
    console.error('notify() failed:', error)
  }
}
```

- [ ] **Step 2: Run the test — verify it passes**

```bash
npx vitest run __tests__/notifications/notify.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 3: Commit**

```bash
git add utils/notifications/server.ts __tests__/notifications/notify.test.ts
git commit -m "feat(notifications): add notify() server helper"
```

---

## Task 6: Wire `toggleLike` (lesson comments) to send notifications

**Files:**
- Modify: `app/actions/comments.ts`
- Create: `__tests__/actions/comments-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/actions/comments-notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function makeChain(returns: Record<string, unknown>) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returns.single ?? { data: null, error: null }),
    insert: vi.fn().mockResolvedValue(returns.insert ?? { data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
  }
  return obj
}

beforeEach(() => {
  mockNotify.mockReset()
})

describe('toggleLike — notifications', () => {
  it('notifies the comment author when adding a like', async () => {
    const commentChain = makeChain({
      single: { data: { id: 'comment-1', user_id: 'author-1', lesson_id: 'lesson-1', post_id: null }, error: null },
    })
    const likeCheckChain = makeChain({
      single: { data: null, error: null }, // not yet liked
    })
    const likeInsertChain = makeChain({
      insert: { data: null, error: null },
    })
    const lessonChain = makeChain({
      single: { data: { course_id: 'course-1' }, error: null },
    })

    const fromMap: Record<string, unknown> = {}
    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') return commentChain
      if (table === 'lessons') return lessonChain
      if (table === 'comment_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeInsertChain
      }
      return makeChain({})
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { toggleLike } = await import('@/app/actions/comments')
    await toggleLike('comment-1')

    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'author-1',
      actorId: 'liker-1',
      type: 'comment_like',
      entityType: 'comment',
      entityId: 'comment-1',
      link: '/courses/course-1/lessons/lesson-1#comment-comment-1',
    })
  })

  it('does NOT notify when removing a like', async () => {
    const commentChain = makeChain({
      single: { data: { id: 'comment-1', user_id: 'author-1', lesson_id: 'lesson-1', post_id: null }, error: null },
    })
    const likeCheckChain = makeChain({
      single: { data: { id: 'like-1' }, error: null }, // already liked
    })
    const likeDeleteChain = makeChain({})

    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') return commentChain
      if (table === 'comment_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeDeleteChain
      }
      return makeChain({})
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { toggleLike } = await import('@/app/actions/comments')
    await toggleLike('comment-1')

    expect(mockNotify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run __tests__/actions/comments-notifications.test.ts
```

Expected: FAIL — `notify` not called yet.

- [ ] **Step 3: Modify `toggleLike` in `app/actions/comments.ts`**

Replace the existing `toggleLike` function with:

```ts
export async function toggleLike(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Debes iniciar sesión' };
  }

  // Fetch the comment (need author + context for the link)
  const { data: comment } = await supabase
    .from('comments')
    .select('id, user_id, lesson_id, post_id')
    .eq('id', commentId)
    .single();

  if (!comment) return { error: 'Comentario no encontrado' };

  const { data: existingLike } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single();

  if (existingLike) {
    await supabase.from('comment_likes').delete().eq('id', existingLike.id);
    return { success: true };
  }

  await supabase.from('comment_likes').insert({
    comment_id: commentId,
    user_id: user.id,
  });

  // Build the link based on context (lesson vs community)
  let link: string;
  if (comment.lesson_id) {
    const { data: lesson } = await supabase
      .from('lessons')
      .select('course_id')
      .eq('id', comment.lesson_id)
      .single();
    link = `/courses/${lesson?.course_id ?? ''}/lessons/${comment.lesson_id}#comment-${commentId}`;
  } else if (comment.post_id) {
    link = `/community/${comment.post_id}#comment-${commentId}`;
  } else {
    link = '/';
  }

  await notify({
    recipientId: comment.user_id,
    actorId: user.id,
    type: 'comment_like',
    entityType: 'comment',
    entityId: commentId,
    link,
  });

  return { success: true };
}
```

Also add the import at the top of the file:

```ts
import { notify } from '@/utils/notifications/server';
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/actions/comments-notifications.test.ts __tests__/actions/comments.test.ts
```

Expected: PASS — new notification tests + existing comment tests still pass.

- [ ] **Step 5: Commit**

```bash
git add app/actions/comments.ts __tests__/actions/comments-notifications.test.ts
git commit -m "feat(comments): notify comment author on like (lesson + community)"
```

---

## Task 7: Wire `addComment` (lesson) to notify on reply

**Files:**
- Modify: `app/actions/comments.ts`
- Modify: `__tests__/actions/comments-notifications.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/actions/comments-notifications.test.ts`:

```ts
describe('addComment — notifications', () => {
  it('notifies the parent comment author when posting a reply', async () => {
    const insertedId = 'reply-1'
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: insertedId }, error: null }),
    }
    const parentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { user_id: 'parent-author-1', lesson_id: 'lesson-1' },
        error: null,
      }),
    }
    const lessonChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
    }

    let commentsCallCount = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') {
        commentsCallCount += 1
        return commentsCallCount === 1 ? insertChain : parentChain
      }
      if (table === 'lessons') return lessonChain
      throw new Error(`Unexpected table: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'replier-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    await addComment('lesson-1', 'My reply', 'parent-comment-1', 'course-1')

    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'parent-author-1',
      actorId: 'replier-1',
      type: 'comment_reply',
      entityType: 'comment',
      entityId: insertedId,
      link: '/courses/course-1/lessons/lesson-1#comment-reply-1',
    })
  })

  it('does NOT notify when posting a top-level comment (no parentId)', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'top-1' }, error: null }),
    }
    const from = vi.fn(() => insertChain)

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    await addComment('lesson-1', 'Hello world', null, 'course-1')

    expect(mockNotify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify it fails**

```bash
npx vitest run __tests__/actions/comments-notifications.test.ts
```

Expected: FAIL — addComment doesn't call notify yet, and the current insert doesn't return the new id.

- [ ] **Step 3: Modify `addComment` in `app/actions/comments.ts`**

Replace the body of `addComment` so it returns the new id and notifies on reply:

```ts
export async function addComment(lessonId: string, content: string, parentId: string | null = null, courseId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Debes iniciar sesión para comentar' };
  }

  if (!content || content.trim().length === 0) {
    return { error: 'El comentario no puede estar vacío' };
  }
  if (content.length > 5000) {
    return { error: 'El comentario no puede superar los 5000 caracteres' };
  }

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({
      content: content.trim(),
      lesson_id: lessonId,
      user_id: user.id,
      parent_id: parentId,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return { error: 'Error al publicar el comentario' };
  }

  if (parentId) {
    const { data: parent } = await supabase
      .from('comments')
      .select('user_id, lesson_id')
      .eq('id', parentId)
      .single();

    if (parent) {
      const { data: lesson } = await supabase
        .from('lessons')
        .select('course_id')
        .eq('id', parent.lesson_id)
        .single();

      await notify({
        recipientId: parent.user_id,
        actorId: user.id,
        type: 'comment_reply',
        entityType: 'comment',
        entityId: inserted.id,
        link: `/courses/${lesson?.course_id ?? courseId ?? ''}/lessons/${parent.lesson_id}#comment-${inserted.id}`,
      });
    }
  }

  if (courseId) {
    revalidatePath(`/courses/${courseId}/${lessonId}`);
  }
  return { success: true };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/actions/comments-notifications.test.ts __tests__/actions/comments.test.ts
```

Expected: PASS — new + existing tests green.

- [ ] **Step 5: Commit**

```bash
git add app/actions/comments.ts __tests__/actions/comments-notifications.test.ts
git commit -m "feat(comments): notify parent author on reply"
```

---

## Task 8: Update community `submitComment` — accept `parentId`, notify post + parent author

**Files:**
- Modify: `app/community/actions.ts`
- Create: `__tests__/actions/community-notifications.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/actions/community-notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

beforeEach(() => mockNotify.mockReset())

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
  return fd
}

describe('submitComment — notifications', () => {
  it('notifies the post author when adding a top-level comment', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-comment-1' }, error: null }),
    }
    const postChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'post-author-1' }, error: null }),
    }
    const from = vi.fn((table: string) => {
      if (table === 'comments') return insertChain
      if (table === 'posts') return postChain
      throw new Error(`unexpected: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'commenter-1' } } }) },
      from,
    } as never)

    const { submitComment } = await import('@/app/community/actions')
    await submitComment(makeFormData({ postId: 'post-1', content: 'Nice post!' }))

    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'post-author-1',
      actorId: 'commenter-1',
      type: 'post_comment',
      entityType: 'post',
      entityId: 'post-1',
      link: '/community/post-1#comment-new-comment-1',
    })
  })

  it('also notifies the parent comment author when parentId is given', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'reply-1' }, error: null }),
    }
    const postChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'post-author-1' }, error: null }),
    }
    const parentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'parent-author-1' }, error: null }),
    }

    let commentsCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') {
        commentsCalls += 1
        return commentsCalls === 1 ? insertChain : parentChain
      }
      if (table === 'posts') return postChain
      throw new Error(`unexpected: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'commenter-1' } } }) },
      from,
    } as never)

    const { submitComment } = await import('@/app/community/actions')
    await submitComment(makeFormData({
      postId: 'post-1',
      content: 'Replying',
      parentId: 'parent-comment-1',
    }))

    expect(mockNotify).toHaveBeenCalledTimes(2)
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'post_comment',
      recipientId: 'post-author-1',
    }))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'comment_reply',
      recipientId: 'parent-author-1',
      entityId: 'reply-1',
    }))
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run __tests__/actions/community-notifications.test.ts
```

Expected: FAIL — `submitComment` does not yet read `parentId` or call `notify`.

- [ ] **Step 3: Update `submitComment` in `app/community/actions.ts`**

Replace the existing `submitComment` with:

```ts
export async function submitComment(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const postId = formData.get('postId') as string
  const content = formData.get('content') as string
  const parentId = (formData.get('parentId') as string | null) || null

  if (!postId || !content) {
    return
  }
  if (content.length > 5000) {
    return
  }

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({
      user_id: user.id,
      post_id: postId,
      content: content.trim(),
      parent_id: parentId,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return
  }

  // Notify post author
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (post) {
    await notify({
      recipientId: post.user_id,
      actorId: user.id,
      type: 'post_comment',
      entityType: 'post',
      entityId: postId,
      link: `/community/${postId}#comment-${inserted.id}`,
    })
  }

  // If reply, also notify parent author
  if (parentId) {
    const { data: parent } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', parentId)
      .single()

    if (parent) {
      await notify({
        recipientId: parent.user_id,
        actorId: user.id,
        type: 'comment_reply',
        entityType: 'comment',
        entityId: inserted.id,
        link: `/community/${postId}#comment-${inserted.id}`,
      })
    }
  }

  revalidatePath(`/community/${postId}`)
}
```

Add the import at the top:

```ts
import { notify } from '@/utils/notifications/server'
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run __tests__/actions/community-notifications.test.ts __tests__/actions/community.test.ts
```

Expected: PASS — new notification tests + existing community tests stay green.

- [ ] **Step 5: Commit**

```bash
git add app/community/actions.ts __tests__/actions/community-notifications.test.ts
git commit -m "feat(community): notify post author + parent author on comment/reply"
```

---

## Task 9: New `togglePostLike` server action

**Files:**
- Create: `app/actions/community-likes.ts`
- Create: `__tests__/actions/community-likes.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/actions/community-likes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => mockNotify.mockReset())

describe('togglePostLike', () => {
  it('inserts like and notifies post author when not yet liked', async () => {
    const likeCheckChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const likeInsertChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const postChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'post-author-1' }, error: null }),
    }

    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'post_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeInsertChain
      }
      if (table === 'posts') return postChain
      throw new Error(`unexpected: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { togglePostLike } = await import('@/app/actions/community-likes')
    await togglePostLike('post-1')

    expect(likeInsertChain.insert).toHaveBeenCalledWith({ post_id: 'post-1', user_id: 'liker-1' })
    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'post-author-1',
      actorId: 'liker-1',
      type: 'post_like',
      entityType: 'post',
      entityId: 'post-1',
      link: '/community/post-1',
    })
  })

  it('removes like and does NOT notify when already liked', async () => {
    const likeCheckChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'like-1' }, error: null }),
    }
    const likeDeleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    let calls = 0
    const from = vi.fn((table: string) => {
      if (table !== 'post_likes') throw new Error('unexpected')
      calls += 1
      return calls === 1 ? likeCheckChain : likeDeleteChain
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { togglePostLike } = await import('@/app/actions/community-likes')
    await togglePostLike('post-1')

    expect(likeDeleteChain.delete).toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run __tests__/actions/community-likes.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `togglePostLike`**

Create `app/actions/community-likes.ts`:

```ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { notify } from '@/utils/notifications/server'
import { revalidatePath } from 'next/cache'

export async function togglePostLike(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Debes iniciar sesión' }
  }

  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id)
    revalidatePath(`/community/${postId}`)
    return { success: true, liked: false }
  }

  await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })

  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (post) {
    await notify({
      recipientId: post.user_id,
      actorId: user.id,
      type: 'post_like',
      entityType: 'post',
      entityId: postId,
      link: `/community/${postId}`,
    })
  }

  revalidatePath(`/community/${postId}`)
  return { success: true, liked: true }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npx vitest run __tests__/actions/community-likes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/community-likes.ts __tests__/actions/community-likes.test.ts
git commit -m "feat(community): add togglePostLike action with notification"
```

---

## Task 10: Migrate `gradeSubmission` to use `notify()`

**Files:**
- Modify: `app/courses/actions.ts`

- [ ] **Step 1: Locate the existing notification insert**

```bash
grep -n "from('notifications')" app/courses/actions.ts
```

- [ ] **Step 2: Replace the direct insert with `notify()` call**

In `app/courses/actions.ts`, find the block (around line 348 per spec) that inserts into `notifications`. Replace it. The full block currently looks similar to:

```ts
await supabase.from('notifications').insert({
  user_id: submittedUserId,
  title: 'Tu tarea ha sido corregida',
  message: `El profesor ha revisado tu entrega. Calificación: ${grade || 'Sin nota'}`,
})
```

Replace with:

```ts
// Direct insert keeps the legacy title/message for backward compat with the bell's fallback path.
await supabase.from('notifications').insert({
  user_id: submittedUserId,
  title: 'Tu tarea ha sido corregida',
  message: `El profesor ha revisado tu entrega. Calificación: ${grade || 'Sin nota'}`,
  type: 'assignment_graded',
  entity_type: 'submission',
  entity_id: submissionId,
  link: `/courses/${courseId}/lessons/${lessonId}`,
  actor_ids: [user.id],
})
```

> Note: this uses the standard supabase client (RLS) — the existing flow already worked via service role or admin context inside `gradeSubmission`. Read the surrounding code in `app/courses/actions.ts` to confirm which client is in scope and use the same one. If RLS blocks the insert, switch this block to `createSupabaseAdmin()` only for the insert. Do not blindly change the rest of the function's client.

The variable names (`submittedUserId`, `submissionId`, `courseId`, `lessonId`, `user.id`) must match the existing scope — adapt to what's actually available in the function.

- [ ] **Step 3: Run existing course tests**

```bash
npx vitest run __tests__/actions/courses.test.ts
```

Expected: PASS — no regression. If the existing test asserts on the exact insert payload, update the assertion to include the new fields.

- [ ] **Step 4: Commit**

```bash
git add app/courses/actions.ts __tests__/actions/courses.test.ts
git commit -m "feat(courses): tag assignment_graded notifications with type/entity/link"
```

---

## Task 11: `markAsRead` and `markAllRead` server actions

**Files:**
- Create: `app/actions/notifications.ts`
- Create: `__tests__/actions/notifications.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/actions/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

// A thenable+chainable Supabase query-builder mock. Records each method call so
// tests can assert on the sequence (e.g. .eq('id', x) then .eq('user_id', y)).
function makeBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: { method: string; args: unknown[] }[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    calls,
    then: (resolve: (v: unknown) => void) => resolve(result),
  }
  for (const m of ['select', 'eq', 'update', 'insert', 'delete', 'order', 'in', 'single']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return builder
    })
  }
  return builder
}

describe('markAsRead', () => {
  it('updates the row scoped to the current user', async () => {
    const builder = makeBuilder()
    const from = vi.fn(() => builder)

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { markAsRead } = await import('@/app/actions/notifications')
    await markAsRead('notif-1')

    expect(from).toHaveBeenCalledWith('notifications')
    expect(builder.update).toHaveBeenCalledWith({ is_read: true })
    const eqCalls = builder.calls.filter((c: { method: string }) => c.method === 'eq')
    expect(eqCalls).toEqual([
      { method: 'eq', args: ['id', 'notif-1'] },
      { method: 'eq', args: ['user_id', 'user-1'] },
    ])
  })

  it('no-ops when not authenticated', async () => {
    const from = vi.fn()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    } as never)

    const { markAsRead } = await import('@/app/actions/notifications')
    await markAsRead('notif-1')

    expect(from).not.toHaveBeenCalled()
  })
})

describe('markAllRead', () => {
  it('updates all unread rows scoped to the current user', async () => {
    const builder = makeBuilder()
    const from = vi.fn(() => builder)

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { markAllRead } = await import('@/app/actions/notifications')
    await markAllRead()

    expect(builder.update).toHaveBeenCalledWith({ is_read: true })
    const eqCalls = builder.calls.filter((c: { method: string }) => c.method === 'eq')
    expect(eqCalls).toEqual([
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'eq', args: ['is_read', false] },
    ])
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run __tests__/actions/notifications.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement actions**

Create `app/actions/notifications.ts`:

```ts
'use server'

import { createClient } from '@/utils/supabase/server'

export async function markAsRead(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)
}

export async function markAllRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npx vitest run __tests__/actions/notifications.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/notifications.ts __tests__/actions/notifications.test.ts
git commit -m "feat(notifications): add markAsRead/markAllRead actions"
```

---

## Task 12: Rewrite `NotificationBell` to use the view + render by type

**Files:**
- Modify: `components/NotificationBell.tsx`
- Modify: `components/NotificationBell.module.css` (add a few styles for actions)

- [ ] **Step 1: Update the component**

Replace the contents of `components/NotificationBell.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useClickOutside } from '@/hooks/useClickOutside';
import styles from './NotificationBell.module.css';
import { createClient } from '@/utils/supabase/client';
import { markAsRead, markAllRead } from '@/app/actions/notifications';

type NotificationRow = {
  id: string;
  type: string;
  title: string | null;
  message: string | null;
  link: string | null;
  is_read: boolean;
  actor_name: string | null;
  actor_avatar: string | null;
  actor_count: number | null;
  updated_at: string;
};

function renderText(n: NotificationRow): string {
  const others = (n.actor_count ?? 1) - 1;
  const namePart = n.actor_name ?? 'Alguien';
  const suffix = others > 0 ? ` y ${others} más` : '';
  switch (n.type) {
    case 'comment_like':
      return `${namePart}${suffix} dio like a tu comentario`;
    case 'comment_reply':
      return `${namePart} respondió a tu comentario`;
    case 'post_comment':
      return `${namePart} comentó tu publicación`;
    case 'post_like':
      return `${namePart}${suffix} dio like a tu publicación`;
    case 'assignment_graded':
      return n.title ?? 'Tu tarea ha sido corregida';
    default:
      return n.title ?? n.message ?? 'Notificación';
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useClickOutside(dropdownRef, () => {
    if (isOpen) setIsOpen(false);
  });

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notifications_with_actor')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) setItems(data as NotificationRow[]);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = items.filter(i => !i.is_read).length;

  const handleClick = async (n: NotificationRow) => {
    setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i));
    await markAsRead(n.id);
    setIsOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAll = async () => {
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
    await markAllRead();
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.bell} onClick={() => setIsOpen(!isOpen)} aria-label="Notificaciones">
        <svg
          xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ display: 'block' }}
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3 className={styles.title}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAll}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className={styles.empty}>No tienes notificaciones nuevas.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}
                  onClick={() => handleClick(n)}
                  role="button"
                  tabIndex={0}
                >
                  {renderText(n)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add minimal styles to `components/NotificationBell.module.css`**

Append (or merge into existing):

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem 0.5rem;
}
.markAllBtn {
  background: none;
  border: none;
  color: var(--primary, #d4a85a);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
}
.markAllBtn:hover { text-decoration: underline; }

.item {
  cursor: pointer;
}
.item.unread {
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 3: Manual smoke test**

Start the dev server:

```bash
npm run dev
```

Open the app in a browser, sign in as user A, navigate around to confirm the bell renders and `notifications_with_actor` is queryable. There won't be new notifications until Task 13+ is wired into the UI, but the bell should not error.

Open the browser devtools network tab — the bell request should hit `notifications_with_actor`, not `notifications`.

- [ ] **Step 4: Commit**

```bash
git add components/NotificationBell.tsx components/NotificationBell.module.css
git commit -m "feat(bell): render typed notifications via view, mark-as-read on click"
```

---

## Task 13: `PostLikeButton` client component

**Files:**
- Create: `components/PostLikeButton.tsx`
- Create: `components/PostLikeButton.module.css`

- [ ] **Step 1: Implement the component**

Create `components/PostLikeButton.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { togglePostLike } from '@/app/actions/community-likes'
import styles from './PostLikeButton.module.css'

type Props = {
  postId: string
  initialLiked: boolean
  initialCount: number
}

export default function PostLikeButton({ postId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))
    startTransition(async () => {
      const res = await togglePostLike(postId)
      if (!res.success) {
        // revert on error
        setLiked(!next)
        setCount(c => c - (next ? 1 : -1))
      }
    })
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${liked ? styles.liked : ''}`}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? 'Quitar like' : 'Dar like'}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      <span className={styles.count}>{count}</span>
    </button>
  )
}
```

Create `components/PostLikeButton.module.css`:

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: 1px solid rgba(255,255,255,0.15);
  color: var(--text-muted, #aaa);
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  transition: all 0.15s ease-out;
}
.btn:hover { color: var(--primary, #d4a85a); border-color: var(--primary, #d4a85a); }
.btn.liked { color: var(--primary, #d4a85a); border-color: var(--primary, #d4a85a); }
.btn:disabled { opacity: 0.6; cursor: wait; }
.count { font-size: 0.85rem; }
```

- [ ] **Step 2: Commit**

```bash
git add components/PostLikeButton.tsx components/PostLikeButton.module.css
git commit -m "feat(community): add PostLikeButton client component"
```

---

## Task 14: `CommunityCommentTree` component (one-level nesting + likes)

**Files:**
- Create: `components/CommunityCommentTree.tsx`
- Create: `components/CommunityCommentTree.module.css`

- [ ] **Step 1: Implement the component**

Create `components/CommunityCommentTree.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toggleLike } from '@/app/actions/comments'
import { submitComment } from '@/app/community/actions'
import styles from './CommunityCommentTree.module.css'

export type CommunityComment = {
  id: string
  content: string
  user_id: string
  parent_id: string | null
  created_at: string
  author_name: string
  author_avatar: string | null
  likes_count: number
  user_has_liked: boolean
  replies: CommunityComment[]
}

type Props = {
  postId: string
  comments: CommunityComment[]
  currentUserId: string | null
}

function CommentNode({
  comment, postId, currentUserId, depth,
}: { comment: CommunityComment; postId: string; currentUserId: string | null; depth: number }) {
  const [liked, setLiked] = useState(comment.user_has_liked)
  const [count, setCount] = useState(comment.likes_count)
  const [showReply, setShowReply] = useState(false)
  const [, startTransition] = useTransition()

  const onLike = () => {
    if (!currentUserId) return
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))
    startTransition(() => { void toggleLike(comment.id) })
  }

  return (
    <div className={styles.node} id={`comment-${comment.id}`}>
      <div className={styles.header}>
        <strong>{comment.author_name}</strong>
        <span className={styles.date}>{new Date(comment.created_at).toLocaleString()}</span>
      </div>
      <p className={styles.body}>{comment.content}</p>
      <div className={styles.actions}>
        <button type="button" onClick={onLike} className={liked ? styles.liked : ''} disabled={!currentUserId}>
          ♥ {count}
        </button>
        {currentUserId && depth === 0 && (
          <button type="button" onClick={() => setShowReply(s => !s)}>
            {showReply ? 'Cancelar' : 'Responder'}
          </button>
        )}
      </div>

      {showReply && (
        <form action={submitComment} className={styles.replyForm}>
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="parentId" value={comment.id} />
          <textarea name="content" required maxLength={5000} placeholder="Escribe tu respuesta…" />
          <button type="submit">Publicar</button>
        </form>
      )}

      {comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map(r => (
            <CommentNode key={r.id} comment={r} postId={postId} currentUserId={currentUserId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommunityCommentTree({ postId, comments, currentUserId }: Props) {
  return (
    <div className={styles.tree}>
      {comments.map(c => (
        <CommentNode key={c.id} comment={c} postId={postId} currentUserId={currentUserId} depth={0} />
      ))}
    </div>
  )
}
```

Create `components/CommunityCommentTree.module.css`:

```css
.tree { display: flex; flex-direction: column; gap: 1rem; }
.node {
  background: rgba(255,255,255,0.03);
  padding: 0.8rem 1rem;
  border-radius: 8px;
}
.header { display: flex; gap: 0.6rem; align-items: baseline; }
.date { color: var(--text-muted, #888); font-size: 0.75rem; }
.body { margin: 0.4rem 0; white-space: pre-wrap; }
.actions { display: flex; gap: 0.8rem; }
.actions button {
  background: none; border: none; color: var(--text-muted, #aaa);
  cursor: pointer; padding: 0; font-size: 0.85rem;
}
.actions button.liked { color: var(--primary, #d4a85a); }
.actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.replyForm { margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem; }
.replyForm textarea { min-height: 60px; padding: 0.5rem; border-radius: 4px; }
.replyForm button { align-self: flex-end; padding: 0.4rem 0.8rem; }
.replies { margin-top: 0.8rem; padding-left: 1rem; border-left: 2px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 0.6rem; }
```

- [ ] **Step 2: Commit**

```bash
git add components/CommunityCommentTree.tsx components/CommunityCommentTree.module.css
git commit -m "feat(community): add CommunityCommentTree with replies + likes"
```

---

## Task 15: Wire community pages to use new components

**Files:**
- Modify: `app/community/[id]/page.tsx`
- Modify: `app/community/page.tsx`

- [ ] **Step 1: Read the current state of both files**

```bash
cat app/community/page.tsx app/community/[id]/page.tsx
```

Identify the data-fetching block for the post detail page and the comments rendering loop.

- [ ] **Step 2: Update the post detail page**

In `app/community/[id]/page.tsx`, add fetching for likes and reshape comments into a tree. Replace the comments rendering with the new component. Concretely:

a) **Fetch likes (server component):**

```ts
const { data: likes } = await supabase
  .from('post_likes')
  .select('user_id')
  .eq('post_id', postId)

const likeCount = likes?.length ?? 0
const userLiked = !!user && !!likes?.some(l => l.user_id === user.id)
```

b) **Fetch comments + their likes + author profiles:**

```ts
const { data: rawComments } = await supabase
  .from('comments')
  .select('id, content, user_id, parent_id, created_at')
  .eq('post_id', postId)
  .order('created_at', { ascending: true })

const userIds = Array.from(new Set((rawComments ?? []).map(c => c.user_id)))
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name, avatar_url')
  .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

const commentIds = (rawComments ?? []).map(c => c.id)
const { data: commentLikes } = await supabase
  .from('comment_likes')
  .select('comment_id, user_id')
  .in('comment_id', commentIds.length ? commentIds : ['00000000-0000-0000-0000-000000000000'])

const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

const enriched = (rawComments ?? []).map(c => {
  const cl = (commentLikes ?? []).filter(l => l.comment_id === c.id)
  const profile = profileMap.get(c.user_id)
  return {
    ...c,
    author_name: profile?.full_name ?? 'Usuario',
    author_avatar: profile?.avatar_url ?? null,
    likes_count: cl.length,
    user_has_liked: !!user && cl.some(l => l.user_id === user.id),
    replies: [] as typeof rawComments,
  }
})

const byId = new Map(enriched.map(c => [c.id, c]))
const roots: typeof enriched = []
enriched.forEach(c => {
  if (c.parent_id) {
    const parent = byId.get(c.parent_id)
    if (parent) (parent as { replies: typeof enriched }).replies.push(c)
    else roots.push(c)
  } else {
    roots.push(c)
  }
})
```

c) **Replace the rendering of comments + add the like button.** Where the current page renders comments (look for the existing loop), substitute:

```tsx
import PostLikeButton from '@/components/PostLikeButton'
import CommunityCommentTree from '@/components/CommunityCommentTree'

// inside JSX, near the post title:
<PostLikeButton postId={postId} initialLiked={userLiked} initialCount={likeCount} />

// where comments are rendered:
<CommunityCommentTree
  postId={postId}
  comments={roots as never}
  currentUserId={user?.id ?? null}
/>
```

Keep the existing top-level "submit new comment" form as-is (it already calls `submitComment`).

- [ ] **Step 3: Update the community list page**

In `app/community/page.tsx`, after fetching posts, fetch aggregate counts and pass them through:

```ts
const postIds = posts?.map(p => p.id) ?? []

const [{ data: postLikeRows }, { data: commentRows }] = await Promise.all([
  supabase.from('post_likes').select('post_id').in('post_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']),
  supabase.from('comments').select('post_id').in('post_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']),
])

const likeCounts = new Map<string, number>()
postLikeRows?.forEach(r => likeCounts.set(r.post_id, (likeCounts.get(r.post_id) ?? 0) + 1))

const commentCounts = new Map<string, number>()
commentRows?.forEach(r => commentCounts.set(r.post_id, (commentCounts.get(r.post_id) ?? 0) + 1))
```

In the post card markup, render `♥ {likeCounts.get(p.id) ?? 0} · 💬 {commentCounts.get(p.id) ?? 0}` next to the meta line.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Open `/community` as user A:
- Confirm post cards show like + comment counts.
- Open a post, confirm the like button works (toggles, updates count), confirm replying to a comment creates a nested reply.

Then sign in as user B (different account), like user A's comment and reply to it. Sign back in as user A and confirm the bell shows "B dio like a tu comentario" and "B respondió a tu comentario", clicking each navigates to `/community/<post>#comment-<id>`.

- [ ] **Step 5: Commit**

```bash
git add app/community/page.tsx app/community/[id]/page.tsx
git commit -m "feat(community): wire PostLikeButton + CommunityCommentTree into pages"
```

---

## Task 16: End-to-end verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Manual scenarios checklist**

Use two accounts (A = recipient, B = actor):

- [ ] B likes A's lesson comment → A's bell shows "B dio like a tu comentario" with link to lesson page anchored to the comment.
- [ ] C also likes the same comment → A's notification updates to "B y 1 más dio like a tu comentario", `is_read` resets.
- [ ] A reads/clicks the notification → it disappears from unread, navigation lands on the lesson page at the comment.
- [ ] B replies to A's lesson comment → A receives a `comment_reply` notification.
- [ ] B comments on A's community post → A receives `post_comment`.
- [ ] B likes A's community post → A receives `post_like`.
- [ ] A acts on A's own content → no notification created (verify by querying `notifications` directly in Supabase).
- [ ] "Marcar todas como leídas" empties the unread badge but rows stay visible until reload.
- [ ] Existing assignment grading still produces a notification and renders correctly.

- [ ] **Step 4: Final commit (if any UI tweaks emerged)**

```bash
git add -A
git status
# review and commit any small fixes
```
