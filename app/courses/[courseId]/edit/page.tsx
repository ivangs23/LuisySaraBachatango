import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import CourseForm from '@/components/CourseForm';

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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', color: 'var(--text-main)' }}>Editar Curso</h1>
      <CourseForm initialData={course} />
    </div>
  );
}
