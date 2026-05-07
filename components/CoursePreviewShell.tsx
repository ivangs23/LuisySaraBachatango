import Image from 'next/image'
import Link from 'next/link'

type Props = {
  course: {
    id: string
    title: string
    description: string | null
    image_url: string | null
    price_eur: number | null
    course_type: string
  }
}

export default function CoursePreviewShell({ course }: Props) {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', minHeight: '60vh' }}>
      {course.image_url && (
        <Image
          src={course.image_url}
          alt={course.title}
          width={1200}
          height={630}
          priority
          style={{ width: '100%', height: 'auto', borderRadius: 8 }}
        />
      )}
      <h1 style={{ marginTop: '1.5rem' }}>{course.title}</h1>
      {course.description && (
        <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>{course.description}</p>
      )}
      {course.price_eur != null && course.price_eur > 0 && (
        <p style={{ marginTop: '1rem', fontSize: '1.25rem' }}>
          <strong>{course.price_eur} €</strong>
          {' · '}
          {course.course_type === 'membership' ? 'Acceso por suscripción' : 'Compra única'}
        </p>
      )}
      <p style={{ marginTop: '2rem' }}>
        <Link href={`/login?next=/courses/${course.id}`}>
          Inicia sesión para inscribirte →
        </Link>
      </p>
    </main>
  )
}
