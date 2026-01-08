import Image from 'next/image'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from './courses.module.css'

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    console.error('Error fetching courses:', error)
  }

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const { data: { user } } = await supabase.auth.getUser()
  let profile = null

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cursos Disponibles</h1>
        {profile?.role === 'admin' && (
          <Link href="/courses/create" className={styles.createButton}>
            + Crear Curso
          </Link>
        )}
      </div>
      
      {!courses || courses.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No hay cursos publicados en este momento.</p>
          <p className={styles.subtext}>¡Vuelve pronto para ver las nuevas clases de Luis y Sara!</p>
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
                    <span>{months[course.month - 1]} {course.year}</span>
                  </div>
                )}
              </div>
              <div className={styles.content}>
                <h2 className={styles.courseTitle}>{course.title}</h2>
                <p className={styles.courseDate}>{months[course.month - 1]} {course.year}</p>
                <p className={styles.description}>{course.description}</p>
                <span className={styles.cta}>Ver Clases &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
