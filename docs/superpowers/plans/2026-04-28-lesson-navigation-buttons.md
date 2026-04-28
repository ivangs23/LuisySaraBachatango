# Lesson Navigation Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Previous / Next lesson navigation bar below the video player on the lesson page that skips lessons the viewer cannot access.

**Architecture:** Extract a pure helper that, given the flattened lesson tree, the current lesson id, and a "full access" boolean, returns the previous and next accessible lessons. `LessonView` calls this helper, then renders a new stateless `LessonNavigation` client component between the player and the lesson title. The lesson page query is extended to include `is_free` so the helper can decide accessibility.

**Tech Stack:** Next.js 16 (App Router, Server Components), React + TypeScript, CSS Modules, Vitest (unit + jsdom for components), `lucide-react` for icons, existing `useLanguage()` hook for i18n.

**Spec:** `docs/superpowers/specs/2026-04-28-lesson-navigation-buttons-design.md`

---

## File Structure

**Create:**
- `utils/lesson-navigation.ts` — pure helper `findAdjacentAccessibleLessons` and exported `NavLesson` type.
- `components/LessonNavigation.tsx` — stateless client component that renders the prev/next bar.
- `components/LessonNavigation.module.css` — styles for the bar and its buttons.
- `__tests__/utils/lesson-navigation.test.ts` — unit tests for the pure helper.
- `__tests__/components/lesson-navigation.test.tsx` — jsdom tests for the component.

**Modify:**
- `app/courses/[courseId]/[lessonId]/page.tsx` — include `is_free` in the `allLessons` select.
- `components/LessonView.tsx` — extend `LessonItem`/`LessonNode` types, compute prev/next, render `LessonNavigation`.
- `utils/dictionaries.ts` — add `previousLesson` and `nextLesson` entries to the `lesson` block in all six locales.

---

## Task 1: Pure helper `findAdjacentAccessibleLessons`

**Files:**
- Create: `utils/lesson-navigation.ts`
- Test: `__tests__/utils/lesson-navigation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/utils/lesson-navigation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findAdjacentAccessibleLessons, type NavLesson } from '@/utils/lesson-navigation'

const tree: NavLesson[] = [
  { id: 'a', title: 'A', displayNumber: '1',   is_free: true  },
  { id: 'b', title: 'B', displayNumber: '2',   is_free: false },
  { id: 'c', title: 'C', displayNumber: '2.1', is_free: false },
  { id: 'd', title: 'D', displayNumber: '2.2', is_free: true  },
  { id: 'e', title: 'E', displayNumber: '3',   is_free: false },
]

describe('findAdjacentAccessibleLessons', () => {
  it('returns immediate neighbors when viewer has full access', () => {
    const { prev, next } = findAdjacentAccessibleLessons(tree, 'c', true)
    expect(prev?.id).toBe('b')
    expect(next?.id).toBe('d')
  })

  it('returns null prev for the first lesson when viewer has full access', () => {
    const { prev, next } = findAdjacentAccessibleLessons(tree, 'a', true)
    expect(prev).toBeNull()
    expect(next?.id).toBe('b')
  })

  it('returns null next for the last lesson when viewer has full access', () => {
    const { prev, next } = findAdjacentAccessibleLessons(tree, 'e', true)
    expect(prev?.id).toBe('d')
    expect(next).toBeNull()
  })

  it('skips paid lessons in both directions when viewer has no full access', () => {
    // From the free lesson "d", prev should skip "c" and "b" (paid) and land on "a" (free).
    // Next should skip "e" (paid) and return null.
    const { prev, next } = findAdjacentAccessibleLessons(tree, 'd', false)
    expect(prev?.id).toBe('a')
    expect(next).toBeNull()
  })

  it('returns null on both sides when no other accessible lesson exists', () => {
    const onlyPaid: NavLesson[] = [
      { id: 'x', title: 'X', displayNumber: '1', is_free: false },
      { id: 'y', title: 'Y', displayNumber: '2', is_free: true  },
      { id: 'z', title: 'Z', displayNumber: '3', is_free: false },
    ]
    const { prev, next } = findAdjacentAccessibleLessons(onlyPaid, 'y', false)
    expect(prev).toBeNull()
    expect(next).toBeNull()
  })

  it('returns null on both sides when current lesson id is not in the tree', () => {
    const { prev, next } = findAdjacentAccessibleLessons(tree, 'missing', true)
    expect(prev).toBeNull()
    expect(next).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run __tests__/utils/lesson-navigation.test.ts`
Expected: FAIL — module `@/utils/lesson-navigation` not found.

- [ ] **Step 3: Implement the helper**

Create `utils/lesson-navigation.ts`:

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
  hasFullAccess: boolean,
): { prev: NavLesson | null; next: NavLesson | null } {
  const index = lessonTree.findIndex(l => l.id === currentLessonId);
  if (index === -1) return { prev: null, next: null };

  const isAccessible = (l: NavLesson) => hasFullAccess || l.is_free;

  let prev: NavLesson | null = null;
  for (let i = index - 1; i >= 0; i--) {
    if (isAccessible(lessonTree[i])) {
      prev = lessonTree[i];
      break;
    }
  }

  let next: NavLesson | null = null;
  for (let i = index + 1; i < lessonTree.length; i++) {
    if (isAccessible(lessonTree[i])) {
      next = lessonTree[i];
      break;
    }
  }

  return { prev, next };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run __tests__/utils/lesson-navigation.test.ts`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add utils/lesson-navigation.ts __tests__/utils/lesson-navigation.test.ts
git commit -m "feat(lessons): add findAdjacentAccessibleLessons helper"
```

---

## Task 2: Add `previousLesson` / `nextLesson` translations

**Files:**
- Modify: `utils/dictionaries.ts` (six `lesson` blocks at lines 178, 468, 688, 908, 1127, 1347)

- [ ] **Step 1: Add Spanish entries**

In the `es` block, locate the `lesson:` object (around line 178) and append after `assignmentViewSubmissions`:

```ts
      assignmentViewSubmissions: "Ver todas las entregas",
      previousLesson: "Anterior",
      nextLesson: "Siguiente"
```

(Replace the existing trailing line `assignmentViewSubmissions: "Ver todas las entregas"` with the version that has a comma plus the two new keys.)

- [ ] **Step 2: Add English entries**

In the `en` block (around line 468), do the same with:

```ts
      previousLesson: "Previous",
      nextLesson: "Next"
```

- [ ] **Step 3: Add French entries**

In the `fr` block (around line 688):

```ts
      previousLesson: "Précédent",
      nextLesson: "Suivant"
```

- [ ] **Step 4: Add German entries**

In the `de` block (around line 908):

```ts
      previousLesson: "Vorherige",
      nextLesson: "Nächste"
```

- [ ] **Step 5: Add Italian entries**

In the `it` block (around line 1127):

```ts
      previousLesson: "Precedente",
      nextLesson: "Successivo"
```

- [ ] **Step 6: Add Japanese entries**

In the `ja` block (around line 1347):

```ts
      previousLesson: "前へ",
      nextLesson: "次へ"
```

- [ ] **Step 7: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (`dictionaries.es` is the source of the typed shape used by `useLanguage().t`, and all six locales must have the same keys for type compatibility through structural matching with `dictionaries['es']`.)

- [ ] **Step 8: Commit**

```bash
git add utils/dictionaries.ts
git commit -m "i18n(lessons): add previousLesson/nextLesson keys for all locales"
```

---

## Task 3: `LessonNavigation` component

**Files:**
- Create: `components/LessonNavigation.tsx`
- Create: `components/LessonNavigation.module.css`
- Test: `__tests__/components/lesson-navigation.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/lesson-navigation.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'es',
    setLocale: () => {},
    t: { lesson: { previousLesson: 'Anterior', nextLesson: 'Siguiente' } },
  }),
}))

import LessonNavigation from '@/components/LessonNavigation'

const prev = { id: 'lesson-a', title: 'Pasos básicos', displayNumber: '2.1' }
const next = { id: 'lesson-b', title: 'Vuelta sencilla', displayNumber: '2.3' }

describe('LessonNavigation', () => {
  it('renders both prev and next links with correct hrefs and titles', () => {
    render(<LessonNavigation courseId="course-1" prev={prev} next={next} />)
    const prevLink = screen.getByRole('link', { name: /anterior/i })
    const nextLink = screen.getByRole('link', { name: /siguiente/i })
    expect(prevLink).toHaveAttribute('href', '/courses/course-1/lesson-a')
    expect(nextLink).toHaveAttribute('href', '/courses/course-1/lesson-b')
    expect(screen.getByText('Pasos básicos')).toBeInTheDocument()
    expect(screen.getByText('Vuelta sencilla')).toBeInTheDocument()
    expect(screen.getByText('2.1')).toBeInTheDocument()
    expect(screen.getByText('2.3')).toBeInTheDocument()
  })

  it('renders only the next link when prev is null', () => {
    render(<LessonNavigation courseId="course-1" prev={null} next={next} />)
    expect(screen.queryByRole('link', { name: /anterior/i })).toBeNull()
    expect(screen.getByRole('link', { name: /siguiente/i })).toHaveAttribute(
      'href',
      '/courses/course-1/lesson-b',
    )
  })

  it('renders only the prev link when next is null', () => {
    render(<LessonNavigation courseId="course-1" prev={prev} next={null} />)
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull()
    expect(screen.getByRole('link', { name: /anterior/i })).toHaveAttribute(
      'href',
      '/courses/course-1/lesson-a',
    )
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run __tests__/components/lesson-navigation.test.tsx`
Expected: FAIL — `@/components/LessonNavigation` not found.

- [ ] **Step 3: Create the CSS module**

Create `components/LessonNavigation.module.css`:

```css
.bar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 0;
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 48%;
  padding: 10px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(var(--primary-rgb), 0.04);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.button:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--primary-rgb), 0.45);
  background: rgba(var(--primary-rgb), 0.1);
}

.button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.next {
  margin-left: auto;
}

.icon {
  flex-shrink: 0;
  color: var(--primary);
}

.label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.next .label {
  align-items: flex-end;
  text-align: right;
}

.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.titleRow {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  max-width: 100%;
}

.number {
  color: var(--primary);
  font-weight: 600;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 22ch;
}

@media (max-width: 600px) {
  .title {
    display: none;
  }
}
```

- [ ] **Step 4: Implement the component**

Create `components/LessonNavigation.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './LessonNavigation.module.css';

type NavTarget = {
  id: string;
  title: string;
  displayNumber: string;
};

type Props = {
  courseId: string;
  prev: NavTarget | null;
  next: NavTarget | null;
};

export default function LessonNavigation({ courseId, prev, next }: Props) {
  const { t } = useLanguage();

  if (!prev && !next) return null;

  return (
    <nav className={styles.bar} aria-label="Navegación entre lecciones">
      {prev && (
        <Link
          href={`/courses/${courseId}/${prev.id}`}
          className={styles.button}
          aria-label={`${t.lesson.previousLesson}: ${prev.displayNumber} ${prev.title}`}
        >
          <ChevronLeft size={20} strokeWidth={2.2} className={styles.icon} aria-hidden="true" />
          <span className={styles.label}>
            <span className={styles.eyebrow}>{t.lesson.previousLesson}</span>
            <span className={styles.titleRow}>
              <span className={styles.number}>{prev.displayNumber}</span>
              <span className={styles.title}>{prev.title}</span>
            </span>
          </span>
        </Link>
      )}

      {next && (
        <Link
          href={`/courses/${courseId}/${next.id}`}
          className={`${styles.button} ${styles.next}`}
          aria-label={`${t.lesson.nextLesson}: ${next.displayNumber} ${next.title}`}
        >
          <span className={styles.label}>
            <span className={styles.eyebrow}>{t.lesson.nextLesson}</span>
            <span className={styles.titleRow}>
              <span className={styles.number}>{next.displayNumber}</span>
              <span className={styles.title}>{next.title}</span>
            </span>
          </span>
          <ChevronRight size={20} strokeWidth={2.2} className={styles.icon} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run __tests__/components/lesson-navigation.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add components/LessonNavigation.tsx components/LessonNavigation.module.css __tests__/components/lesson-navigation.test.tsx
git commit -m "feat(lessons): add LessonNavigation component"
```

---

## Task 4: Wire the bar into `LessonView` and load `is_free` from the page

**Files:**
- Modify: `app/courses/[courseId]/[lessonId]/page.tsx` (lines 58-61)
- Modify: `components/LessonView.tsx`

- [ ] **Step 1: Extend the lesson page query to select `is_free`**

In `app/courses/[courseId]/[lessonId]/page.tsx`, find the `allLessons` query inside `Promise.all`:

```ts
    supabase.from('lessons')
      .select('id, title, order, parent_lesson_id')
      .eq('course_id', params.courseId)
      .order('order', { ascending: true }),
```

Replace with:

```ts
    supabase.from('lessons')
      .select('id, title, order, parent_lesson_id, is_free')
      .eq('course_id', params.courseId)
      .order('order', { ascending: true }),
```

No other changes to this file. `LessonView` already receives `allLessons` as-is and `hasAccess`/`isAdmin` are already wired.

- [ ] **Step 2: Update the `LessonItem` type in `LessonView.tsx`**

Open `components/LessonView.tsx`. Change the `LessonItem` type definition (top of file, around line 12):

From:

```ts
type LessonItem = {
  id: string;
  title: string;
  order: number;
  parent_lesson_id?: string | null;
};
```

To:

```ts
type LessonItem = {
  id: string;
  title: string;
  order: number;
  parent_lesson_id?: string | null;
  is_free: boolean;
};
```

- [ ] **Step 3: Import the helper and component**

Below the existing imports in `components/LessonView.tsx`, add:

```ts
import LessonNavigation from '@/components/LessonNavigation';
import { findAdjacentAccessibleLessons } from '@/utils/lesson-navigation';
```

- [ ] **Step 4: Compute prev/next adjacent accessible lessons inside the component**

In `components/LessonView.tsx`, just after the existing line:

```ts
  const lessonTree = buildLessonTree(allLessons);
```

Add:

```ts
  const { prev: prevLesson, next: nextLesson } = findAdjacentAccessibleLessons(
    lessonTree,
    lessonId,
    isAdmin || hasAccess,
  );
```

- [ ] **Step 5: Render `LessonNavigation` between the player and the lesson info**

In `components/LessonView.tsx`, locate the closing `</Reveal>` of the `videoWrapper` block (currently followed by the `{/* Lesson info */}` comment). Insert the navigation between them:

Find this region:

```tsx
            </div>
          </Reveal>

          {/* Lesson info */}
          <Reveal delay={0.08}>
```

Replace with:

```tsx
            </div>
          </Reveal>

          <LessonNavigation
            courseId={courseId}
            prev={prevLesson ? { id: prevLesson.id, title: prevLesson.title, displayNumber: prevLesson.displayNumber } : null}
            next={nextLesson ? { id: nextLesson.id, title: nextLesson.title, displayNumber: nextLesson.displayNumber } : null}
          />

          {/* Lesson info */}
          <Reveal delay={0.08}>
```

Note: `prevLesson` / `nextLesson` returned by the helper are `NavLesson` objects (`{ id, title, displayNumber, is_free }`); we strip `is_free` to match the component's `NavTarget` prop shape.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS — including the new `lesson-navigation` unit tests, the new `LessonNavigation` component tests, and all pre-existing tests.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. The `is_free` column now flows from the Supabase select into `LessonItem` and through to the helper.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no new errors or warnings introduced.

- [ ] **Step 9: Manual smoke check (optional but recommended)**

Run `npm run dev`, log in, and visit a lesson page in an existing course. Verify:
- Both buttons appear with the right adjacent lesson titles.
- On the first lesson: only the Next button is visible.
- On the last lesson: only the Previous button is visible.
- Logging out of a paid course (or using a non-premium account) on a free lesson skips the paid lessons in both directions.
- On mobile width (≤ 600px), the title hides and only "Anterior 2.1" / "Siguiente 2.3" style stays visible.

- [ ] **Step 10: Commit**

```bash
git add app/courses/[courseId]/[lessonId]/page.tsx components/LessonView.tsx
git commit -m "feat(lessons): show prev/next navigation under the player"
```

---

## Self-Review Checklist (already completed by plan author)

- **Spec coverage**: every section of the spec maps to a task — the helper (Task 1), translations (Task 2), the component + styles (Task 3), the wiring + page query change (Task 4). Tests for both the helper and the component are included.
- **No placeholders**: all steps contain runnable code or exact commands; no "TBD"/"add error handling here" instructions.
- **Type consistency**: `NavLesson` (helper) and `NavTarget` (component prop) are intentionally different — `NavTarget` excludes `is_free` because the rendering layer does not need it. The mapping in Task 4 Step 5 strips that field explicitly. `findAdjacentAccessibleLessons` is named identically wherever it appears.
