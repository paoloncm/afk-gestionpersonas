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
                { data: workerProfiles, error: wErr },
                { data: candidates, error: cErr }
            ] = await Promise.all([
                db.from('v_worker_profile').select('*'),
                db.from('candidates').select('id, nombre_completo, nota, status')
            ]);

            if (wErr) console.error("Error workerProfiles:", wErr);
            if (cErr) console.error("Error candidates:", cErr);

            // Preparar datos para gráficos
            // workerProfiles ya contiene 'credentials' como JSONB
            const workers = workerProfiles || [];
            // Aplanamos los exámenes de todos los perfiles para mantener compatibilidad con renderAfkCharts
            const exams = (workerProfiles || []).flatMap(w => w.credentials || []);

            const now = new Date();
            const threshold = new Date();
            threshold.setDate(now.getDate() + 300); // Tensión Operativa: 300 días (Level God)

            let risks = 0;       // Solo para VENCIDOS (Bloqueo Real)
            let warnings = 0;    // Para FALTANTES o PRÓXIMOS (Tensión Operativa)
            let expiring = 0;
            let validExams = 0;
            const currentRisks = [];

            workers.forEach(w => {
                const creds = w.credentials || [];
                
                if (creds.length === 0) {
                    risks++;
                    currentRisks.push(`${w.full_name} (SIN DOCUMENTOS)`);
                } else {
                    const now = new Date();
                    const hasExpired = creds.some(c => c.expiry_date && new Date(c.expiry_date) <= now);
                    const hasUpcoming = creds.some(c => {
                        if (!c.expiry_date) return false;
                        const diff = (new Date(c.expiry_date) - now) / (1000 * 60 * 60 * 24);
                        return diff > 0 && diff <= 300;
                    });

                    if (hasExpired || hasUpcoming) {
                        warnings++;
                    } else {
                        validExams++;
                    }
                }
            });

            // Actualizar KPIs en el DOM
            const risksEl = $('#kpi_risks');
            const expiringEl = $('#kpi_expiring'); // Warnings/Upcoming
            const complianceEl = $('#kpi_compliance_pct');
            const emergencyStrip = $('#emergencyStrip');
            const emergencyMsg = $('#emergencyMsg');
            const emergencyList = $('#emergencyList');

            if (risksEl) risksEl.textContent = risks;
            if (expiringEl) expiringEl.textContent = warnings;
            
            const kpiTotalEl = $('#kpi_total_workers');
            const kpiCandEl = $('#kpi_total_candidates');
            if (kpiTotalEl) kpiTotalEl.textContent = workers.length;
            if (kpiCandEl) kpiCandEl.textContent = (candidates || []).length;
            
            // Lógica de Impacto Emocional (Emergency Strip)
            if (risks > 0 && emergencyStrip) {
                emergencyStrip.style.display = 'block';
                if (emergencyMsg) emergencyMsg.textContent = `${risks} trabajador${risks > 1 ? 'es' : ''} BLOQUEADO${risks > 1 ? 'S' : ''} (Detención inmediata)`;
                if (emergencyList) {
                    emergencyList.innerHTML = currentRisks.map(d => `<div style="font-size:12px; margin-top:2px; opacity:0.9;">🚫 ${d}</div>`).join('');
                }
            } else if (emergencyStrip) {
                emergencyStrip.style.display = 'none';
            }

            // Estados "Success" si es 0
            if (risks === 0 && risksEl) {
                const cardRisks = $('#card_risks');
                if (cardRisks) cardRisks.className = 'card card--success-alt';
                const sub = $('#risk_sub');
                if (sub) sub.textContent = '✔️ Operación segura';
            }
            if (expiring === 0 && expiringEl) {
                const cardExp = $('#card_expiring');
                if (cardExp) cardExp.className = 'card card--success-alt';
                const sub = $('#exp_sub');
                if (sub) sub.textContent = '✔️ Sin riesgos preventivos';
            }

            if (complianceEl) {
                // Inconsistencia Lógica: Si hay riesgos, la tasa de cumplimiento DEBE bajar.
                const pct = workers.length > 0 ? Math.round(((workers.length - risks) / workers.length) * 100) : 100;
                complianceEl.textContent = `${pct}%`;
                
                // Recomendación AFK - Nivel Dios
                const recEl = $('#afkRecommendation');
                if (recEl) {
                    if (risks > 0) {
                        recEl.innerHTML = `<span style="color:#ef4444; font-weight:900;">🧠 Alerta operativa detectada:</span> ${risks} trabajador${risks > 1 ? 'es' : ''} bloqueado${risks > 1 ? 's' : ''} por incumplimiento crítico. Se recomienda acción inmediata para evitar detención de faena.`;
                    }
                    else if (expiring > 0) recEl.textContent = `ALERTA PREVENTIVA: Se detectan ${expiring} vencimientos en ventana de 300 días. Recomiendo agendar exámenes hoy.`;
                    else recEl.textContent = "Inteligencia AFK: Sistema estable. Se detecta cumplimiento proyectado sólido para los próximos 10 meses.";
                }

                // Acciones Proactivas del Botón AFK
                const btnRec = $('#btnRecAction');
                if (btnRec) {
                    btnRec.onclick = () => {
                        let prompt = "";
                        if (risks > 0) prompt = `¿Cómo puedo resolver de forma urgente los ${risks} bloqueos operacionales detectados hoy?`;
                        else if (expiring > 0) prompt = `¿Cuál es el mejor plan de acción para gestionar los ${expiring} vencimientos próximos?`;
                        else prompt = "¿Cómo puedo optimizar la gestión de mi personal para el próximo mes?";

                        // Abrir chatbot y enviar
                        const openBtn = $('#btnChat');
                        if (openBtn) openBtn.click();
                        
                        const chatInput = $('#chatInput');
                        if (chatInput) {
                            chatInput.value = prompt;
                            const sendBtn = $('#chatSend');
                            if (sendBtn) sendBtn.click();
                        }
                    };
                }
            }

            // Alertas de Selección & Conectividad (Level God)
            const alertsList = $('#recruitmentAlertsList');
            if (alertsList && candidates) {
                const alerts = [];
                candidates.forEach(c => {
                    const notaVal = Number(String(c.nota || '0').replace(',', '.'));
                    
                    // Alerta 1: Nuevo Postulado
                    if (c.status === 'Postulado') {
                        alerts.push(`✨ <a href="candidates.html?id=${c.id}" style="color:var(--accent); text-decoration:none; font-weight:700;">Nuevo Talento: ${c.nombre_completo}</a>`);
                    }
                    // Alerta 2: Nota alta sin análisis
                    if (notaVal >= 6) {
                        alerts.push(`🔥 <a href="candidates.html?id=${c.id}" style="color:var(--ok); text-decoration:none;">Perfil Top (${notaVal}): Revisar Urgente</a>`);
                    }
                    // Alerta 3: Documentación faltante en Workers
                    const workerWithoutFaena = (workers || []).find(w => String(w.id) === String(c.id) && !w.company_name);
                    if (workerWithoutFaena) {
                        alerts.push(`📢 <a href="workers.html?id=${c.id}" style="color:var(--warning); text-decoration:none;">Worker sin faena asignada</a>`);
                    }
                });

                if (alerts.length > 0) {
                    alertsList.innerHTML = alerts.slice(0, 5).map(a => `<div style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">${a}</div>`).join('');
                } else {
                    alertsList.innerHTML = '<div class="text-muted">No hay novedades críticas</div>';
                }
            }
            
            // Renderizar Gráficos de Análisis con todos los datos
            if (window.renderAfkCharts) {
                window.renderAfkCharts(candidates, workers, exams);
            }
            if (window.renderExamTypeDistribution) {
                window.renderExamTypeDistribution(exams);
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
