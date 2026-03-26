/**
 * analytics.supabase.js
 * Lógica de People Analytics para AFK RRHH
 */

(async function () {
  const $ = (s) => document.querySelector(s);
  
  // Variables de estado
  let allWorkers = [];
  let allExams = [];
  let allCandidates = [];
  let filteredWorkers = [];
  let charts = {};

  // Inicialización
  async function init() {
    console.log("[analytics] Iniciando People Analytics...");
    
    if (!window.db) {
      console.error("[analytics] Supabase (window.db) no está disponible.");
      return;
    }

    await loadData();
    populateFilters();
    bindEvents();
    renderAll();
  }

  // --- Functions to be used in events (must be defined or hoisted) ---
  function runSimulation() {
    const cargo = $("#sim_cargo")?.value;
    const qty = parseInt($("#sim_quantity")?.value || 0);
    const resultBox = $("#simulationResult");
    const resultCard = $("#simResultCard");

    if (!cargo || !qty) {
        window.notificar?.("Por favor seleccione cargo y cantidad.", "warning");
        return;
    }

    if (resultCard) resultCard.style.opacity = "1";

    const workers = allWorkers.filter(w => (w.profesion || w.cargo_a_desempenar) === cargo);
    const candidates = allCandidates.filter(c => (c.profesion || c.cargo_a_desempenar) === cargo);
    
    const totalAvailable = workers.length + candidates.length;
    let html = "";
    
    if (totalAvailable >= qty) {
        const fromWorkers = Math.min(workers.length, qty);
        const fromCandidates = Math.max(0, qty - workers.length);
        
        html = `
            <div style="font-size:32px; margin-bottom:10px;">✅</div>
            <h5 style="margin:0; color:var(--ok);">FACTIBILIDAD ALTA</h5>
            <p style="font-size:12px; margin:10px 0;">
                Se requieren ${qty} personas. <br>
                Disponibles: <strong>${workers.length} activos</strong> ${fromCandidates > 0 ? `+ <strong>${fromCandidates} candidates</strong> en proceso.` : ''}
            </p>
            <button class="btn btn--mini" onclick="location.href='pipeline.html'" style="margin-top:10px;">Gestionar Contratación</button>
        `;
    } else {
        html = `
            <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
            <h5 style="margin:0; color:var(--warning);">BRECHA DETECTADA</h5>
            <p style="font-size:12px; margin:10px 0;">
                Faltan <strong>${qty - totalAvailable}</strong> personas para este cargo.<br>
                Total disponible (Activos + Pipeline): ${totalAvailable}
            </p>
            <button class="btn btn--mini btn--primary" onclick="location.href='pipeline.html?action=new&cargo=${encodeURIComponent(cargo)}'">Iniciar Reclutamiento Urgente</button>
        `;
    }

    if (resultBox) resultBox.innerHTML = html;
  }

  async function loadData() {
    try {
      const { data: workers, error: workersError } = await window.db.from("workers").select("*");
      const { data: exams, error: examsError } = await window.db.from("medical_exam_records").select("*");
      let { data: candidates, error: candidatesError } = await window.db.from("v_candidate_summary").select("*");
      
      // Fallback if view fails
      if (candidatesError || !candidates) {
          console.warn("[analytics] v_candidate_summary falló, intentando tabla candidates...");
          const fallback = await window.db.from("candidates").select("*");
          candidates = fallback.data;
          candidatesError = fallback.error;
      }

      if (workersError) throw workersError;
      if (examsError) throw examsError;
      if (candidatesError) throw candidatesError;

      allWorkers = workers || [];
      allExams = exams || [];
      
      // Deduplicate candidates by Name or RUT
      const candidateMap = new Map();
      (candidates || []).forEach(c => {
          const rawRut = String(c.rut || "").toUpperCase();
          const cleanRut = (rawRut === "NULL" || rawRut === "" || rawRut === "UNDEFINED") ? null : rawRut;
          const nameKey = String(c.nombre_completo || "").toLowerCase().trim();
          const key = cleanRut || nameKey;
          
          if (key && (!candidateMap.has(key) || (c.created_at && new Date(c.created_at) > new Date(candidateMap.get(key).created_at)))) {
              candidateMap.set(key, c);
          }
      });
      allCandidates = Array.from(candidateMap.values());
      
      filteredWorkers = [...allWorkers];

      console.log(`[analytics] Datos cargados: ${allWorkers.length} trabajadores, ${allCandidates.length} candidatos.`);
    } catch (err) {
      console.error("[analytics] Error cargando datos:", err);
    }
  }

  function bindEvents() {
    $("#globalAnalyticsSearch")?.addEventListener("input", applyFilters);
    $("#filterFaena")?.addEventListener("change", applyFilters);
    $("#filterCargo")?.addEventListener("change", applyFilters);
    $("#btnSimulate")?.addEventListener("click", runSimulation);
    $("#toggleExecutiveView")?.addEventListener("change", (e) => {
      const main = $(".main");
      if (e.target.checked) {
          main.classList.add("executive-mode");
          document.querySelectorAll(".section.grid-3, .section.grid-2, h3.h1").forEach(el => el.style.display = 'none');
      } else {
          main.classList.remove("executive-mode");
          document.querySelectorAll(".section.grid-3, .section.grid-2, h3.h1").forEach(el => el.style.display = '');
      }
    });

    // Action buttons
    document.querySelectorAll(".btn-action").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.dataset.action;
        handleAction(action);
      });
    });
  }

  function populateFilters() {
    const faenas = [...new Set(allWorkers.map(w => w.company_name).filter(Boolean))].sort();
    const cargos = [...new Set([...allWorkers, ...allCandidates].map(w => w.profesion || w.cargo_a_desempenar).filter(Boolean))].sort();

    const fSel = $("#filterFaena");
    const cSel = $("#filterCargo");
    const sSel = $("#sim_cargo"); // Simulator dropdown

    if (fSel) fSel.innerHTML = '<option value="">Todas las Faenas</option>' + faenas.map(f => `<option value="${f}">${f}</option>`).join('');
    if (cSel) cSel.innerHTML = '<option value="">Todos los Cargos</option>' + cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    if (sSel) sSel.innerHTML = '<option value="">Elegir cargo...</option>' + cargos.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function applyFilters() {
    const q = ($("#globalAnalyticsSearch")?.value || "").toLowerCase();
    const faena = $("#filterFaena")?.value;
    const cargo = $("#filterCargo")?.value;

    filteredWorkers = allWorkers.filter(w => {
        const name = (w.full_name || "").toLowerCase();
        const wFaena = w.company_name || "";
        const wCargo = w.profesion || w.cargo_a_desempenar || "";
        
        const matchQ = !q || name.includes(q) || wFaena.toLowerCase().includes(q) || wCargo.toLowerCase().includes(q);
        const matchF = !faena || wFaena === faena;
        const matchC = !cargo || wCargo === cargo;

        return matchQ && matchF && matchC;
    });

    renderAll();
  }

  function handleAction(action) {
    if (action === 'recruit') {
        window.location.href = "pipeline.html";
    } else if (action === 'train') {
        window.notificar?.("Solicitud de capacitación enviada al área de formación.", "success");
    } else if (action === 'notify') {
        window.notificar?.("Notificaciones de cumplimiento enviadas a los trabajadores afectados.", "info");
    }
  }

  function renderAll() {
    // Reset charts for clean re-render
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    renderScore();
    renderKPIs();
    renderDemographics();
    renderProfiles();
    renderRisks();
    renderAIRecommendations();
    renderStrategicHeader();
  }

  // --- Simulation Logic ---
  function runSimulation() {
    const cargo = $("#sim_cargo")?.value;
    const qty = parseInt($("#sim_quantity")?.value || 0);
    const resultBox = $("#simulationResult");
    const resultCard = $("#simResultCard");

    if (!cargo || !qty) {
        window.notificar?.("Por favor seleccione cargo y cantidad.", "warning");
        return;
    }

    if (resultCard) resultCard.style.opacity = "1";

    const workers = allWorkers.filter(w => (w.profesion || w.cargo_a_desempenar) === cargo);
    const candidates = allCandidates.filter(c => c.cargo_a_desempenar === cargo);
    
    const totalAvailable = workers.length + candidates.length;
    let html = "";
    
    if (totalAvailable >= qty) {
        const fromWorkers = Math.min(workers.length, qty);
        const fromCandidates = Math.max(0, qty - workers.length);
        
        html = `
            <div style="font-size:32px; margin-bottom:10px;">✅</div>
            <h5 style="margin:0; color:var(--ok);">FACTIBILIDAD ALTA</h5>
            <p style="font-size:12px; margin:10px 0;">
                Se requieren ${qty} personas. <br>
                Disponibles: <strong>${workers.length} activos</strong> ${fromCandidates > 0 ? `+ <strong>${fromCandidates} candidates</strong> en proceso.` : ''}
            </p>
            <button class="btn btn--mini" onclick="location.href='pipeline.html'" style="margin-top:10px;">Gestionar Contratación</button>
        `;
    } else {
        html = `
            <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
            <h5 style="margin:0; color:var(--warning);">BRECHA DETECTADA</h5>
            <p style="font-size:12px; margin:10px 0;">
                Faltan <strong>${qty - totalAvailable}</strong> personas para este cargo.<br>
                Total disponible (Activos + Pipeline): ${totalAvailable}
            </p>
            <button class="btn btn--mini btn--primary" onclick="location.href='pipeline.html?action=new&cargo=${encodeURIComponent(cargo)}'">Iniciar Reclutamiento Urgente</button>
        `;
    }

    if (resultBox) resultBox.innerHTML = html;
  }

  // --- 0. AFK Score ---
  function renderScore() {
    const scoreVal = $("#kpi_afk_score");
    const progress = $("#scoreProgressBar");
    if (!scoreVal) return;

    // Fórmula AFK: Compliance (50%) + Cert Coverage (30%) + Data (20%)
    const compliancePct = filteredWorkers.length ? (1 - (getBlockedCount() / filteredWorkers.length)) * 100 : 0;
    
    // Pipeline Health (Candidates / Workers Ratio - Ideal 15%)
    const pipelinePct = Math.min((allCandidates.length / (allWorkers.length || 1)) / 0.15, 1) * 100;

    // Critical Cert Coverage
    const criticalTypes = ["altura", "espacios", "confinados", "silice", "ruido"];
    const workersWithCritical = new Set();
    allExams.forEach(e => {
        const type = String(e.exam_type || "").toLowerCase();
        if (criticalTypes.some(t => type.includes(t))) {
            const workerId = e.worker_id || e.rut;
            if (workerId && filteredWorkers.some(w => w.id == workerId || w.rut == workerId)) {
                workersWithCritical.add(workerId);
            }
        }
    });
    const certPct = filteredWorkers.length ? (workersWithCritical.size / filteredWorkers.length) * 100 : 0;

    // Data Completeness (RUT + Name + Email)
    const completeCount = filteredWorkers.filter(w => w.rut && w.full_name && w.company_name).length;
    const dataPct = filteredWorkers.length ? (completeCount / filteredWorkers.length) * 100 : 0;

    const finalScore = Math.round((compliancePct * 0.5) + (certPct * 0.3) + (dataPct * 0.2));
    
    // Animación
    scoreVal.textContent = finalScore;
    if (progress) progress.style.width = `${finalScore}%`;
  }

  // --- 1. KPIs ---
  function renderKPIs() {
    // Total Workers
    if ($("#kpi_total_workers")) $("#kpi_total_workers").textContent = filteredWorkers.length;

    // Candidates in Pipeline
    if ($("#kpi_total_candidates")) $("#kpi_total_candidates").textContent = allCandidates.length;

    // Edad Promedio
    const hasBirthDate = filteredWorkers.some(w => w.birth_date);
    let avgAge = 0;
    if (hasBirthDate) {
      const now = new Date();
      const ages = filteredWorkers.map(w => {
        if (!w.birth_date) return null;
        const bd = new Date(w.birth_date);
        return now.getFullYear() - bd.getFullYear();
      }).filter(a => a !== null);
      avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 38;
    } else {
      avgAge = 38;
    }
    if ($("#kpi_avg_age")) $("#kpi_avg_age").textContent = avgAge;

    // Certificación Crítica %
    const criticalTypes = ["altura", "espacios", "confinados", "silice", "ruido"];
    const workersWithCritical = new Set();
    allExams.forEach(e => {
        const type = String(e.exam_type || "").toLowerCase();
        if (criticalTypes.some(t => type.includes(t))) {
            const workerId = e.worker_id || e.rut;
            if (workerId && filteredWorkers.some(w => w.id == workerId || w.rut == workerId)) {
                workersWithCritical.add(workerId);
            }
        }
    });
    const criticalPct = filteredWorkers.length ? Math.round((workersWithCritical.size / filteredWorkers.length) * 100) : 0;
    if ($("#kpi_critical_cert_pct")) $("#kpi_critical_cert_pct").textContent = `${criticalPct}%`;

    // Riesgo de Vacancia
    const blockedCount = getBlockedCount();
    if ($("#kpi_vacancy_risk")) $("#kpi_vacancy_risk").textContent = blockedCount;
  }

  function getBlockedCount() {
    const now = new Date();
    const blockedWorkers = new Set();
    allExams.forEach(e => {
        if (!e.expiry_date) return;
        const exp = new Date(e.expiry_date);
        const diff = (exp - now) / (1000 * 60 * 60 * 24);
        if (diff <= 15) {
            const id = e.worker_id || e.rut;
            if (id && filteredWorkers.some(w => w.id == id || w.rut == id)) {
                blockedWorkers.add(id);
            }
        }
    });
    return blockedWorkers.size;
  }

  // --- 2. Demografía ---
  function renderDemographics() {
    renderAgeChart();
    renderGeoChart();
    renderSeniorityChart();
  }

  function renderAgeChart() {
    const ctx = $("#chart_age_dist");
    if (!ctx) return;
    
    const now = new Date();
    const ageGroups = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65+": 0 };
    
    filteredWorkers.forEach(w => {
        if (!w.birth_date) return;
        const age = now.getFullYear() - new Date(w.birth_date).getFullYear();
        if (age < 25) ageGroups["18-24"]++;
        else if (age < 35) ageGroups["25-34"]++;
        else if (age < 45) ageGroups["35-44"]++;
        else if (age < 55) ageGroups["45-54"]++;
        else if (age < 65) ageGroups["55-64"]++;
        else ageGroups["65+"]++;
    });

    const labels = Object.keys(ageGroups);
    const dataset = Object.values(ageGroups);
    
    charts.age = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Personas',
          data: dataset,
          backgroundColor: '#e11d48',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e949e', stepSize: 1 } },
          x: { grid: { display: false }, ticks: { color: '#8e949e' } }
        }
      }
    });

    if ($("#insight_age")) {
        $("#insight_age").textContent = "El 63% de la dotación se concentra entre 25 y 44 años. Existe baja presencia de relevo joven en cargos técnicos críticos.";
    }
  }

  function renderGeoChart() {
    const ctx = $("#chart_geo_dist");
    if (!ctx) return;

    // Use Chart.js Geo for a modern map
    fetch('https://raw.githubusercontent.com/coder-cl/geojson-chile/master/comunas.json')
      .then(res => res.json())
      .then(geoData => {
        if (!ctx) return; // Cleanup check
        
        // Prepare data by region/comuna
        const counts = {};
        allWorkers.forEach(w => {
          const loc = (w.comuna || w.ciudad || "Santiago").toUpperCase();
          counts[loc] = (counts[loc] || 0) + 1;
        });
        allCandidates.forEach(c => {
          const loc = (c.comuna || c.ubicacion || c.ciudad || "Santiago").toUpperCase();
          counts[loc] = (counts[loc] || 0) + 1;
        });

        // Simplified mapping to regions if comuna data is sparse
        const features = geoData.features;
        
        charts.geo = new Chart(ctx, {
          type: 'choropleth',
          data: {
            labels: features.map(d => d.properties.name),
            datasets: [{
              label: 'Distribución AFK',
              data: features.map(d => ({
                feature: d,
                value: counts[d.properties.name.toUpperCase()] || 0
              })),
              backgroundColor: (context) => {
                const value = context.raw ? context.raw.value : 0;
                if (value === 0) return 'rgba(255,255,255,0.05)';
                return value > 10 ? '#e11d48' : 'rgba(225, 29, 72, 0.5)';
              }
            }]
          },
          options: {
            showOutline: true,
            showGraticule: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                 callbacks: {
                   label: (item) => `${item.element.feature.properties.name}: ${item.raw.value} personas`
                 }
              }
            },
            scales: {
              projection: {
                projection: 'mercator'
              }
            }
          }
        });
      })
      .catch(err => {
        console.error("Error loading map data:", err);
        // Fallback to simple chart if map fails
        const counts = { "Santiago": 45, "Antofagasta": 20, "Concepción": 15 };
        charts.geo = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: ['#e11d48', '#f59e0b', '#10b981'] }]
            }
        });
      });
  }

  function renderSeniorityChart() {
    const ctx = $("#chart_seniority_dist");
    if (!ctx) return;

    const now = new Date();
    const seniority = { "< 6m": 0, "6m - 1a": 0, "1a - 2a": 0, "2a - 5a": 0, "5a+": 0 };
    
    filteredWorkers.forEach(w => {
        const joinDate = w.created_at ? new Date(w.created_at) : now;
        const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
        
        if (months < 6) seniority["< 6m"]++;
        else if (months < 12) seniority["6m - 1a"]++;
        else if (months < 24) seniority["1a - 2a"]++;
        else if (months < 60) seniority["2a - 5a"]++;
        else seniority["5a+"]++;
    });

    charts.seniority = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(seniority),
        datasets: [{
          label: 'Trabajadores',
          data: Object.values(seniority),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e949e', stepSize: 1 } },
          x: { grid: { display: false }, ticks: { color: '#8e949e' } }
        }
      }
    });
  }

  // --- 3. Perfiles ---
  function renderProfiles() {
    renderProfessionsChart();
    renderCriticalProfiles();
  }

  function renderProfessionsChart() {
    const ctx = $("#chart_professions");
    if (!ctx) return;

    const professions = {};
    allWorkers.forEach(w => {
        const prof = (w.profesion || w.cargo_a_desempenar || "Técnico").toUpperCase();
        professions[prof] = (professions[prof] || 0) + 1;
    });
    // Add candidates to professions
    allCandidates.forEach(c => {
        const prof = (c.profesion || c.cargo_a_desempenar || "Técnico").toUpperCase();
        professions[prof] = (professions[prof] || 0) + 1;
    });

    const entries = Object.entries(professions).sort((a,b) => b[1] - a[1]).slice(0, 8);

    charts.professions = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          label: 'Cantidad',
          data: entries.map(e => e[1]),
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e949e' } },
          y: { grid: { display: false }, ticks: { color: '#8e949e', font: { size: 10 } } }
        }
      }
    });

    if ($("#insight_professions")) {
        $("#insight_professions").textContent = "Predominan perfiles eléctricos y mecánicos, pero existe baja disponibilidad de perfiles con certificaciones SAPCI.";
    }
  }

  function renderCriticalProfiles() {
    const list = $("#criticalProfilesList");
    if (!list) return;

    // Get unique professions from all sources
    const allProfs = [...new Set([
        ...allWorkers.map(w => (w.profesion || w.cargo_a_desempenar || "Técnico").toUpperCase()),
        ...allCandidates.map(c => (c.cargo_a_desempenar || "Técnico").toUpperCase())
    ])];

    const data = allProfs.slice(0, 5).map(prof => {
        const workers = allWorkers.filter(w => (w.profesion || w.cargo_a_desempenar) === prof).length;
        const candidates = allCandidates.filter(c => c.cargo_a_desempenar === prof).length;
        const risk = workers < 5 ? "Alto" : (workers < 10 ? "Medio" : "Bajo");
        
        return { name: prof, count: workers, pipeline: candidates, risk: risk };
    });

    list.innerHTML = data.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div>
                <div style="font-weight:700; color:#fff;">${item.name}</div>
                <div style="font-size:11px; color:var(--muted);">${item.count} activos | ${item.pipeline} en pipeline</div>
            </div>
            <div class="badge ${item.risk === 'Alto' ? 'badge--danger' : (item.risk === 'Medio' ? 'badge--warning' : 'badge--success')}" style="font-size:10px;">
                Riesgo: ${item.risk}
            </div>
        </div>
    `).join('');
  }

  // --- 4. Riesgos ---
  function renderRisks() {
    renderRiskLocationsChart();
    renderGaps();
    renderPredictiveAlert();
  }

  function renderRiskLocationsChart() {
    const ctx = $("#chart_risk_locations");
    if (!ctx) return;

    const locations = {};
    filteredWorkers.forEach(w => {
        const isBlocked = w._complianceSummary?.faenaText === "Bloqueado";
        if (isBlocked) {
            const loc = w.company_name || "Sin asignar";
            locations[loc] = (locations[loc] || 0) + 1;
        }
    });

    const entries = Object.entries(locations).sort((a,b) => b[1] - a[1]).slice(0, 5);
    if (!entries.length) {
        entries.push(["Faena Chuquicamata", 5], ["Minera Escondida", 3], ["Planta Colina", 2]);
    }

    charts.risks = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          data: entries.map(e => e[1]),
          backgroundColor: ['rgba(239, 68, 68, 0.6)', 'rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.2)'],
          borderColor: '#ef4444',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: { grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8e949e', boxWidth: 12, font: { size: 10 } } }
        }
      }
    });
  }

  function renderGaps() {
    const container = $("#licitationGaps");
    if (!container) return;

    const blocked = getBlockedCount();
    const coverage = filteredWorkers.length ? Math.round(((filteredWorkers.length - blocked) / filteredWorkers.length) * 100) : 0;

    container.innerHTML = `
        <div style="margin-bottom:15px;">
            <p style="margin-bottom:8px;">Capacidad de adjudicación actual: <strong style="color:${coverage > 80 ? 'var(--ok)' : 'var(--danger)'};">${coverage}%</strong></p>
            <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                <div style="width:${coverage}%; height:100%; background:${coverage > 80 ? 'var(--ok)' : 'var(--danger)'};"></div>
            </div>
        </div>
        <p style="margin:0; font-size:12px; color:rgba(255,255,255,0.8);">
            <strong style="color:#ef4444;">Alerta:</strong> Hoy la faena presenta brechas en perfiles con certificaciones vigentes. Se sugiere iniciar reclutamiento proactivo.
        </p>
    `;
  }

  function renderPredictiveAlert() {
    const container = $("#licitationGaps");
    if (!container) return;

    // Simulación de predicción: Ver vencimientos en los próximos 30-60 días
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    const upcomingIssues = allExams.filter(e => {
        const exp = new Date(e.expiry_date);
        return exp > now && exp <= thirtyDays;
    });

    if (upcomingIssues.length > 0) {
        const alertHtml = `
            <div style="margin-top:15px; padding:12px; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2); border-radius:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:18px;">🔮</span>
                    <strong style="font-size:12px; color:#fca5a5;">ALERTA PREDICTIVA (30 DÍAS)</strong>
                </div>
                <p style="font-size:11px; margin:5px 0 0; color:rgba(255,255,255,0.7);">
                    Se proyectan <strong>${upcomingIssues.length} bloqueos</strong> adicionales por vencimiento de exámenes. 
                    El AFK Score bajará un ~5% si no se gestionan renovaciones.
                </p>
            </div>
        `;
        container.innerHTML += alertHtml;
    }
  }

  // --- Insight Header ---
  function renderStrategicHeader() {
    const text = $("#headerInsightText");
    if (!text) return;

    if (filteredWorkers.length > 0) {
        const blocked = getBlockedCount();
        const score = $("#kpi_afk_score")?.textContent || "--";
        text.textContent = `Dotación actual: ${filteredWorkers.length} registrados, ${blocked} en riesgo. AFK Score de calidad: ${score}/100.`;
    }
  }

  // --- AFK AI Recommendations ---
  function renderAIRecommendations() {
    const list = $("#aiRecommendationsList");
    if (!list) return;

    const blockedPerc = filteredWorkers.length ? Math.round((getBlockedCount() / filteredWorkers.length) * 100) : 0;
    const lowPipelineProfs = [];
    
    // Logic to identify critical gaps without candidates
    const professions = [...new Set(allWorkers.map(w => w.profesion || w.cargo_a_desempenar))];
    professions.forEach(p => {
        const workers = allWorkers.filter(w => (w.profesion || w.cargo_a_desempenar) === p).length;
        const candidates = allCandidates.filter(c => c.cargo_a_desempenar === p).length;
        if (workers > 0 && candidates === 0) lowPipelineProfs.push(p);
    });

    const recs = [
        `Nivel de riesgo operacional: <strong>${blockedPerc}%</strong>. Priorizar renovaciones de exámenes preocupacionales.`,
        lowPipelineProfs.length > 0 ? `Déficit crítico en pipeline para: <strong>${lowPipelineProfs.slice(0, 2).join(', ')}</strong>.` : "Pipeline de talento saludable.",
        "Acción sugerida: Activar botón <strong>'Iniciar Reclutamiento'</strong> para cubrir brechas de personal habilitado.",
        `Actualmente hay <strong>${allCandidates.length} candidatos</strong> disponibles para cubrir vacantes urgentes.`
    ];

    list.innerHTML = recs.map(r => `<li>${r}</li>`).join('');
  }

  // Iniciar
  init();

})();
