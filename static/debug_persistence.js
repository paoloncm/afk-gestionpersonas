
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://pmdmvtykkhmvpfxuqjfm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("--- FETCHING ONE CANDIDATE ---");
    const { data: fetch1, error: err1 } = await supabase.from('candidates').select('*').limit(1);
    
    if (err1) {
        console.error("Fetch error:", err1);
        return;
    }
    
    const candidate = fetch1[0];
    console.log("Current Candidate:", candidate.nombre_completo);
    console.log("Current Status:", candidate.status);
    console.log("Available Columns:", Object.keys(candidate).join(', '));

    const newStatus = candidate.status === 'Contratado' ? 'Postulado' : 'Contratado';
    console.log(`--- ATTEMPTING UPDATE TO "${newStatus}" ---`);
    
    const { data: updateData, error: updateErr } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', candidate.id)
        .select();

    if (updateErr) {
        console.error("Update error:", updateErr);
    } else {
        console.log("Update response data:", updateData);
        if (updateData.length === 0) {
            console.log("WARNING: Update returned success but 0 rows were affected. This usually means RLS is blocking the update or the ID was not found.");
        } else {
            console.log("Update SUCCESS. Persisting...");
            const { data: fetch2 } = await supabase.from('candidates').select('status').eq('id', candidate.id).single();
            console.log("Verified Status after refresh-sim:", fetch2.status);
        }
    }
    process.exit(0);
}

run();
