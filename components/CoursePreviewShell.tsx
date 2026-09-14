import Image from 'next/image'
import Link from 'next/link'
import { buildOffer } from '@/utils/courses/offer'

type Props = {
  course: {
    id: string
    title: string
    description: string | null
    image_url: string | null
    price_eur: number | null
    compare_at_price_eur?: number | null
    spots_left?: number | null
    course_type: string | null
  }
}

export default function CoursePreviewShell({ course }: Props) {
  const offer = buildOffer(course)
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
      {offer.price !== null && (
        <p style={{ marginTop: '1rem', fontSize: '1.25rem' }}>
          {offer.compareAt !== null && (
            <s style={{ opacity: 0.7, marginRight: '0.5rem', fontSize: '1rem' }}>
              <span className="sr-only">Antes: </span>
              {offer.compareAt} €
            </s>
          )}
          <strong>{offer.price} €</strong>
          {' · '}
          {course.course_type === 'membership' ? 'Acceso por suscripción' : 'Compra única'}
          {offer.spotsLeft !== null && ` · Quedan ${offer.spotsLeft} plazas disponibles`}
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
