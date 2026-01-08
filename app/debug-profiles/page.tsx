import { createClient } from '@/utils/supabase/server';

export default async function DebugProfiles() {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');

  return (
    <div style={{ padding: '2rem', color: 'black' }}>
      <h1>Debug Profiles</h1>
      {error && <pre style={{ color: 'red' }}>Error: {JSON.stringify(error, null, 2)}</pre>}
      <pre>{JSON.stringify(profiles, null, 2)}</pre>
    </div>
  );
}
