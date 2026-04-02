const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://pmdmvtykkhmvpfxuqjfm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data: cands, error } = await supabase.from('candidates').select('direccion').not('direccion', 'is', null);
    if (error) { console.error(error); return; }
    console.log("TOTAL CANDS WITH DIRECCION:", cands.length);
    const locations = {};
    cands.forEach(c => {
        const dir = (c.direccion || "").toString().toLowerCase();
        // Simple heuristic: Take the last part after comma or the whole string if no comma
        const parts = dir.split(',');
        const city = parts[parts.length - 1].trim();
        if (city) locations[city] = (locations[city] || 0) + 1;
    });
    console.log("LOCATIONS FOUND:", JSON.stringify(locations, null, 2));
}
run();
