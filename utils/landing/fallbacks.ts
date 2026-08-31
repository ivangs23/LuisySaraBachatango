/**
 * Valores de código. Se usan cuando la base de datos no responde o no tiene
 * filas: la landing pierde la edición, nunca el contenido.
 *
 * En español a propósito: es el idioma obligatorio del modelo, y este camino
 * solo se recorre cuando algo va mal.
 */
export const FALLBACK_STATS = {
  years: '25',
  students: '500',
  countries: '30',
  titles: '100',
} as const

export const FALLBACK_TESTIMONIALS = [
  {
    id: 'fallback-1',
    name: 'Elena M.',
    stars: 5,
    quote:
      'Nunca creí que pudiera aprender a conectar así con mi pareja a través de una pantalla. La metodología de Luis y Sara es impecable.',
  },
  {
    id: 'fallback-2',
    name: 'Carlos R.',
    stars: 5,
    quote:
      'Llevo años bailando bachata, pero el bachatango ha sido un descubrimiento. La elegancia que transmiten en cada clase es inspiradora.',
  },
  {
    id: 'fallback-3',
    name: 'Sofía y Marc',
    stars: 5,
    quote:
      'Perfecto para practicar en casa. Los detalles técnicos marcan la diferencia. 100% recomendado.',
  },
]

export const FALLBACK_FAQ = [
  {
    id: 'fallback-q1',
    question: '¿Necesito tener experiencia previa en baile?',
    answer:
      'No hace falta. El curso empieza desde cero y avanza paso a paso. Si ya bailas bachata o tango partirás con ventaja, pero no es un requisito: lo único que damos por hecho es que quieres aprender.',
  },
  {
    id: 'fallback-q2',
    question: '¿Cómo accedo a los cursos?',
    answer:
      'Una vez compras un curso, tienes acceso inmediato a todo el contenido del curso a través de la plataforma. Puedes ver las clases tantas veces como quieras.',
  },
  {
    id: 'fallback-q3',
    question: '¿Sirve si no tengo pareja de baile?',
    answer:
      'Absolutamente. Aunque el Bachatango es un baile de pareja, muchas lecciones se enfocan en técnica individual, musicalidad y estilo que puedes practicar solo/a.',
  },
]
