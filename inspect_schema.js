const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://pmdmvtykkhmvpfxuqjfm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkExtensions() {
    const { data: extensions, error } = await supabase.rpc('installed_extensions');
    if (error) {
        console.log('RPC_ERROR', error.message);
        // Try a raw query if RPC fails
        const { data: raw, error: rawErr } = await supabase.from('pg_extension').select('extname');
        if (rawErr) {
            console.log('RAW_QUERY_ERROR', rawErr.message);
        } else {
            console.log('EXTENSIONS:', raw.map(e => e.extname).join(', '));
        }
        return;
    }
    console.log('EXTENSIONS:', extensions.map(e => e.name).join(', '));
}

checkExtensions();
