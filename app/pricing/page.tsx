import type { Metadata } from 'next';
import styles from './pricing.module.css'
import { getDict } from '@/utils/get-dict'

export const metadata: Metadata = {
  title: "Precios y Suscripción",
  description: "Planes de suscripción para acceder a los cursos de Luis y Sara Bachatango. Desde 19€/mes. Acceso a 4 clases mensuales, comunidad y correcciones del profesor.",
  openGraph: {
    title: "Precios | Luis y Sara Bachatango",
    description: "Suscríbete desde 19€/mes. Acceso a 4 clases mensuales, comunidad y correcciones personalizadas.",
    url: "/pricing",
  },
  alternates: { canonical: "/pricing" },
};

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

export default async function PricingPage() {
  const t = await getDict();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.pricing.title}</h1>
        <p className={styles.subtitle}>{t.pricing.subtitle}</p>
        <div className={styles.comingSoonBadge}>{t.pricing.comingSoon}</div>
      </div>

      <div className={styles.grid}>
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`${styles.card} ${plan.highlighted ? styles.highlighted : ''}`}
          >
            {plan.highlighted && (
              <div className={styles.popularBadge}>{t.pricing.mostPopular}</div>
            )}
            <h2 className={styles.planName}>{plan.name}</h2>
            <div className={styles.priceRow}>
              <span className={styles.currency}>€</span>
              <span className={styles.price}>{plan.price}</span>
              {plan.id === '1month' && <span className={styles.period}>{t.pricing.perMonth}</span>}
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
              {t.pricing.comingSoon}
            </button>
          </div>
        ))}
      </div>

      <p className={styles.note}>{t.pricing.note}</p>
    </div>
  )
}
