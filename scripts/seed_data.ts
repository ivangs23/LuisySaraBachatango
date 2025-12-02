import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('Seeding data...');

  // 1. Get User
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === 'ivan_gs_20@hotmail.com');

  if (!user) {
    console.error('User ivan_gs_20@hotmail.com not found');
    return;
  }

  console.log(`Found user: ${user.id}`);

  // 2. Make Admin
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id);

  if (updateError) {
    console.error('Error updating role:', updateError);
  } else {
    console.log('User role updated to admin');
  }

  // 3. Create Course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .insert({
      title: 'Curso de Prueba RBAC',
      description: 'Curso para verificar permisos de administrador.',
      month: 12,
      year: 2025,
      is_published: true,
      image_url: '/placeholder.jpg'
    })
    .select()
    .single();

  if (courseError) {
    console.error('Error creating course:', courseError);
  } else {
    console.log(`Course created: ${course.id}`);
  }
}

seed();
