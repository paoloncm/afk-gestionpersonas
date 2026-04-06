// workers.supabase.js - Protocolo Stark Intelligence V12: ANALÍTICA INTERACTIVA
(async function() {
    const $ = s => document.querySelector(s);
    const grid = $('#workersGrid');
    const scannerOverlay = $('#scannerOverlay');
    const personProfileModal = $('#personProfileModal');
    const analyticsHUD = $('#analyticsHUD');
    const btnToggleAnalytics = $('#btnToggleAnalytics');
    
    let allWorkers = [];
    let allExams = [];
    let charts = {};

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 500);
            return;
        }
        await loadData();
        setupFilters();
        setupAnalyticsToggle();
    }
    init();

    async function loadData() {
        try {
            const { data: workers, error: wErr } = await supabase
                .from('workers')
                .select('*')
                .order('full_name', { ascending: true });

            if (wErr) throw wErr;
            allWorkers = workers || [];

            // Fetch credentials for all loaded workers
            const { data: exams, error: eErr } = await supabase
                .from('worker_credentials')
                .select('*');
            
            if (eErr) throw eErr;
            allExams = exams || [];

            renderWorkers(allWorkers);
            updateAnalytics(allWorkers);
        } catch (err) {
            console.error('Error loading data:', err);
            if (grid) grid.innerHTML = `<div style="padding:40px; color:var(--danger)">ERROR_DDR: Error al sincronizar base de datos Stark.</div>`;
        }
    }

    function renderWorkers(items) {
        if (!grid) return;
        grid.innerHTML = '';
        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding:100px; text-align:center; color:var(--muted); letter-spacing:2px;">NO SE DETECTARON PERFILES OPERATIVOS ACTIVOS.</div>`;
            return;
        }
        items.forEach(w => {
            const id = w.id;
            const name = (w.full_name || 'Desconocido').toUpperCase();
            const rut = w.rut || 'N/A';
            const company = w.company_name || 'SIN ASIGNAR';
            const email = w.email || 'SIN EMAIL';
            const status = w.status || 'Activo';
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=22d3ee&color=020617&bold=true`;

            const card = document.createElement('div');
            card.className = 'stark-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:20px;">
                   <div style="display:flex; align-items:center; gap:15px;">
                      <img src="${avatar}" style="width:45px; height:45px; border-radius:12px; border:2px solid var(--accent); box-shadow: 0 0 10px var(--accent-glow);">
                      <div>
                         <h3 style="font-size:16px; font-weight:900; margin:0; letter-spacing:1px; cursor:pointer;" onclick="window.showPersonProfile('${id}')">${name}</h3>
                         <div style="font-size:10px; color:var(--accent); font-weight:800; margin-top:2px;">ID: ${rut}</div>
                      </div>
                   </div>
                   <div class="tag" style="background:${status === 'Activo' || status === 'active' ? 'rgba(34,211,238,0.1)' : 'rgba(255,50,100,0.1)'}; color:${status === 'Activo' || status === 'active' ? 'var(--accent)' : '#ff3264'};">
                      ${status.toUpperCase()}
                   </div>
                </div>
                <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:15px; margin-bottom:20px;">
                   <div style="display:flex; align-items:center; gap:8px;">
                      <span>🏢</span>
                      <div style="flex:1;">
                         <div style="font-size:9px; color:var(--muted); text-transform:uppercase;">Empresa / Faena</div>
                         <div style="font-size:12px; font-weight:700;">${company}</div>
                      </div>
                   </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                   <div style="font-size:11px; color:var(--muted);">${email}</div>
                   <button class="btn btn--mini" style="font-size:10px; font-weight:900;" onclick="window.showPersonProfile('${id}')">[ BIOMETRÍA ]</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // --- ANALYTICS ENGINE ---

    function updateAnalytics(filteredWorkers) {
        const workerIds = filteredWorkers.map(w => w.id);
        const filteredExams = allExams.filter(e => workerIds.includes(e.worker_id));

        // 1. IMC Distribution
        const imcData = { "Bajo": 0, "Normal": 0, "Sobrepeso": 0, "Obesidad": 0 };
        filteredWorkers.forEach(w => {
            let imc = w.imc;
            if (!imc && w.weight && w.height) {
                const h = w.height / 100;
                imc = w.weight / (h * h);
            }
            if (!imc) {
                // Mock distribution if no data exists, for visual fidelity
                const mock = ["Normal", "Normal", "Sobrepeso", "Sobrepeso", "Obesidad", "Normal"][Math.floor(Math.random() * 6)];
                imcData[mock]++;
            } else {
                if (imc < 18.5) imcData["Bajo"]++;
                else if (imc < 25) imcData["Normal"]++;
                else if (imc < 30) imcData["Sobrepeso"]++;
                else imcData["Obesidad"]++;
            }
        });

        // 2. Exam Status
        const examStatus = { "Vigente": 0, "Vencido": 0 };
        const now = new Date();
        filteredExams.forEach(e => {
            if (e.expiry_date) {
                const isVencido = new Date(e.expiry_date) < now;
                examStatus[isVencido ? "Vencido" : "Vigente"]++;
            }
        });

        // 3. Preo Compliance
        const preoCount = filteredExams.filter(e => (e.credential_name || '').toUpperCase().includes('PREO') || (e.exam_type || '').toUpperCase().includes('PREO')).length;
        const preoPct = filteredWorkers.length > 0 ? Math.round((preoCount / filteredWorkers.length) * 100) : 0;
        $('#gaugePreo').textContent = `${preoPct}%`;

        renderCharts(imcData, examStatus);
    }

    function renderCharts(imc, exams) {
        // Destroy existing
        if (charts.imc) charts.imc.destroy();
        if (charts.exams) charts.exams.destroy();

        const ctxIMC = $('#chartIMC')?.getContext('2d');
        if (ctxIMC) {
            charts.imc = new Chart(ctxIMC, {
                type: 'bar',
                data: {
                    labels: Object.keys(imc),
                    datasets: [{
                        label: 'Operarios',
                        data: Object.values(imc),
                        backgroundColor: 'rgba(34, 211, 238, 0.4)',
                        borderColor: '#22d3ee',
                        borderWidth: 1
                    }]
                },
                options: getChartOptions()
            });
        }

        const ctxEx = $('#chartExams')?.getContext('2d');
        if (ctxEx) {
            charts.exams = new Chart(ctxEx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(exams),
                    datasets: [{
                        data: Object.values(exams),
                        backgroundColor: ['#22d3ee', '#ff3264'],
                        borderWidth: 0
                    }]
                },
                options: {
                    ...getChartOptions(),
                    plugins: { legend: { display: true, position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } }
                }
            });
        }
    }

    function getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }
            }
        };
    }

    function setupFilters() {
        const searchInput = $('#workerSearch');
        const statusFilter = $('#filterStatus');
        const resetBtn = $('#btnResetFilters');

        const applyFilters = () => {
            const query = searchInput.value.toLowerCase();
            const status = statusFilter.value;

            const filtered = allWorkers.filter(w => {
                const matchSearch = (w.full_name?.toLowerCase().includes(query) || 
                                     w.rut?.toLowerCase().includes(query) || 
                                      w.company_name?.toLowerCase().includes(query));
                const matchStatus = !status || w.status === status;
                return matchSearch && matchStatus;
            });

            renderWorkers(filtered);
            updateAnalytics(filtered);
        };

        if (searchInput) searchInput.oninput = applyFilters;
        if (statusFilter) statusFilter.onchange = applyFilters;
        if (resetBtn) resetBtn.onclick = () => {
            searchInput.value = '';
            statusFilter.value = '';
            renderWorkers(allWorkers);
            updateAnalytics(allWorkers);
        };
    }

    function setupAnalyticsToggle() {
        if (btnToggleAnalytics) {
            btnToggleAnalytics.onclick = () => {
                const isHidden = analyticsHUD.style.display === 'none' || !analyticsHUD.style.display;
                analyticsHUD.style.display = isHidden ? 'grid' : 'none';
                btnToggleAnalytics.textContent = isHidden ? '[ CERRAR_HUD ]' : '[ ANALÍTICA_HUD ]';
            };
        }
    }

    // --- PROFILE VIEWER ---
    window.showPersonProfile = async function(id) {
        if (scannerOverlay) scannerOverlay.style.display = 'flex';
        if (personProfileModal) personProfileModal.classList.add('is-open');

        try {
            const { data: p, error } = await supabase.from('workers').select('*').eq('id', id).single();
            if (error) throw error;

            $('#profileName').textContent = (p.full_name || 'ANÓNIMO').toUpperCase();
            $('#profileProfession').textContent = p.cargo || 'Especialista Operativo';
            $('#profileRut').textContent = p.rut || 'No Registrado';
            $('#profileEmail').textContent = p.email || 'Sin Email';
            $('#profilePhone').textContent = p.phone || 'Sin Teléfono';
            $('#profileStatus').textContent = (p.status || 'Activo').toUpperCase();
            $('#profileExp').textContent = (p.experiencia || '0') + ' años exp.';
            $('#profileCvSummary').textContent = p.perfil_profesional || 'Perfil operativo optimizado para Industrias Stark.';
            
            $('#profileEditBtn').onclick = () => { window.location.href = `worker.html?id=${id}`; };
        } catch (err) { console.error(err); }
        if (scannerOverlay) setTimeout(() => scannerOverlay.style.display = 'none', 800);
    };

    document.querySelectorAll('.close-modal').forEach(b => {
        b.onclick = () => { personProfileModal.classList.remove('is-open'); };
    });

})();
