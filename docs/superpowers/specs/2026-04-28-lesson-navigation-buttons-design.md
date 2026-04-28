# Lesson Navigation Buttons — Design

**Date:** 2026-04-28
**Scope:** Add Previous / Next lesson navigation to the lesson player page.

## Goal

On the lesson page (`/courses/[courseId]/[lessonId]`), add a navigation bar below the video player that lets the user jump to the previous or next lesson in the course.

## User-facing behavior

- A horizontal bar appears below the player and above the lesson title.
- Each button shows a chevron icon, the lesson's display number (e.g. `2.1`), and the lesson title.
  - Previous: `← 2.1 · Pasos básicos`
  - Next: `2.3 · Vuelta sencilla →`
- The bar uses `justify-content: space-between` so the previous button sits on the left and the next button on the right.
- If there is no previous (or no next) accessible lesson, that button is **hidden** (not disabled). The remaining button stays in its natural side.
- On mobile (≤ 600px), the lesson title is hidden — only the chevron + label ("Anterior" / "Siguiente") + display number are shown, to keep buttons from wrapping.

## Ordering

The navigation order is the same one used by the sidebar: the `lessonTree` produced by `buildLessonTree()` in `LessonView.tsx`. This is a flattened list of top-level lessons followed by their direct children, sorted by `order`. Sublessons appear immediately after their parent.

## Skip-locked-lessons rule

A lesson is **accessible** to the current viewer if any of these holds:

- `isAdmin === true`
- `hasAccess === true` (course-level access via subscription or one-time purchase)
- `lesson.is_free === true`

`prevLesson` is the closest accessible lesson **before** the current one in `lessonTree`. `nextLesson` is the closest accessible lesson **after** the current one. If no accessible lesson exists in a direction, the corresponding button is omitted.

Rationale: free lessons act as a sample for non-paying users; paid lessons should not appear in the prev/next flow for them, since they would only land on the locked-content screen.

## Out of scope (YAGNI)

- Auto-advance when the video ends. The current `onEnded` handler in `LessonPlayer.tsx` (mark completed + refresh) is unchanged.
- Keyboard shortcuts.
- Page transitions / animations between lessons.
- Sidebar changes — it already lists every lesson.

## Implementation outline

### 1. Server data: include `is_free` per lesson

File: `app/courses/[courseId]/[lessonId]/page.tsx`

Extend the existing `allLessons` query to also select `is_free`:

```ts
supabase.from('lessons')
  .select('id, title, order, parent_lesson_id, is_free')
  .eq('course_id', params.courseId)
  .order('order', { ascending: true })
```

No other server-side changes. `hasAccess` and `isAdmin` are already passed to `LessonView`.

### 2. Pure helper for prev/next computation

File: `utils/lesson-navigation.ts` (new)

A pure function so the logic is testable in isolation:

```ts
export type NavLesson = {
  id: string;
  title: string;
  displayNumber: string;
  is_free: boolean;
};

export function findAdjacentAccessibleLessons(
  lessonTree: NavLesson[],
  currentLessonId: string,
  hasFullAccess: boolean // isAdmin || hasAccess
): { prev: NavLesson | null; next: NavLesson | null }
```

Logic:
- Find the index of the current lesson.
- Walk backwards and forwards through the tree, returning the first lesson where `hasFullAccess || lesson.is_free`.
- Return `{ prev: null, next: null }` if the current lesson is not in the tree.

### 3. Wire prev/next in `LessonView.tsx`

File: `components/LessonView.tsx`

- Extend `LessonItem` type with `is_free: boolean`.
- Extend `LessonNode` accordingly (it already spreads `LessonItem`).
- After building `lessonTree`, call `findAdjacentAccessibleLessons(lessonTree, lessonId, isAdmin || hasAccess)`.
- Render `<LessonNavigation>` between the `videoWrapper` Reveal and the `lessonInfo` Reveal, only when at least one of `prev` / `next` exists.

### 4. New component: `LessonNavigation`

File: `components/LessonNavigation.tsx` (new)

Stateless client component. Props:

```ts
type Props = {
  courseId: string;
  prev: { id: string; title: string; displayNumber: string } | null;
  next: { id: string; title: string; displayNumber: string } | null;
};
```

- Renders a `<nav>` with two optional `<Link>` children.
- Uses `ChevronLeft` / `ChevronRight` from `lucide-react` (already in deps — see `LessonView.tsx`).
- Reads labels via `useLanguage()` → `t.lesson.previousLesson`, `t.lesson.nextLesson`.
- Each link's `aria-label` includes the full destination ("Lección anterior: Pasos básicos") for screen readers.

### 5. Styles: `LessonNavigation.module.css` (new)

- Container: flex row, `justify-content: space-between`, gap 12px, margin-block, padding-block.
- Buttons: subtle border (`var(--border)` or similar token already used), border-radius matching player wrapper, hover state with slight `translateY(-1px)` and stronger border, consistent with the cinematic player aesthetic.
- Title text uses `text-overflow: ellipsis` with `max-width` so long titles don't wrap.
- `@media (max-width: 600px)`: hide the title span, keep label + display number.

### 6. Translations

File: `utils/dictionaries.ts`

Add to the `lesson` section, in all six locales:

| key              | es         | en        | fr         | de        | it          | ja  |
| ---------------- | ---------- | --------- | ---------- | --------- | ----------- | --- |
| `previousLesson` | Anterior   | Previous  | Précédent  | Vorherige | Precedente  | 前へ |
| `nextLesson`     | Siguiente  | Next      | Suivant    | Nächste   | Successivo  | 次へ |

## Testing

Two unit tests with Vitest:

1. **`__tests__/utils/lesson-navigation.test.ts`** — pure function tests for `findAdjacentAccessibleLessons`:
   - Middle lesson, full access → returns immediate neighbors.
   - First lesson, full access → `prev: null`, `next` is lesson at index 1.
   - Last lesson, full access → `next: null`, `prev` is the previous lesson.
   - No full access, mixed `is_free` → skips paid lessons in both directions.
   - No full access and no other free lessons → both `null`.
   - Lesson id not in tree → both `null`.

2. **`__tests__/components/LessonNavigation.test.tsx`** — component test (jsdom):
   - Both `prev` and `next` provided → renders both links with correct hrefs and visible display numbers / titles.
   - Only `next` provided → renders only the next link, no prev link in the DOM.
   - Only `prev` provided → renders only the prev link, no next link in the DOM.

   When neither is provided, `LessonView` does not render `LessonNavigation` at all (parent guard). The component itself does not need to handle that case.

No e2e test added; the existing `e2e/admin.spec.ts` flows are not affected.

## Risks and notes

- **Title length**: lesson titles can be long. The CSS `text-overflow: ellipsis` + `max-width` keeps the bar single-line.
- **Course size**: the lesson list query is unchanged in shape; adding `is_free` is one extra column with no extra round trip.
- **Accessibility**: links are real `<Link>` elements (not buttons), keyboard-navigable by default. `aria-label` covers screen readers.
- **i18n**: the six new strings follow the existing `t.lesson.*` pattern in `dictionaries.ts`.
