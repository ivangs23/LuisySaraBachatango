import type { LandingCopy } from '../copy';
import { formatDuration, type Curriculum } from '@/utils/courses/curriculum';
import styles from '../page.module.css';

/**
 * Temario real del curso. Sustituye a seis viñetas genéricas que valdrían para
 * cualquier curso de baile: los nombres de los módulos prueban que el curso
 * existe y enseñan la progresión de golpe.
 *
 * Componente de servidor: no hay interactividad, así que no viaja al cliente.
 */
export default function CourseCurriculum({ curriculum, copy }: { curriculum: Curriculum; copy: LandingCopy }) {
  const c = copy.learn;

  const summary = c.summary
    .replace('{modules}', String(curriculum.moduleCount))
    .replace('{lessons}', String(curriculum.lessonCount))
    .replace('{duration}', formatDuration(curriculum.totalSeconds));

  return (
    <section className={styles.section} aria-labelledby="curriculum-title">
      <h2 id="curriculum-title" className={styles.h2}>{c.title}</h2>
      <p className={styles.lead}>{c.subtitle}</p>
      <p className={styles.curriculumSummary}>{summary}</p>

      <ol className={styles.curriculumList}>
        {curriculum.modules.map((m) => {
          const dur = formatDuration(m.totalSeconds);
          return (
            <li key={m.id} className={styles.curriculumModule}>
              <div className={styles.curriculumHead}>
                <span className={styles.curriculumNum} aria-hidden="true">
                  {String(m.order).padStart(2, '0')}
                </span>
                <h3 className={styles.curriculumTitle}>{m.title}</h3>
                {dur && <span className={styles.curriculumDuration}>{dur}</span>}
              </div>

              {m.lessons.length > 0 && (
                <ul className={styles.curriculumLessons}>
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <span className={styles.curriculumBullet} aria-hidden="true">·</span>
                      {l.title}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
