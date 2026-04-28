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
