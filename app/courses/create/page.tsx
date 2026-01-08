import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CourseForm from '@/components/CourseForm';
import Link from 'next/link';

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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/courses" style={{ color: '#888', textDecoration: 'none' }}>
          &larr; Volver a Cursos
        </Link>
        <h1 style={{ fontSize: '2rem', marginTop: '1rem', color: 'var(--primary)' }}>Crear Nuevo Curso</h1>
      </div>
      
      <CourseForm />
    </div>
  );
}
