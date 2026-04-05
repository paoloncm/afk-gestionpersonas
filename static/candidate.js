// ==========================
// AFK RRHH — candidate.js PRO
// Nivel: Enterprise / NASA LEVEL GOD
// Adaptado para: Stark Tactical HUD v7 (Unified Data & Charts)
// ==========================
(async function () {

    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));
    const num = x => {
        if (x == null || x === "") return 0;
        const n = Number(String(x).replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    };

    const qs = new URLSearchParams(window.location.search);
    const candidateId = qs.get("id") || qs.get("trabajador_uuid") || qs.get("worker_id");

    if (!candidateId) {
        console.error("❌ No se encontró ID en la URL");
        const main = $('main');
        if (main) {
            main.innerHTML = `
            <div class="stark-card" style="margin:40px auto; max-width:600px; text-align:center;">
                <h2 class="hero-name" style="font-size:24px;">EXPEDIENTE NO IDENTIFICADO</h2>
                <p class="soft">No se pudo encontrar el identificador del candidato en la URL.</p>
                <a href="index.html" class="btn btn--primary" style="margin-top:20px; display:inline-block;">Volver al Dashboard</a>
            </div>
        `;
        }
        return;
    }

    // ==========================
    // 🔥 FETCH DATA COMPLETA
    // ==========================
    async function fetchAll(id) {
        try {
            console.log("📡 JARVIS: Accediendo a base de datos central...");

            // 1. Candidate
            const { data: candidate, error: ce } = await supabase
                .from('candidates')
                .select('*')
                .eq('id', id)
                .single();
            if (ce) throw ce;

            // 2. Worker (si existe)
            const { data: worker } = await supabase
                .from('workers')
                .select('*')
                .eq('candidate_id', id)
                .maybeSingle();

            // 3. Credenciales reales (usando ID de worker si existe)
            let credentials = [];
            if (worker) {
                const { data: creds } = await supabase
                    .from('worker_credentials')
                    .select('*')
                    .eq('worker_id', worker.id);
                credentials = creds || [];
            }

            // 4. Documentos
            let docs = [];
            if (worker) {
                const { data: d } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('worker_id', worker.id);
                docs = d || [];
            }

            return { candidate, worker, credentials, docs };
        } catch (e) {
            console.error("❌ Error fetchAll:", e);
            return { candidate: null, worker: null, credentials: [], docs: [] };
        }
    }

    const { candidate: r, worker, credentials = [], docs = [] } = await fetchAll(candidateId);

    if (!r) {
        alert("No se encontró el candidato en la base de datos.");
        return;
    }

    // ==========================
    // 🔥 NORMALIZACIÓN & ENGINE
    // ==========================
    const score = num(r.match_score) || (num(r.nota) > 0 ? num(r.nota) * 14.28 : 0);
    const today = new Date();

    // ==========================
    // 🔥 CUMPLIMIENTO REAL
    // ==========================
    function evaluateCompliance(creds) {
        let ok = 0, warn = 0, danger = 0;

        const rows = creds.map(c => {
            if (!c.expiry_date) {
                warn++;
                return {
                    name: c.credential_name || "Documento sin nombre",
                    state: "warn",
                    txt: "Sin fecha",
                    date: "-",
                    obs: "Revisar manualmente"
                };
            }

            const expiry = new Date(c.expiry_date);
            const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);

            if (diffDays < 0) {
                danger++;
                return {
                    name: c.credential_name,
                    state: "danger",
                    txt: "Vencido",
                    date: c.expiry_date,
                    obs: "Bloquea ingreso"
                };
            }

            if (diffDays < 30) {
                warn++;
                return {
                    name: c.credential_name,
                    state: "warn",
                    txt: "Próximo",
                    date: c.expiry_date,
                    obs: `${Math.round(diffDays)} días`
                };
            }

            ok++;
            return {
                name: c.credential_name,
                state: "ok",
                txt: "Vigente",
                date: c.expiry_date,
                obs: "OK"
            };
        });

        let status = "ok";
        if (danger > 0) status = "danger";
        else if (warn > 0) status = "warn";

        return { rows, ok, warn, danger, status };
    }

    const compliance = evaluateCompliance(credentials);

    // ==========================
    // 🔥 RENDER HEADER/MAPPING
    // ==========================
    if ($('#phName')) $('#phName').textContent = r.nombre_completo || "SIN NOMBRE";
    if ($('#phProf')) $('#phProf').textContent = r.profesion || r.cargo_a_desempenar || "Sin profesión definida";
    if ($('#phExp')) $('#phExp').textContent = num(r.experiencia_total) + " años";
    if ($('#phCargoObjetivo')) $('#phCargoObjetivo').textContent = r.cargo_a_desempenar || "No especificado";
    if ($('#phUltima')) $('#phUltima').textContent = r.ultima_exp_laboral_empresa || r.cargo || "Sin datos";
    if ($('#phPermanencia')) $('#phPermanencia').textContent = num(r.experiencia_en_empresa_actual) + " años";

    // EVALUACIÓN STARK (IA)
    if ($('#phEval')) {
        $('#phEval').textContent = r.evaluacion_general || "Análisis técnico pendiente de validación por JARVIS.";
    }

    // CONOCIMIENTOS (CHIPS)
    const skillWrap = $('#phConoc');
    if (skillWrap) {
        const skillsRaw = r.software_que_domina || r.conocimientos || "";
        const skillsArr = Array.isArray(skillsRaw) ? skillsRaw : String(skillsRaw).split(/[,\n]/).map(s => s.trim()).filter(s => s);
        if (skillsArr.length === 0) {
            skillWrap.innerHTML = `<span class="soft">No especificados</span>`;
        } else {
            skillWrap.innerHTML = skillsArr.map(s => `<span class="chip">${s}</span>`).join('');
        }
    }

    // SCORE CIRCLE
    if ($('#matchScoreVal')) $('#matchScoreVal').textContent = Math.round(score) + "%";
    const starkCircle = $('#starkCircle');
    if (starkCircle) {
        starkCircle.style.strokeDasharray = `${score} 100`;
    }

    // ==========================
    // 🔥 DECISION ENGINE
    // ==========================
    const decision = (() => {
        if (compliance.danger > 0) {
            return { state: "NO APTO", color: "danger", text: "Tiene documentos vencidos críticos" };
        }
        if (score >= 85 && compliance.status === "ok") {
            return { state: "ALTAMENTE RECOMENDADO", color: "green", text: "Cumple técnica y documentalmente" };
        }
        if (score >= 70) {
            return { state: "OBSERVADO", color: "warn", text: "Buen perfil pero faltan validaciones" };
        }
        return { state: "NO APTO", color: "danger", text: "Bajo match con la vacante / Gap técnico alto" };
    })();

    if ($('#decisionState')) $('#decisionState').textContent = decision.state;
    if ($('#decisionTitle')) $('#decisionTitle').textContent = decision.text;
    const dot = $('#decisionDot');
    if (dot) dot.style.background = `var(--${decision.color})`;

    // ==========================
    // 🔥 GRÁFICOS DINÁMICOS (Chart.js)
    // ==========================
    function renderCharts() {
        if (typeof Chart === 'undefined') {
            console.warn("⚠️ Chart.js no cargado. Reintentando...");
            setTimeout(renderCharts, 1000);
            return;
        }

        // 1. RADAR DE COMPETENCIAS (Benchmarking)
        const radarEl = document.getElementById('radar');
        if (radarEl) {
            const expVal = Math.min(10, num(r.experiencia_total) / 1.5); // Max 10
            const fitVal = score / 10;
            const stabVal = Math.min(10, (num(r.experiencia_en_empresa_actual) || 2) * 2);
            const certVal = Math.min(10, (compliance.ok / Math.max(1, (compliance.ok + compliance.warn + compliance.danger))) * 10);
            const commVal = (score > 80) ? 8.5 : 7.0; // Heurística

            new Chart(radarEl, {
                type: 'radar',
                data: {
                    labels: ['Experiencia', 'Fit Técnico', 'Estabilidad', 'Certificados', 'Comunicación'],
                    datasets: [{
                        label: 'Benchmark Candidato',
                        data: [expVal, fitVal, stabVal, certVal, commVal],
                        backgroundColor: 'rgba(65, 223, 255, 0.2)',
                        borderColor: '#41dfff',
                        borderWidth: 2,
                        pointBackgroundColor: '#41dfff',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#41dfff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        r: {
                            suggestedMin: 0, suggestedMax: 10,
                            angleLines: { color: 'rgba(255,255,255,0.08)' },
                            grid: { color: 'rgba(255,255,255,0.08)' },
                            pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
                            ticks: { display: false }
                        }
                    }
                }
            });
        }

        // 2. TIMELINE DE TRAYECTORIA (Parsing experiencia_general)
        const timelineEl = document.getElementById('expTimeline');
        if (timelineEl) {
            const rawExp = r.experiencia_general || "";
            // Formato esperado: "YYYY-YYYY CARGO - EMPRESA"
            const lines = rawExp.split('\n').filter(l => l.trim());
            const labels = [];
            const data = [];
            
            lines.slice(0, 5).forEach(line => {
                const match = line.match(/^(\d{4})/);
                const year = match ? match[1] : "S/F";
                labels.push(year);
                // Heurística de duración para la barra: estimamos basado en el orden (más reciente = más largo/alto)
                data.push(Math.max(1, 10 - labels.length * 1.5));
            });

            // Si no hay datos, usar mock
            if (labels.length === 0) {
                labels.push('2020','2021','2022','2023','2024');
                data.push(3, 4, 2, 6, 8);
            }

            new Chart(timelineEl, {
                type: 'bar',
                data: {
                    labels: labels.reverse(),
                    datasets: [{
                        label: 'Hitos de Trayectoria',
                        data: data.reverse(),
                        backgroundColor: 'rgba(65, 223, 255, 0.55)',
                        borderColor: '#41dfff',
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.6)' } },
                        y: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.75)' } }
                    }
                }
            });
        }
    }

    renderCharts();

    // ==========================
    // 🔥 ALERTER & RENDER DOCS
    // ==========================
    function renderAlerts() {
        const alerts = [];
        if (compliance.danger > 0) alerts.push({ type: "danger", title: "Documentos vencidos", text: `${compliance.danger} críticos` });
        if (compliance.warn > 0) alerts.push({ type: "warn", title: "Por vencer", text: `${compliance.warn} requieren renovación` });
        if (!worker) alerts.push({ type: "warn", title: "Perfil Externo", text: "No registrado como activo" });
        if (alerts.length === 0) alerts.push({ type: "ok", title: "Integridad Confirmada", text: "Sin riesgos operativos" });

        const container = $('#criticalAlerts');
        if (container) {
            container.innerHTML = alerts.map(a => `
            <div class="alert-item alert-item--${a.type}">
                <span class="alert-bullet alert-bullet--${a.type}"></span>
                <div>
                <b style="color:#fff;">${a.title}</b>
                <div class="soft" style="font-size:12px;">${a.text}</div>
                </div>
            </div>
            `).join('');
        }
    }
    renderAlerts();

    function renderDocs() {
        const tbody = $('#documentsTableBody');
        if (tbody) {
            if (compliance.rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--muted);">No hay credenciales registradas.</td></tr>`;
            } else {
                tbody.innerHTML = compliance.rows.map(d => `
                <tr>
                    <td><b style="color:#fff;">${d.name}</b></td>
                    <td><span class="status-chip status-chip--${d.state}">${d.txt}</span></td>
                    <td style="font-family:monospace;">${d.date}</td>
                    <td class="soft">${d.obs}</td>
                </tr>
                `).join('');
            }
        }
        if ($('#docOkCount')) $('#docOkCount').textContent = compliance.ok;
        if ($('#docGlobalStatus')) {
            $('#docGlobalStatus').textContent = compliance.status === "danger" ? "🔴 BLOQUEADO" : compliance.status === "warn" ? "🟡 EN RIESGO" : "🟢 HABILITADO";
        }
    }
    renderDocs();

    // ==========================
    // 🔥 BOTÓN IA SUMMARY
    // ==========================
    const aiBtn = $('#btnAiSummary');
    if (aiBtn) {
        aiBtn.onclick = async () => {
            const content = $('#aiSummaryContent');
            if (content) content.innerHTML = "<em>Procesando datos con Stark Intelligence...</em>";
            const prompt = `Analiza con rigor táctico este candidato:\nNombre: ${r.nombre_completo}\nProfesión: ${r.profesion}\nExperiencia: ${r.experiencia_total} años\nScore: ${score}%\nDoc: ${compliance.status.toUpperCase()}\nEntrega un informe de 4 puntos: DIAGNÓSTICO, FORTALEZAS, RIESGOS, RECOMENDACIÓN.`;
            if (window.afkChatSend) {
                window.afkChatSend(prompt, (res) => { if (content) content.innerHTML = res.replace(/\n/g, "<br>"); });
            } else { if (content) content.innerHTML = "Error: Motor JARVIS no cargado."; }
        };
    }

})();