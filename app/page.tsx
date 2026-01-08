import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import Features from "@/components/Features";

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
      <Features />
    </div>
  );
}
