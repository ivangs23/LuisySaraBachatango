import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import CourseForm from '@/components/CourseForm';
import AdminShell, { AdminPanel } from '../../_components/AdminShell';

export default async function EditCoursePage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  const { courseId } = params;
  const supabase = await createClient();

  // Verify Auth & Admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/courses');
  }

  // Fetch Course
  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (!course) {
    notFound();
  }

  return (
    <AdminShell
      chapter="ADMIN · CURSOS"
      eyebrow="EDITAR · CURSO"
      title={`Editar ${course.title}`}
      intro="Actualiza la información del curso, su modalidad y disponibilidad. Los cambios se publican al guardar."
      back={{ href: `/courses/${courseId}`, label: 'Volver al curso' }}
      narrow
    >
      <AdminPanel
        number="01"
        title="Información del curso"
        subtitle="Cualquier modificación afectará a la ficha pública del curso."
      >
        <CourseForm initialData={course} />
      </AdminPanel>
    </AdminShell>
  );
}
