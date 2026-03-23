// dashboard.supabase.js - Lógica para métricas en tiempo real del Centro de Control
(function() {
    const $ = (s) => document.querySelector(s);
    
    async function initDashboard() {
        // Esperar a que el cliente de Supabase esté listo (supabase.js)
        if (!window.db) {
            setTimeout(initDashboard, 200);
            return;
        }
        console.log("[dashboard.supabase.js] inicializado");
        await loadRealTimeMetrics();
        setupQuickAi();
    }

    async function loadRealTimeMetrics() {
        try {
            console.log("[dashboard.supabase.js] cargando métricas reales...");
            
            // Usamos window.db (en lugar de window.supabase si ya está inicializado en supabase.js)
            const db = window.db;

            const [
                { data: workers, error: wErr },
                { data: exams, error: eErr }
            ] = await Promise.all([
                db.from('workers').select('id, status'),
                db.from('medical_exam_records').select('expiry_date')
            ]);

            if (wErr) console.error("Error workers:", wErr);
            if (eErr) console.error("Error exams:", eErr);

            const now = new Date();
            const threshold = new Date();
            threshold.setDate(now.getDate() + 30);

            let risks = 0;
            let expiring = 0;
            const totalExams = exams?.length || 0;
            let validExams = 0;

            if (exams) {
                exams.forEach(ex => {
                    if (!ex.expiry_date) return;
                    const expiry = new Date(ex.expiry_date);
                    
                    if (expiry < now) {
                        risks++;
                    } else if (expiry <= threshold) {
                        expiring++;
                        validExams++;
                    } else {
                        validExams++;
                    }
                });
            }

            // Actualizar KPIs en el DOM
            const risksEl = $('#kpi_risks');
            const expiringEl = $('#kpi_expiring');
            const complianceEl = $('#kpi_compliance_pct');

            if (risksEl) risksEl.textContent = risks;
            if (expiringEl) expiringEl.textContent = expiring;
            
            if (complianceEl) {
                const pct = totalExams > 0 ? Math.round((validExams / totalExams) * 100) : 100;
                complianceEl.textContent = `${pct}%`;
            }

        } catch (err) {
            console.error("Error cargando métricas de dashboard:", err);
        }
    }

    function setupQuickAi() {
        const input = $('#aiQuickSearch');
        const btn = $('#btnAiQuick');
        if (!input || !btn) return;

        const executeSearch = () => {
            const val = input.value.trim();
            if (!val) return;
            
            // Abrir chatbot si está cerrado
            const chatSide = $('#chatbot');
            if (chatSide && !chatSide.classList.contains('is-open')) {
                const chatBtn = $('#btnChat');
                if (chatBtn) chatBtn.click();
            }
            
            // Enviar mensaje al chatbot
            const chatInput = $('#chatInput');
            if (chatInput) {
                chatInput.value = val;
                const sendBtn = $('#chatSend');
                if (sendBtn) sendBtn.click();
            }
            input.value = '';
        };

        btn.onclick = executeSearch;
        input.onkeydown = (e) => { if (e.key === 'Enter') executeSearch(); };
    }

    // Usar DOMContentLoaded para asegurar que los elementos existan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
        initDashboard();
    }
})();
