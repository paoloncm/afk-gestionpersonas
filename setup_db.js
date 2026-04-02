const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
    console.log('🚀 Checking for missing columns...');
    const { data, error } = await supabase.from('candidates').select('*').limit(1);
    
    if (error) {
        console.error('Error checking candidates:', error.message);
        return;
    }

    const columns = Object.keys(data[0] || {});
    const required = [
        { name: 'cv_full_text', type: 'text' },
        { name: 'cv_embedding', type: 'vector(1536)' },
        { name: 'evaluacion_general', type: 'text' },
        { name: 'match_score', type: 'numeric' },
        { name: 'match_explicacion', type: 'text' },
        { name: 'experiencia_total', type: 'numeric' },
        { name: 'experiencia_en_empresa_actual', type: 'numeric' },
        { name: 'exp_cargo_actual', type: 'numeric' },
        { name: 'exp_proy_similares', type: 'numeric' }
    ];

    const missing = required.filter(r => !columns.includes(r.name));
    
    if (missing.length === 0) {
        console.log('✅ All required columns exist!');
    } else {
        console.log('⚠️ Missing:', missing.map(m => m.name).join(', '));
        
        let sql = 'create extension if not exists vector;\n';
        missing.forEach(m => {
            sql += `alter table candidates add column if not exists "${m.name}" ${m.type};\n`;
        });

        console.log('Attempting to create columns...');
        const { error: rpcErr } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (rpcErr) {
            console.log('❌ RPC Failed. Please run this in Supabase SQL Editor:');
            console.log(sql);
        } else {
            console.log('✅ Columns created successfully!');
        }
    }
}

setup();
