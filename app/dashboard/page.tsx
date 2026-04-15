import NextClassPopup from '@/components/NextClassPopup';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login')
  }

  // TODO: Replace mock data with real DB queries based on user subscription and progress
  const activeMonth = "Noviembre";
  const progress = 50;
  
  const lessons = [
    { id: 1, title: "Semana 1: Básicos", locked: false, image: "/hero-bg.png" }, // Using hero as placeholder
    { id: 2, title: "Semana 2: Giros", locked: false, image: "/hero-bg.png" },
    { id: 3, title: "Semana 3: Musicalidad", locked: true, date: "22 Nov" },
    { id: 4, title: "Semana 4: Coreografía", locked: true, date: "29 Nov" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mis Cursos</h1>
      </div>

      <section className={styles.activeMonth}>
        <h2 className={styles.monthTitle}>Tu Mes Activo: {activeMonth}</h2>
        
        <div className={styles.progressContainer}>
          <div className={styles.progressLabel}>
            <span>Progreso</span>
            <span>{progress}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className={styles.grid}>
          {lessons.map((lesson) => (
            <div key={lesson.id} className={styles.card}>
              <div className={styles.thumbnailContainer}>
                {/* In real app, use Image component with actual thumbnails */}
                <div className={styles.overlay}>
                  {lesson.locked ? (
                    <span className={styles.lockIcon}>🔒</span>
                  ) : (
                    <span className={styles.playIcon}>▶</span>
                  )}
                </div>
              </div>
              
              <div className={styles.cardContent}>
                {lesson.locked ? (
                  <>
                    <span className={styles.lockedText}>Disponible: {lesson.date}</span>
                  </>
                ) : (
                  <Link href={`/courses/demo/${lesson.id}`} className={styles.cardButton}>
                    VER CLASE
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Meses Anteriores</h2>
        <div className={styles.grid}>
          {/* Placeholders for previous months */}
          <div className={`${styles.card} ${styles.folder}`}>
            <div className={styles.cardContent}>
              <h3>Octubre</h3>
              <span className={styles.lockIcon} style={{fontSize: '1.5rem'}}>🔒</span>
            </div>
          </div>
          <div className={`${styles.card} ${styles.folder}`}>
            <div className={styles.cardContent}>
              <h3>Septiembre</h3>
              <span className={styles.lockIcon} style={{fontSize: '1.5rem'}}>🔒</span>
            </div>
          </div>
        </div>
      </section>

      <NextClassPopup />
    </div>
  );
}
