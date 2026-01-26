'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from '@/app/courses/courses.module.css';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  courses: any[];
  isAdmin: boolean;
};

export default function CoursesClient({ courses, isAdmin }: Props) {
  const { t } = useLanguage();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.coursesPage.title}</h1>
        {isAdmin && (
          <Link href="/courses/create" className={styles.createButton}>
            {t.coursesPage.create}
          </Link>
        )}
      </div>
      
      {!courses || courses.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t.coursesPage.empty}</p>
          <p className={styles.subtext}>{t.coursesPage.emptySub}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {courses.map((course) => (
            <Link href={`/courses/${course.id}`} key={course.id} className={styles.card}>
              <div className={styles.imageContainer}>
                {course.image_url ? (
                  <Image 
                    src={course.image_url} 
                    alt={course.title} 
                    className={styles.image} 
                    width={400} 
                    height={225} 
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className={styles.placeholderImage}>
                    <span>{t.coursesPage.months[course.month - 1]} {course.year}</span>
                  </div>
                )}
              </div>
              <div className={styles.content}>
                <h2 className={styles.courseTitle}>{course.title}</h2>
                <p className={styles.courseDate}>{t.coursesPage.months[course.month - 1]} {course.year}</p>
                <p className={styles.description}>{course.description}</p>
                <span className={styles.cta}>{t.coursesPage.view} &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
