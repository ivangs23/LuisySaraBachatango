const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use service role key if available to bypass RLS for schema check, but anon is fine for RLS check
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function checkSchema() {
  console.log('Checking schema for table "comments"...');
  
  // 1. Check if table exists and list columns (using rpc if we could, but let's try direct select if allowed, or just insert test)
  // Converting this to a simple select on information_schema might be blocked by Supabase default config for anon/service.
  // Instead, let's try to select * from comments limit 1 and see the error or data structure.
  
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from comments:', error);
  } else {
    console.log('Successfully selected from comments.');
    if (data.length > 0) {
      console.log('Sample row keys:', Object.keys(data[0]));
    } else {
      console.log('Table is empty, but accessible.');
    }
  }

  // 2. Try to insert a dummy row (will fail RLS if anon, but error message might be revealing)
  // Actually, better: use the RPC approach to query information_schema if possible, or just print the previous error details.
  
  console.log('\n--- Environment Info ---');
  console.log('URL:', supabaseUrl);
}

checkSchema();
