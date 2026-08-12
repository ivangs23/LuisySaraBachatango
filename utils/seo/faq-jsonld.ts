/**
 * Construye el JSON-LD de tipo FAQPage a partir de las preguntas ya visibles
 * en la página. Google exige que el marcado refleje contenido realmente
 * visible: por eso se alimenta del mismo diccionario que renderiza el FAQ,
 * nunca de una lista aparte que pudiera divergir.
 *
 * Las entradas incompletas se descartan: un `Question` sin `acceptedAnswer`
 * invalida el bloque entero en Search Console.
 */
export function buildFaqJsonLd(faqs: Array<{ q: string; a: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
      .filter((f) => f.q.trim().length > 0 && f.a.trim().length > 0)
      .map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
  }
}
