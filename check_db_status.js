
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://pmdmvtykkhmvpfxuqjfm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('candidates').select('id, nombre_completo, status');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Total candidates found:', data.length);
    const statuses = {};
    data.forEach(c => {
        statuses[c.status] = (statuses[c.status] || 0) + 1;
    });
    console.log('Status counts:', JSON.stringify(statuses, null, 2));
    console.log('Sample candidates:', JSON.stringify(data.slice(0, 5), null, 2));
}

check();
