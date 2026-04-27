import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CourseForm from '@/components/CourseForm';
import AdminShell, { AdminPanel } from '../_components/AdminShell';

export default async function CreateCoursePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verify Admin Role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/courses');
  }

  return (
    <AdminShell
      chapter="ADMIN · CURSOS"
      eyebrow="NUEVO · CURSO"
      title="Crear Nuevo Curso"
      intro="Define los cimientos del curso: título, categoría, modalidad y precio. Más adelante podrás añadir lecciones, vídeos y tareas desde la página de edición."
      back={{ href: '/courses', label: 'Volver al catálogo' }}
    >
      <AdminPanel
        number="01"
        title="Información del curso"
        subtitle="Los datos que verá el alumno en la portada y en el listado de cursos."
      >
        <CourseForm />
      </AdminPanel>
    </AdminShell>
  );
}
