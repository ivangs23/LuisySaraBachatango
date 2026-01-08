import styles from './Features.module.css';

export default function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
              <path d="M8 14h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M16 14h.01"></path>
              <path d="M8 18h.01"></path>
              <path d="M12 18h.01"></path>
              <path d="M16 18h.01"></path>
            </svg>
          </div>
          <h3 className={styles.title}>4 Clases Mensuales</h3>
          <p className={styles.description}>
            Contenido estructurado y progresivo. Cada mes desbloqueas un nuevo módulo diseñado para elevar tu nivel paso a paso.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 className={styles.title}>Contenido Exclusivo</h3>
          <p className={styles.description}>
            Accede a secretos de técnica, musicalidad y conexión que no encontrarás en ningún otro lugar. Masterclasses de expertos.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <h3 className={styles.title}>Acceso 24/7</h3>
          <p className={styles.description}>
            Tu plataforma de aprendizaje siempre disponible. Practica a tu ritmo, repite las lecciones y perfecciona tu estilo desde casa.
          </p>
        </div>
      </div>
    </section>
  );
}
