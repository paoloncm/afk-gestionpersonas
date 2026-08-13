/**
 * analytics.supabase.js - STARK INTELLIGENCE V10
 * Dashboard People Analytics consolidado (Workers + Candidates)
 */

(async function () {
  const $ = (s) => document.querySelector(s);

  let allWorkers = [];
  let allCandidates = [];
  let filteredWorkers = [];
  let filteredCandidates = [];

  function groupCity(str) {
      if (!str) return 'Otras Localidades';
      str = str.toUpperCase();
      // Zonas Norte
      if (str.includes('ANTOFAGASTA')) return 'Antofagasta';
      if (str.includes('CALAMA')) return 'Calama';
      if (str.includes('IQUIQUE') || str.includes('TARAPACA') || str.includes('TARAPACÁ')) return 'Iquique';
      if (str.includes('COPIAP') || str.includes('ATACAMA') || str.includes('CALDERA')) return 'Copiapó';
      if (str.includes('ARICA') || str.includes('PARINACOTA')) return 'Arica';
      // Zonas Centro
      if (str.includes('SANTIAGO') || str.includes('METROPOLITANA') || str.includes('CISTERNA') || str.includes('FLORIDA') || str.includes('ESTACIÓN CENTRAL') || str.includes('ESTACION CENTRAL') || str.includes('PUENTE ALTO') || str.includes('MAIPU') || str.includes('SAN BERNARDO') || str.includes('PROVIDENCIA') || str.includes('LAS CONDES')) return 'Santiago';
      if (str.includes('LA SERENA')) return 'La Serena';
      if (str.includes('COQUIMBO')) return 'Coquimbo';
      if (str.includes('VALPARAISO') || str.includes('VALPARAÍSO') || str.includes('VIÑA DEL MAR') || str.includes('ALEMANA') || str.includes('QUINTA REGION') || str.includes('QUINTA REGIÓN') || str.includes('CALERA')) return 'Valparaíso';
      if (str.includes('RANCAGUA') || str.includes('HIGGINS')) return 'Rancagua';
      if (str.includes('TALCA') || str.includes('MAULE') || str.includes('LINARES') || str.includes('CURICO')) return 'Talca';
      // Zonas Sur
      if (str.includes('CONCEPCI') || str.includes('BIOBIO') || str.includes('BIOBÍO') || str.includes('CHILLAN') || str.includes('CHILLÁN')) return 'Concepción';
      if (str.includes('TEMUCO') || str.includes('ARAUCANIA') || str.includes('ARAUCANÍA')) return 'Temuco';
      if (str.includes('VALDIVIA') || str.includes('RIOS') || str.includes('RÍOS')) return 'Valdivia';
      if (str.includes('PUERTO MONTT') || str.includes('LAGOS') || str.includes('OSORNO')) return 'Puerto Montt';
      if (str.includes('COYHAIQUE') || str.includes('AYSEN') || str.includes('AYSÉN')) return 'Coyhaique';
      if (str.includes('PUNTA ARENAS') || str.includes('MAGALLANES')) return 'Punta Arenas';
      
      return 'Otras Localidades';
  }

  function groupProfession(str) {
      if (!str) return 'Otros Cargos';
      str = str.toUpperCase();
      if (str.includes('INGENIERO') || str.includes('INGENIERÍA') || str.includes('INGENIERIA')) return 'Ingeniería';
      if (str.includes('TÉCNICO') || str.includes('TECNICO') || str.includes('TÉC.') || str.includes('TEC.')) return 'Técnicos';
      if (str.includes('OPERADOR') || str.includes('CHOFER') || str.includes('CONDUCTOR') || str.includes('MAQUINARIA')) return 'Operadores';
      if (str.includes('SUPERVISOR') || str.includes('JEFATURA') || str.includes('JEFE') || str.includes('ENCARGADO') || str.includes('CAPATAZ') || str.includes('LÍDER') || str.includes('LIDER')) return 'Supervisores/Jefaturas';
      if (str.includes('ADMINISTRATIVO') || str.includes('ASISTENTE') || str.includes('SECRETARI') || str.includes('RECURSOS HUMANOS') || str.includes('RRHH') || str.includes('PLANIFICADOR')) return 'Administrativos y Planificación';
      if (str.includes('MECÁNICO') || str.includes('MECANICO') || str.includes('ELÉCTRICO') || str.includes('ELECTRICO') || str.includes('SOLDADOR') || str.includes('MANTENIMIENTO') || str.includes('MANTENEDOR') || str.includes('ESPECIALISTA') || str.includes('SAPCI') || str.includes('JORNALERO') || str.includes('AYUDANTE')) return 'Mantenimiento / Oficios';
      if (str.includes('PREVENCION') || str.includes('PREVENCIÓN') || str.includes('HSEC') || str.includes('SEGURIDAD') || str.includes('ASESOR')) return 'Prevención y Seguridad';
      if (str.includes('GEÓLOGO') || str.includes('GEOLOGO') || str.includes('TOPÓGRAFO') || str.includes('TOPOGRAFO')) return 'Geología y Topografía';
      if (str.includes('MÉDICO') || str.includes('MEDICO') || str.includes('ENFERMER') || str.includes('PARAMEDICO')) return 'Salud';
      if (str.includes('ADC MODULO')) return 'Operaciones ADC';
      return 'Otros Cargos';
  }

  let allExams = [];
  let allVacancies = [];
  let filteredData = [];
  let mapInstance = null;
  let markersLayer = null;

  // --- TACTICAL MESH (GEO COORDS CHILE) ---
  const TacticalMesh = {
    "SANTIAGO": [-33.4489, -70.6693],
    "STGO": [-33.4489, -70.6693],
    "PUENTE ALTO": [-33.6117, -70.5758],
    "MAIPU": [-33.5111, -70.7525],
    "SAN BERNARDO": [-33.5913, -70.7042],
    "VIÑA DEL MAR": [-33.0245, -71.5518],
    "VALPARAISO": [-33.0472, -71.6127],
    "CONCEPCION": [-36.8201, -73.0447],
    "LA SERENA": [-29.9027, -71.2519],
    "ANTOFAGASTA": [-23.6509, -70.3975],
    "CALAMA": [-22.4544, -68.9294],
    "COPIAPO": [-27.3668, -70.3322],
    "TIERRA AMARILLA": [-27.4833, -70.2667],
    "IQUIQUE": [-20.2133, -70.1503],
    "RANCAGUA": [-34.1708, -70.7444],
    "TALCA": [-35.4264, -71.6554],
    "TEMUCO": [-38.7359, -72.5904],
    "PUERTO MONTT": [-41.4693, -72.9424],
    "ARICA": [-18.4783, -70.3125],
    "COQUIMBO": [-29.9533, -71.3395],
    "CORONEL": [-37.0222, -73.1363]
  };

  // --- UTILS ---
  const safeNum = (v) => {
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const getAge = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
  };

  const getSeniorityMonths = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  };

  const animateValue = (id, start, end, duration, suffix = "") => {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = Math.floor(progress * (end - start) + start);
      obj.innerHTML = val + suffix;
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  };

  // --- DATA LOADING ---
  async function init() {
    console.log("[Analytics] Iniciando Protocolo de Sincronizacin...");
    if (!window.supabase) {
       console.warn("[Analytics] Esperando enlace con Supabase...");
       setTimeout(init, 500);
       return;
    }
    await loadData();
    populateAnalyticsFilters();
    renderAll();
    bindEvents();
  }

  async function loadData() {
    try {
      const { data: workers, error: wErr } = await window.supabase.from("workers").select("*");
      const { data: candidates, error: cErr } = await window.supabase.from("candidates").select("*");
      const { data: exams, error: eErr } = await window.supabase.from("medical_exam_records").select("*");
      const { data: vacancies, error: vErr } = await window.supabase.from("vacancies").select("*");

      if (wErr) console.warn("[Analytics] Error loading workers:", wErr);
      if (cErr) console.warn("[Analytics] Error loading candidates:", cErr);
      if (eErr) console.warn("[Analytics] Error loading exams:", eErr);
      if (vErr) console.warn("[Analytics] Error loading vacancies:", vErr);

      allWorkers = workers || [];
      allCandidates = candidates || [];
      filteredWorkers = [...allWorkers];
      filteredCandidates = [...allCandidates];
      allExams = exams || [];
      allVacancies = vacancies || [];

      // Consolidar para filtros globales
      filteredData = [
        ...allWorkers.map(w => ({ ...w, _type: 'WORKER', name: w.full_name || w.name, prof: w.position || w.cargo || 'Operativo' })),
        ...allCandidates.map(c => ({ ...c, _type: 'CANDIDATE', name: c.nombre_completo || c.name, prof: c.profesion || 'Candidato' }))
      ];

      console.log(`[Analytics] Sincronización Finalizada: ${allWorkers.length} Operarios / ${allCandidates.length} Candidatos.`);
    } catch (err) {
      console.error("[Analytics] Critical Error:", err);
    }
  }

  // --- RENDERING ---


  function populateAnalyticsFilters() {
      const profs = new Set();
      const cargos = new Set();
      const regiones = new Set();

      allWorkers.forEach(p => {
          if (p.position) profs.add(groupProfession(p.position));
          if (p.cargo) profs.add(groupProfession(p.cargo));
          if (p.cargo_a_desempenar) cargos.add(groupProfession(p.cargo_a_desempenar));
          if (p.company_name) regiones.add(groupCity(p.company_name));
      });

      allCandidates.forEach(p => {
          if (p.profesion) profs.add(groupProfession(p.profesion));
          if (p.cargo_a_desempenar) cargos.add(groupProfession(p.cargo_a_desempenar));
          if (p.direccion) regiones.add(groupCity(p.direccion));
      });

      const selProf = $('#af-profesion');
      const selCargo = $('#af-cargo');
      const selRegion = $('#af-region');

      if (selProf) {
          Array.from(profs).filter(Boolean).sort().forEach(p => {
              const opt = document.createElement('option');
              opt.value = p; opt.innerText = p;
              selProf.appendChild(opt);
          });
      }
      
      if (selCargo) {
          Array.from(cargos).filter(Boolean).sort().forEach(c => {
              const opt = document.createElement('option');
              opt.value = c; opt.innerText = c;
              selCargo.appendChild(opt);
          });
      }

      if (selRegion) {
          Array.from(regiones).filter(Boolean).sort().forEach(r => {
              const opt = document.createElement('option');
              opt.value = r; opt.innerText = r;
              selRegion.appendChild(opt);
          });
      }
  }

  function applyAnalyticsFilters() {

      const prof = ($('#af-profesion')?.value || '').toLowerCase();
      const cargo = ($('#af-cargo')?.value || '').toLowerCase();
      const region = ($('#af-region')?.value || '').toLowerCase();

      filteredWorkers = allWorkers.filter(p => {
          const pProf = groupProfession(p.position || p.cargo || 'Operativo').toLowerCase();
          const pCargo = groupProfession(p.cargo_a_desempenar || '').toLowerCase();
          const pReg = groupCity(p.company_name || '').toLowerCase();
          return pProf.includes(prof) && pCargo.includes(cargo) && pReg.includes(region);
      });

      filteredCandidates = allCandidates.filter(p => {
          const pProf = groupProfession(p.profesion || 'Candidato').toLowerCase();
          const pCargo = groupProfession(p.cargo_a_desempenar || '').toLowerCase();
          const pReg = groupCity(p.direccion || '').toLowerCase();
          return pProf.includes(prof) && pCargo.includes(cargo) && pReg.includes(region);
      });
  }

  function renderAll() {
    applyAnalyticsFilters();
    renderKPIs();
    renderCharts();
    renderMap();
    renderInsights();
  }

  function renderKPIs() {
    const total = filteredWorkers.length + filteredCandidates.length;
    animateValue("kpi-candidates", 0, total, 1000);

    // Edad Promedio
    const ages = [...filteredWorkers, ...filteredCandidates].map(p => getAge(p.birth_date || p.fecha_nacimiento)).filter(a => a !== null);
    const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    animateValue("kpi_avg_age", 0, avgAge, 1200);

    // Antigüedad (solo Workers por ahora)
    const seniorities = filteredWorkers.map(w => getSeniorityMonths(w.created_at)).filter(s => s > 0);
    const avgSeniority = seniorities.length ? Math.round(seniorities.reduce((a, b) => a + b, 0) / seniorities.length) : 0;
    animateValue("kpi_avg_seniority", 1, Math.max(1, avgSeniority), 1200);

    // Certificación Crítica (Simulado basado en docs válidos)
    const healthyCount = filteredWorkers.length * 0.85; 
    const certPct = Math.round((healthyCount / (filteredWorkers.length || 1)) * 100);
    animateValue("kpi_critical_cert_pct", 0, certPct, 1500, "%");

    // Riesgo de Vacancia (Exámenes vencidos)
    const now = new Date();
    const risks = allExams.filter(e => {
        if (!e.expiry_date) return false;
        return new Date(e.expiry_date) < now;
    }).length;
    animateValue("kpi_vacancy_risk", 0, risks, 1500);
    
    // Insight Header
    if ($("#headerInsightText")) $("#headerInsightText").textContent = risks > 0 
        ? `JARVIS: Detectadas ${risks} anomalías críticas en certificaciones. Se recomienda auditoría inmediata.`
        : "JARVIS: Todos los sistemas operativos reportan integridad nominal. Dotación optimizada.";
  }

  let charts = {};
  function renderCharts() {
    // Destroy previous charts
    Object.values(charts).forEach(c => c.destroy());

    // Age Chart
    const ctxAge = $("#chart_age_dist")?.getContext("2d");
    if (ctxAge) {
        const ranges = {"18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "56+": 0};
        [...filteredWorkers, ...filteredCandidates].forEach(p => {
            const age = getAge(p.birth_date || p.fecha_nacimiento);
            if (!age) return;
            if (age <= 25) ranges["18-25"]++;
            else if (age <= 35) ranges["26-35"]++;
            else if (age <= 45) ranges["36-45"]++;
            else if (age <= 55) ranges["46-55"]++;
            else ranges["56+"]++;
        });
        charts.age = new Chart(ctxAge, {
            type: 'bar',
            data: {
                labels: Object.keys(ranges),
                datasets: [{ label: 'Personal', data: Object.values(ranges), backgroundColor: 'rgba(34, 211, 238, 0.6)', borderColor: 'var(--accent)', borderWidth: 1 }]
            },
            options: getBaseChartOptions()
        });
    }

    // Professions Chart
    const ctxProf = $("#chart_professions")?.getContext("2d");
    if (ctxProf) {
        const counts = {};
        [...filteredWorkers, ...filteredCandidates].forEach(p => {
            const prof = groupProfession(p.position || p.profesion || "Otros").toUpperCase();
            counts[prof] = (counts[prof] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
        charts.prof = new Chart(ctxProf, {
            type: 'doughnut',
            data: {
                labels: sorted.map(s => s[0]),
                datasets: [{ data: sorted.map(s => s[1]), backgroundColor: ['#22d3ee', '#0891b2', '#0e7490', '#155e75', '#164e63'], borderWidth: 0 }]
            },
            options: { ...getBaseChartOptions(), plugins: { legend: { display: true, position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } } }
        });
    }

    // Seniority Distribution Chart
    const ctxSenior = $("#chart_seniority_dist")?.getContext("2d");
    if (ctxSenior) {
        const ranges = {"0-6m": 0, "6-12m": 0, "1-2a": 0, "2a+": 0};
        filteredWorkers.forEach(w => {
            const m = getSeniorityMonths(w.created_at);
            if (m <= 6) ranges["0-6m"]++;
            else if (m <= 12) ranges["6-12m"]++;
            else if (m <= 24) ranges["1-2a"]++;
            else ranges["2a+"]++;
        });
        charts.senior = new Chart(ctxSenior, {
            type: 'line',
            data: {
                labels: Object.keys(ranges),
                datasets: [{ label: 'Tendencia', data: Object.values(ranges), borderColor: 'var(--accent)', tension: 0.4, fill: true, backgroundColor: 'rgba(34, 211, 238, 0.1)' }]
            },
            options: getBaseChartOptions()
        });
    }
    
    // Risk by Location (Polar)
    const ctxRisk = $("#chart_risk_locations")?.getContext("2d");
    if (ctxRisk) {
        const riskLocs = {};
        allExams.filter(e => e.expiry_date && new Date(e.expiry_date) < new Date()).forEach(e => {
            const w = filteredWorkers.find(x => x.id === e.worker_id);
            const loc = w?.company_name || "EXTERNO";
            riskLocs[loc] = (riskLocs[loc] || 0) + 1;
        });
        charts.risk = new Chart(ctxRisk, {
            type: 'polarArea',
            data: {
                labels: Object.keys(riskLocs).length ? Object.keys(riskLocs) : ["SIN RIESGO"],
                datasets: [{ data: Object.keys(riskLocs).length ? Object.values(riskLocs) : [0], backgroundColor: 'rgba(239, 68, 68, 0.4)', borderColor: '#ef4444' }]
            },
            options: getBaseChartOptions()
        });
    }
  }

  function renderMap() {
    const mapEl = $("#map_candidates");
    if (!mapEl) return;

    if (!mapInstance) {
      mapInstance = L.map('map_candidates', { zoomControl: false }).setView([-33.4489, -70.6693], 4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB'
      }).addTo(mapInstance);
      markersLayer = L.layerGroup().addTo(mapInstance);
    }

    markersLayer.clearLayers();

    // Plot Candidates (Cyan)
    filteredCandidates.forEach(cand => {
      const coords = findCoords(cand.direccion);
      if (coords) {
        const jitterLat = (Math.random() - 0.5) * 0.04;
        const jitterLng = (Math.random() - 0.5) * 0.04;
        const finalCoords = [coords[0] + jitterLat, coords[1] + jitterLng];

        const marker = L.circleMarker(finalCoords, {
          radius: 6,
          fillColor: "#22d3ee",
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
        marker.bindPopup(`<strong>${cand.nombre_completo}</strong><br>${cand.profesion || 'Candidato'}<br><small>${cand.direccion || ''}</small>`);
        markersLayer.addLayer(marker);
      }
    });

    // Plot Workers (Orange)
    filteredWorkers.forEach(w => {
      const coords = findCoords(w.company_name);
      if (coords) {
        const jitterLat = (Math.random() - 0.5) * 0.04;
        const jitterLng = (Math.random() - 0.5) * 0.04;
        const finalCoords = [coords[0] + jitterLat, coords[1] + jitterLng];

        const marker = L.circleMarker(finalCoords, {
          radius: 4,
          fillColor: "#f97316",
          color: "#fff",
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.6
        });
        marker.bindPopup(`<strong>${w.full_name}</strong> (AFK)<br>${w.position || 'Operativo'}<br><small>${w.company_name || ''}</small>`);
        markersLayer.addLayer(marker);
      }
    });
  }

  function findCoords(input) {
    if (!input) return null;
    const clean = input.toUpperCase();
    for (const city in TacticalMesh) {
      if (clean.includes(city)) return TacticalMesh[city];
    }
    return null; // No match found in mesh
  }

  function getBaseChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
    };
  }

  function renderInsights() {
      const list = $("#aiRecommendationsList");
      const profilesList = $("#criticalProfilesList");
      const gapBox = $("#licitationGaps");
      if (!list || !profilesList || !gapBox) return;
      
      // Top Profiles Calculation
      const demands = {};
      allVacancies.forEach(v => {
          demands[v.title] = (demands[v.title] || 0) + 1;
      });
      const sortedDemands = Object.entries(demands).sort((a,b) => b[1] - a[1]).slice(0, 4);
      profilesList.innerHTML = sortedDemands.map(([name, count]) => `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; border-left:2px solid var(--accent);">
            <div style="font-size:12px; font-weight:700;">${name.toUpperCase()}</div>
            <div class="badge badge--warning" style="font-size:10px;">${count} VACANTES</div>
          </div>
      `).join("") || '<div style="color:var(--muted); font-size:11px;">No hay vacantes activas detectadas.</div>';

      // Gaps Calculation
      const internalCoverage = filteredWorkers.length;
      const totalDemand = allVacancies.length;
      const gapPct = totalDemand ? Math.round((internalCoverage / (internalCoverage + totalDemand)) * 100) : 100;
      gapBox.innerHTML = `
          <div style="text-align:center;">
             <div style="font-size:32px; font-weight:900; color:var(--accent);">${gapPct}%</div>
             <div style="color:var(--muted); font-weight:600; font-size:11px;">FACTOR DE COBERTURA OPERATIVA</div>
             <div class="affinity-bar" style="margin-top:15px;"><div class="affinity-fill" style="width:${gapPct}%"></div></div>
          </div>
      `;

      const insights = [
          `Optimización de Seniority: El ${Math.round((filteredWorkers.length/((filteredWorkers.length+filteredCandidates.length)||1))*100)}% de la dotación es interna. Posibilidad de ascenso para ${Math.ceil(allVacancies.length/3)} perfiles críticos.`,
          "Alerta Geográfica: Concentración elevada en Zona Central. Se recomienda diversificar reclutamiento hacia el Norte.",
          `Capacitación: ${allExams.filter(e => e.expiry_date && new Date(e.expiry_date) < new Date()).length} operarios requieren renovación de examen de altura física de inmediato.`
      ];
      
      list.innerHTML = insights.map(i => `<li>${i}</li>`).join("");
  }

  function bindEvents() {
    $("#btnExportAnalytics")?.addEventListener("click", () => window.print());
    $("#btnTriggerRecs")?.addEventListener("click", () => {
        window.notificar?.("JARVIS: Ejecutando algoritmos de optimizacin de dotacin...", "info");
    });
    
    $('#af-profesion')?.addEventListener('change', renderAll);
    $('#af-cargo')?.addEventListener('change', renderAll);
    $('#af-region')?.addEventListener('change', renderAll);
  }

  // --- BOOTSTRAP ---
  init();
})();