import styles from './pricing.module.css'

const PLANS = [
  {
    id: '1month',
    name: '1 Mes',
    price: '19',
    description: 'Acceso al curso del mes actual (4 clases).',
    features: [
      '4 clases del mes en curso',
      'Acceso a comentarios y comunidad',
      'Tareas y correcciones del profesor',
    ],
  },
  {
    id: '6months',
    name: '6 Meses',
    price: '99',
    description: 'Acceso a 6 meses de cursos.',
    features: [
      '4 clases × 6 meses',
      'Ahorra un 13% respecto al mes a mes',
      'Acceso a comentarios y comunidad',
      'Tareas y correcciones del profesor',
    ],
    highlighted: true,
  },
  {
    id: '1year',
    name: '1 Año',
    price: '179',
    description: 'Acceso completo a 12 meses de cursos.',
    features: [
      '4 clases × 12 meses',
      'Ahorra un 21% respecto al mes a mes',
      'Acceso a comentarios y comunidad',
      'Tareas y correcciones del profesor',
    ],
  },
]

export default function PricingPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Suscripciones</h1>
        <p className={styles.subtitle}>
          Accede a los cursos de bachata de Luis y Sara con una suscripción mensual.
          Cada mes incluye 4 clases nuevas.
        </p>
        <div className={styles.comingSoonBadge}>Próximamente</div>
      </div>

      <div className={styles.grid}>
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`${styles.card} ${plan.highlighted ? styles.highlighted : ''}`}
          >
            {plan.highlighted && (
              <div className={styles.popularBadge}>Más popular</div>
            )}
            <h2 className={styles.planName}>{plan.name}</h2>
            <div className={styles.priceRow}>
              <span className={styles.currency}>€</span>
              <span className={styles.price}>{plan.price}</span>
              {plan.id === '1month' && <span className={styles.period}>/mes</span>}
            </div>
            <p className={styles.planDescription}>{plan.description}</p>
            <ul className={styles.featureList}>
              {plan.features.map((f) => (
                <li key={f} className={styles.feature}>
                  <span className={styles.checkmark}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button disabled className={styles.ctaButton}>
              Próximamente
            </button>
          </div>
        ))}
      </div>

      <p className={styles.note}>
        ¿Quieres acceder a un mes anterior? Puedes comprarlo individualmente desde la página del curso.
      </p>
    </div>
  )
}
