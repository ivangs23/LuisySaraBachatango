import { formatDuration, type Curriculum } from '@/utils/courses/curriculum';

const MARCADOR = /\{(?:modules|lessons|duration)\}/;

/**
 * Rellena `{modules}`, `{lessons}` y `{duration}` de un texto de copy.ts con
 * el temario real del curso, el mismo que pinta la sección «Qué vas a
 * aprender». Así las cifras de la FAQ y de la oferta no envejecen cuando se
 * añade una lección.
 *
 * Devuelve null si el texto necesita el temario y no lo hay (BD caída, o un
 * curso sin duración): quien llama decide si quita el texto o pone uno sin
 * cifras. Lo que nunca sale es un marcador sin sustituir.
 */
export function fillCurriculum(template: string, curriculum: Curriculum | null): string | null {
  if (!MARCADOR.test(template)) return template;
  if (!curriculum) return null;

  const duration = formatDuration(curriculum.totalSeconds);
  if (template.includes('{duration}') && !duration) return null;

  return template
    .replace(/\{modules\}/g, String(curriculum.moduleCount))
    .replace(/\{lessons\}/g, String(curriculum.lessonCount))
    .replace(/\{duration\}/g, duration);
}
