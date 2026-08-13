const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://pmdmvtykkhmvpfxuqjfm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const sql = `
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tenant_email text;
        ALTER TABLE workers ADD COLUMN IF NOT EXISTS tenant_email text;
        ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS tenant_email text;
        UPDATE candidates SET tenant_email = 'paoloncm@gmail.com' WHERE tenant_email IS NULL;
        UPDATE workers SET tenant_email = 'paoloncm@gmail.com' WHERE tenant_email IS NULL;
        UPDATE vacancies SET tenant_email = 'paoloncm@gmail.com' WHERE tenant_email IS NULL;
    `;
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) console.error('Error:', error.message);
    else console.log('Success:', data);
}
run();
