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
                { data: exams, error: eErr },
                { data: candidates, error: cErr }
            ] = await Promise.all([
                db.from('workers').select('id, status'),
                db.from('medical_exam_records').select('expiry_date'),
                db.from('candidates').select('id, nombre_completo, nota, cv_url, status')
            ]);

            if (wErr) console.error("Error workers:", wErr);
            if (eErr) console.error("Error exams:", eErr);
            if (cErr) console.error("Error candidates:", cErr);

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
            const emergencyStrip = $('#emergencyStrip');
            const emergencyMsg = $('#emergencyMsg');

            if (risksEl) risksEl.textContent = risks;
            if (expiringEl) expiringEl.textContent = expiring;
            
            // Lógica de Impacto Emocional (Emergency Strip)
            if (risks > 0 && emergencyStrip) {
                emergencyStrip.style.display = 'block';
                if (emergencyMsg) emergencyMsg.textContent = `${risks} trabajador${risks > 1 ? 'es' : ''} NO puede${risks > 1 ? 'n' : ''} ingresar a faena HOY`;
            } else if (emergencyStrip) {
                emergencyStrip.style.display = 'none';
            }

            // Estados "Success" si es 0
            if (risks === 0 && risksEl) {
                const cardRisks = $('#card_risks');
                if (cardRisks) cardRisks.className = 'card card--success-alt';
                const sub = $('#risk_sub');
                if (sub) sub.textContent = '✔️ Sistema en regla';
            }
            if (expiring === 0 && expiringEl) {
                const cardExp = $('#card_expiring');
                if (cardExp) cardExp.className = 'card card--success-alt';
                const sub = $('#exp_sub');
                if (sub) sub.textContent = '✔️ Sin vencimientos próximos';
            }

            if (complianceEl) {
                const pct = totalExams > 0 ? Math.round((validExams / totalExams) * 100) : 100;
                complianceEl.textContent = `${pct}%`;
                
                // Recomendación AFK
                const recEl = $('#afkRecommendation');
                if (recEl) {
                    if (pct >= 95) recEl.textContent = "Excelente gestión. Todos los parámetros están bajo control. Se recomienda felicitar al equipo de prevención.";
                    else if (risks > 0) recEl.textContent = `Acción requerida: ${risks} trabajador(es) bloqueado(s). Solicita renovación inmediata de exámenes de Sílice y Altura Física.`;
                    else if (expiring > 0) recEl.textContent = `Prevención: ${expiring} documentos vencen pronto. Recomiendo iniciar carga de nuevas fichas hoy para evitar bloqueos.`;
                }
            }

            // Alertas de Selección
            const alertsList = $('#recruitmentAlertsList');
            if (alertsList && candidates) {
                const alerts = [];
                candidates.forEach(c => {
                    const notaVal = Number(String(c.nota || '0').replace(',', '.'));
                    if (!c.cv_url) {
                        alerts.push(`⚠️ <a href="candidates.html?id=${c.id}" style="color:var(--warning); text-decoration:none;">${c.nombre_completo} sin CV</a>`);
                    }
                    if (notaVal < 5 && notaVal > 0) {
                        alerts.push(`🚨 <a href="candidates.html?id=${c.id}" style="color:var(--danger); text-decoration:none;">Nota baja: ${c.nombre_completo}</a>`);
                    }
                    if (c.status === 'Postulado') {
                        alerts.push(`✨ <a href="candidates.html?id=${c.id}" style="color:var(--accent); text-decoration:none;">Nuevo: ${c.nombre_completo}</a>`);
                    }
                });

                if (alerts.length > 0) {
                    alertsList.innerHTML = alerts.slice(0, 4).map(a => `<div style="margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a}</div>`).join('');
                } else {
                    alertsList.innerHTML = '<div class="text-muted">Sin alertas pendientes</div>';
                }
            }

            }

            // Renderizar Gráficos Operacionales
            if (window.renderAfkCharts) {
                window.renderAfkCharts(null, workers, exams);
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

        // Clickable AI suggestions
        document.querySelectorAll('.ai-suggest').forEach(b => {
            b.onclick = () => {
                const query = b.getAttribute('data-query');
                if (input) input.value = query;
                executeSearch();
            };
        });
    }

    // Usar DOMContentLoaded para asegurar que los elementos existan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
        initDashboard();
    }
})();
