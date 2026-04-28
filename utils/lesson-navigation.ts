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
