import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>
            Domina el Arte<br />
            del Bachatango
          </h1>
          <p className={styles.subtitle}>
            Aprende con los mejores instructores, Luis y Sara. 
            Cursos exclusivos, técnica refinada y pasión en cada paso.
          </p>
          <Link href="/courses" className={styles.ctaButton}>
            SUSCRÍBETE AL CURSO DE NOVIEMBRE
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.icon}>📅</div>
          <h3>4 Clases Mensuales</h3>
          <p>Contenido estructurado para tu progreso constante.</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.icon}>🔒</div>
          <h3>Contenido Exclusivo</h3>
          <p>Acceso único a técnicas avanzadas y secretos de baile.</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.icon}>▶</div>
          <h3>Acceso 24/7</h3>
          <p>Practica a tu ritmo, donde y cuando quieras.</p>
        </div>
      </section>
    </div>
  );
}
