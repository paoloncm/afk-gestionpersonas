
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://pmdmvtykkhmvpfxuqjfm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('candidates').select('direccion');
    if (error) {
        console.error('Error:', error);
        return;
    }
    const counts = {};
    data.forEach(c => {
        const loc = (c.direccion || 'Desconocido').trim();
        counts[loc] = (counts[loc] || 0) + 1;
    });
    console.log(JSON.stringify(counts, null, 2));
}

check();
