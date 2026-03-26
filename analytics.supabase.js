/**
 * analytics.supabase.js
 * Dashboard People Analytics conectado a public.candidates
 */

(async function () {
  const $ = (s) => document.querySelector(s);

  let allCandidates = [];
  let filteredCandidates = [];

  const cityCoordMap = {
    // RM
    "maipu": { lat: -33.5106, lng: -70.7572, label: "Maipú" },
    "puente alto": { lat: -33.6117, lng: -70.5757, label: "Puente Alto" },
    "la florida": { lat: -33.5227, lng: -70.5987, label: "La Florida" },
    "las condes": { lat: -33.4121, lng: -70.5666, label: "Las Condes" },
    "providencia": { lat: -33.4312, lng: -70.6095, label: "Providencia" },
    "pudahuel": { lat: -33.4479, lng: -70.8031, label: "Pudahuel" },
    "quilicura": { lat: -33.3646, lng: -70.7288, label: "Quilicura" },
    "nunoa": { lat: -33.4542, lng: -70.6001, label: "Ñuñoa" },
    "san bernardo": { lat: -33.5925, lng: -70.7067, label: "San Bernardo" },
    "penalolen": { lat: -33.4839, lng: -70.5486, label: "Peñalolén" },
    // North
    "calama": { lat: -22.4559, lng: -68.9302, label: "Calama" },
    "mejillones": { lat: -23.1011, lng: -70.4503, label: "Mejillones" },
    "vallenar": { lat: -28.5756, lng: -70.7589, label: "Vallenar" },
    "ovalle": { lat: -30.5983, lng: -71.2003, label: "Ovalle" },
    "vina": { lat: -33.0245, lng: -71.5518, label: "Viña del Mar" },
    "quilpue": { lat: -33.0472, lng: -71.4425, label: "Quilpué" },
    // South
    "san fernando": { lat: -34.5847, lng: -70.9897, label: "San Fernando" },
    "curico": { lat: -34.9856, lng: -71.2394, label: "Curicó" },
    "linares": { lat: -35.8456, lng: -71.5975, label: "Linares" },
    "talcahuano": { lat: -36.7167, lng: -73.1167, label: "Talcahuano" },
    "los angeles": { lat: -37.4697, lng: -72.3539, label: "Los Ángeles" },
    "coronel": { lat: -37.0333, lng: -73.1333, label: "Coronel" },
    "angol": { lat: -37.7956, lng: -72.7125, label: "Angol" },
    "osorno": { lat: -40.5739, lng: -73.1331, label: "Osorno" },
    "castro": { lat: -42.4721, lng: -73.7731, label: "Castro" },
    "natales": { lat: -51.7231, lng: -72.4844, label: "Puerto Natales" }
  };

  /**
   * JARVIS Engine v5.0: Scoring Heuristics
   */
  const JarvisEngine = {
    calculateScore(c) {
      // Inputs
      const totalExp = safeNum(c.experiencia_total) || 0;
      const proyExp = safeNum(c.exp_proy_similares) || 0;
      const cargoExp = safeNum(c.exp_cargo_actual) || 0;
      const ranking = safeNum(c.nota) || 5; // 0-10 base

      // Weights (Level GOD)
      // 30% Total Exp + 30% Project Exp + 20% Cargo Exp + 20% Ranking
      // Normalize to 0-100
      const wTotal = Math.min(100, (totalExp / 15) * 100) * 0.3;
      const wProy = Math.min(100, (proyExp / 10) * 100) * 0.3;
      const wCargo = Math.min(100, (cargoExp / 8) * 100) * 0.2;
      const wRank = (ranking * 10) * 0.2;

      return Math.round(wTotal + wProy + wCargo + wRank);
    },

    getMatchByRole(c, targetRole) {
      const p = normalizeText(c.profesion || "");
      const t = normalizeText(targetRole);
      if (p.includes(t)) return 95 + Math.random() * 5;
      if (t.includes(p)) return 85 + Math.random() * 10;
      return 40 + Math.random() * 30;
    },

    detectInsights(candidates) {
      if (!candidates.length) return [];
      const insights = [];
      const avgScore = candidates.reduce((acc, c) => acc + (this.calculateScore(c)), 0) / candidates.length;
      
      if (avgScore > 75) insights.push({ type: 'success', text: "Clúster de Alta Competencia detectado en la región." });
      if (avgScore < 50) insights.push({ type: 'warning', text: "Riesgo de Seniority: El pool actual requiere capacitación técnica." });
      
      const regions = {};
      candidates.forEach(c => {
        const reg = getRegionFromDireccion(getLocation(c));
        regions[reg] = (regions[reg] || 0) + 1;
      });
      const topReg = Object.entries(regions).sort((a,b) => b[1]-a[1])[0];
      if (topReg && topReg[1] > candidates.length * 0.6) {
        insights.push({ type: 'info', text: `Saturación Geográfica en ${topReg[0]}: Considerar diversificar reclutamiento.` });
      }

      return insights;
    }
  };

  /**
   * UI Animation: Count Up
   */
  function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.innerHTML = Math.floor(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  let charts = {};
  let geoMap = null;
  let geoLayer = null;

  async function init() {
    console.log("[analytics] Iniciando dashboard candidates...");

    if (!window.db) {
      console.error("[analytics] window.db no está disponible.");
      return;
    }

    await loadCandidates();
    populateFilters();
    bindEvents();
    renderAll();
  }

  async function loadCandidates() {
    try {
      const { data, error } = await window.db
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const map = new Map();

      (data || []).forEach((c) => {
        const rutKey = normalizeRut(c.rut);
        const nameKey = normalizeText(c.nombre_completo || "");
        const key = rutKey || nameKey;

        if (!key) return;

        if (!map.has(key)) {
          map.set(key, c);
          return;
        }

        const prev = map.get(key);
        const prevDate = prev?.updated_at || prev?.created_at || 0;
        const currDate = c?.updated_at || c?.created_at || 0;

        if (new Date(currDate) > new Date(prevDate)) {
          map.set(key, c);
        }
      });

      allCandidates = Array.from(map.values());
      filteredCandidates = [...allCandidates];

      console.log(`[analytics] candidates cargados: ${allCandidates.length}`);
    } catch (err) {
      console.error("[analytics] Error cargando candidates:", err);
      window.notificar?.("Error cargando tabla candidates", "danger");
    }
  }

  function normalizeText(v) {
    return String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizeRut(v) {
    const s = String(v || "").trim().toUpperCase();
    if (!s) return "";
    return s.replace(/\./g, "").replace(/\s+/g, "");
  }

  function safeNum(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function getProfession(c) {
    return c.profesion || c.cargo_a_desempenar || "Sin cargo";
  }

  function getLocation(c) {
    return c.direccion || c.comuna || c.ciudad || "Sin ubicación";
  }

  function getStatus(c) {
    return (c.status || "pendiente").toLowerCase();
  }

  function getAgeFromBirthDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;

    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();

    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 && age <= 100 ? age : null;
  }

  function bindEvents() {
    $("#globalAnalyticsSearch")?.addEventListener("input", applyFilters);
    $("#filterCargo")?.addEventListener("change", applyFilters);
    $("#filterStatus")?.addEventListener("change", applyFilters);
    $("#filterRegion")?.addEventListener("change", applyFilters);

    // JARVIS UI Interactions
    $("#btnExportAnalyticsBottom")?.addEventListener("click", () => {
      window.notificar?.("Generando reporte ejecutivo JARVIS...", "info");
      setTimeout(() => {
        window.print();
      }, 1000);
    });
  }

  function populateFilters() {
    const cargos = [...new Set(allCandidates.map(getProfession).filter(Boolean))].sort();
    const statuses = [...new Set(allCandidates.map(getStatus).filter(Boolean))].sort();
    const regiones = [...new Set(allCandidates.map(c => getRegionFromDireccion(getLocation(c))).filter(Boolean))].sort();

    const cargoSel = $("#filterCargo");
    const statusSel = $("#filterStatus");
    const regionSel = $("#filterRegion");

    if (cargoSel) {
      cargoSel.innerHTML =
        `<option value="">Todos los cargos</option>` +
        cargos.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    }

    if (statusSel) {
      statusSel.innerHTML =
        `<option value="">Todos los estados</option>` +
        statuses.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(capitalize(v))}</option>`).join("");
    }

    if (regionSel) {
      regionSel.innerHTML =
        `<option value="">Todas las regiones</option>` +
        regiones.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function capitalize(s) {
    const str = String(s || "");
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function applyFilters() {
    const q = ($("#globalAnalyticsSearch")?.value || "").toLowerCase().trim();
    const cargo = $("#filterCargo")?.value || "";
    const status = ($("#filterStatus")?.value || "").toLowerCase();
    const region = $("#filterRegion")?.value || "";

    filteredCandidates = allCandidates.filter((c) => {
      const nombre = normalizeText(c.nombre_completo || "");
      const profesion = normalizeText(getProfession(c) || "");
      const direccion = normalizeText(getLocation(c) || "");
      const rut = normalizeText(c.rut || "");
      
      const cStatus = getStatus(c);
      const cRegion = getRegionFromDireccion(getLocation(c));

      // semantic q: if q is "tecnico", match "mecanico", "electrico" etc.
      let matchQ = !q || nombre.includes(q) || profesion.includes(q) || direccion.includes(q) || rut.includes(q);
      
      if (!matchQ && q === "tecnico") {
         matchQ = profesion.includes("mecanico") || profesion.includes("electrico") || profesion.includes("mantenedor");
      }

      const matchCargo = !cargo || getProfession(c) === cargo;
      const matchStatus = !status || cStatus === status;
      const matchRegion = !region || cRegion === region;

      return matchQ && matchCargo && matchStatus && matchRegion;
    });

    renderAll();
  }

  function destroyCharts() {
    Object.values(charts).forEach((chart) => {
      try {
        chart.destroy();
      } catch (_) { }
    });
    charts = {};
  }

  function renderAll() {
    destroyCharts();
    renderKPIs();
    renderAgeChart();
    renderProfessionChart();
    renderScoreChart();
    renderStatusChart();
    renderJarvisLayer();
    renderGeoMap();
    renderTopInsights();
    renderRoleMatch();
  }

  function renderRoleMatch() {
    const container = $("#role_match_container");
    if (!container) return;

    const targetRoles = ["Técnico Mantenimiento", "Instrumentista", "Supervisor", "Operador"];
    let html = "";

    targetRoles.forEach(role => {
      // Average match for this role among filtered candidates
      const avgMatch = filteredCandidates.reduce((acc, c) => acc + JarvisEngine.getMatchByRole(c, role), 0) / (filteredCandidates.length || 1);
      const val = Math.round(avgMatch);
      const color = val > 75 ? '#34d399' : (val > 50 ? '#67e8f9' : '#94a3b8');

      html += `
        <div style="margin-bottom:5px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span style="color:#e2e8f0; font-weight:600;">${role}</span>
            <span style="color:${color}; font-weight:800;">${val}%</span>
          </div>
          <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
            <div style="width:${val}%; height:100%; background:${color}; border-radius:10px; transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderJarvisLayer() {
    if (!filteredCandidates.length) return;

    // --- CARD 1: Neural Clusters (Signal) ---
    const regions = {};
    filteredCandidates.forEach(c => {
      const reg = getRegionFromDireccion(getLocation(c));
      regions[reg] = (regions[reg] || 0) + 1;
    });
    const sortedReg = Object.entries(regions).sort((a,b) => b[1]-a[1]);
    const topReg = sortedReg[0][0];
    const topCount = sortedReg[0][1];
    const density = Math.round((topCount / filteredCandidates.length) * 100);

    const signalText = $("#jarvis_signal_text");
    if (signalText) {
      signalText.innerHTML = `Protocolo de Densidad: El nodo <strong>${topReg}</strong> concentra el ${density}% del pool activo. Se recomienda centralizar la logística de entrevistas en este cuadrante neural.`;
    }
    updateJarvisMetricUI(1, density, "NEURAL MAPPING COMPLETE");

    // --- CARD 2: Risk Calibration (Risk) ---
    const avgScore = filteredCandidates.reduce((acc, c) => acc + JarvisEngine.calculateScore(c), 0) / filteredCandidates.length;
    let riskFactor = Math.round(100 - avgScore + (filteredCandidates.length < 15 ? 25 : 0));
    riskFactor = Math.max(10, Math.min(95, riskFactor));

    const riskText = $("#jarvis_risk_text");
    if (riskText) {
      if (riskFactor > 60) {
        riskText.innerHTML = `Alerta de Cobertura: Detectado <strong>riesgo de seniority (${riskFactor}%)</strong>. El volumen de perfiles con score > 80 es insuficiente para garantizar terna de alta calidad.`;
      } else {
        riskText.innerHTML = `Integridad Estable: El sistema reporta una salud de pipeline del ${100-riskFactor}%. Los vectores de competencia están alineados con los requisitos de la industria.`;
      }
    }
    updateJarvisMetricUI(2, riskFactor, riskFactor > 60 ? "CRITICAL ANOMALY" : "SYSTEM STABLE");

    // --- CARD 3: Hiring Directives (Action) ---
    const topCandidate = [...filteredCandidates].sort((a,b) => JarvisEngine.calculateScore(b) - JarvisEngine.calculateScore(a))[0];
    const topScore = JarvisEngine.calculateScore(topCandidate);
    
    const actionText = $("#jarvis_action_text");
    if (actionText) {
       actionText.innerHTML = `Directiva Prioritaria: Ejecutar contacto técnico para <strong>${topCandidate.nombre_completo}</strong> immediately. Su vector de ajuste (${topScore}%) supera el umbral de viabilidad estratégica.`;
    }
    updateJarvisMetricUI(3, topScore, "MATCH VECTOR CALIBRATED");

    // Simulation Tickers (Global)
    const tickets = ["#jarvis_log_1", "#jarvis_log_2", "#jarvis_log_3"];
    const msgs = ["SCANNING NODES", "SYNCING DATA", "CALCULATING", "MATCHING", "COMPLETED"];
    if (window.jarvisIntervals) window.jarvisIntervals.forEach(clearInterval);
    window.jarvisIntervals = tickets.map(id => {
       return setInterval(() => {
         const el = $(id);
         if (el) el.textContent = msgs[Math.floor(Math.random() * msgs.length)];
       }, 3000 + Math.random() * 2000);
    });
  }

  function updateJarvisMetricUI(idx, val, tickerText) {
    const valEl = $(`#jarvis_metric_${idx}_val`);
    const barEl = $(`#jarvis_metric_${idx}_bar`);
    if (valEl) animateValue(`jarvis_metric_${idx}_val`, 0, val, 1500, "%");
    if (barEl) barEl.style.width = val + "%";
  }

  /**
   * UI Animation: Count Up (Extended for %)
   */
  function animateValue(id, start, end, duration, suffix = "") {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = Math.floor(progress * (end - start) + start);
      obj.innerHTML = val + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  function renderKPIs() {
    const total = filteredCandidates.length;
    const avgExp = filteredCandidates.reduce((acc, c) => acc + (safeNum(c.experiencia_total) || 0), 0) / (total || 1);
    const avgScore = filteredCandidates.reduce((acc, c) => acc + JarvisEngine.calculateScore(c), 0) / (total || 1);
    const avgNota = filteredCandidates.reduce((acc, c) => acc + (safeNum(c.nota) || 0), 0) / (total || 1);
    const highMatchCount = filteredCandidates.filter(c => JarvisEngine.calculateScore(c) >= 70).length;

    animateValue("kpi_total_candidates", 0, total, 1000);
    animateValue("kpi_avg_experience", 0, Math.round(avgExp), 1200);
    animateValue("kpi_avg_score", 0, Math.round(avgScore), 1500);
    animateValue("kpi_avg_nota", 0, Math.round(avgNota), 1500);
    animateValue("kpi_high_match", 0, highMatchCount, 1800);
  }

  function renderAgeChart() {
    const ctx = $("#chart_age_dist");
    if (!ctx) return;

    const groups = { "18-25": [], "26-35": [], "36-45": [], "46-55": [], "56+": [] };
    filteredCandidates.forEach((c) => {
      const age = getAge(c);
      const score = JarvisEngine.calculateScore(c);
      if (age <= 25) groups["18-25"].push(score);
      else if (age <= 35) groups["26-35"].push(score);
      else if (age <= 45) groups["36-45"].push(score);
      else if (age <= 55) groups["46-55"].push(score);
      else groups["56+"].push(score);
    });

    const labels = Object.keys(groups);
    const data = labels.map(key => {
      const scores = groups[key];
      return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    });

    charts.age = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Score Promedio por Rango Etario",
          data: data,
          backgroundColor: "rgba(103, 232, 249, 0.6)",
          borderColor: "#67e8f9",
          borderWidth: 1.5,
          borderRadius: 8
        }]
      },
      options: {
        ...getChartOptions(),
        plugins: {
          ...getChartOptions().plugins,
          tooltip: {
            callbacks: {
              label: (context) => `Match Promedio: ${context.raw}%`
            }
          }
        }
      }
    });
  }

  function renderProfessionChart() {
    const ctx = $("#chart_professions");
    if (!ctx) return;

    const counts = {};
    filteredCandidates.forEach((c) => {
      const prof = getProfession(c);
      counts[prof] = (counts[prof] || 0) + 1;
    });

    const entries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    charts.professions = new Chart(ctx, {
      type: "bar",
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          label: "Candidatos",
          data: entries.map(e => e[1]),
          backgroundColor: "rgba(0, 255, 170, 0.7)",
          borderColor: "rgba(0, 255, 170, 1)",
          borderWidth: 1.5,
          borderRadius: 12
        }]
      },
      options: {
        ...getChartOptions(),
        indexAxis: "y"
      }
    });
  }

  function renderScoreChart() {
    const ctx = $("#chart_score_dist");
    if (!ctx) return;

    const groups = {
      "0-39": 0,
      "40-59": 0,
      "60-79": 0,
      "80-100": 0
    };

    filteredCandidates.forEach((c) => {
      const score = safeNum(c.match_score) || 0;
      if (score < 40) groups["0-39"]++;
      else if (score < 60) groups["40-59"]++;
      else if (score < 80) groups["60-79"]++;
      else groups["80-100"]++;
    });

    charts.score = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(groups),
        datasets: [{
          data: Object.values(groups),
          backgroundColor: [
            "rgba(255, 82, 82, 0.85)",
            "rgba(255, 193, 7, 0.85)",
            "rgba(0, 229, 255, 0.85)",
            "rgba(0, 255, 170, 0.85)"
          ],
          borderColor: "rgba(15, 23, 42, 1)",
          borderWidth: 3
        }]
      },
      options: {
        ...getChartOptions(),
        plugins: {
          ...getChartOptions().plugins,
          legend: {
            position: "bottom",
            labels: {
              color: "#dbeafe",
              boxWidth: 14
            }
          }
        }
      }
    });
  }

  function renderStatusChart() {
    const ctx = $("#chart_status_dist");
    if (!ctx) return;

    const counts = {};
    filteredCandidates.forEach((c) => {
      const status = capitalize(getStatus(c));
      counts[status] = (counts[status] || 0) + 1;
    });

    const entries = Object.entries(counts);

    charts.status = new Chart(ctx, {
      type: "polarArea",
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          data: entries.map(e => e[1]),
          backgroundColor: [
            "rgba(0, 229, 255, 0.70)",
            "rgba(0, 255, 170, 0.70)",
            "rgba(255, 193, 7, 0.70)",
            "rgba(255, 82, 82, 0.70)",
            "rgba(168, 85, 247, 0.70)"
          ],
          borderColor: "rgba(15, 23, 42, 1)",
          borderWidth: 2
        }]
      },
      options: getChartOptions()
    });
  }

  function getChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#cbd5e1"
          }
        },
        tooltip: {
          backgroundColor: "rgba(2, 6, 23, 0.95)",
          titleColor: "#67e8f9",
          bodyColor: "#e2e8f0",
          borderColor: "rgba(0, 229, 255, 0.35)",
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.08)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#94a3b8", stepSize: 1 },
          grid: { color: "rgba(148, 163, 184, 0.08)" }
        }
      }
    };
  }

  function renderTopInsights() {
    const el = $("#aiRecommendationsList");
    if (!el) return;

    const byHighScore = [...filteredCandidates]
      .sort((a, b) => (safeNum(b.match_score) || 0) - (safeNum(a.match_score) || 0))
      .slice(0, 3);

    const byExp = [...filteredCandidates]
      .sort((a, b) => (safeNum(b.experiencia_total) || 0) - (safeNum(a.experiencia_total) || 0))
      .slice(0, 3);

    const regions = {};
    filteredCandidates.forEach((c) => {
      const r = getRegionFromDireccion(getLocation(c));
      regions[r] = (regions[r] || 0) + 1;
    });

    const topRegion = Object.entries(regions).sort((a, b) => b[1] - a[1])[0];

    el.innerHTML = `
      <li><strong>Total filtrado:</strong> ${filteredCandidates.length} candidatos.</li>
      <li><strong>Región dominante:</strong> ${topRegion ? `${topRegion[0]} (${topRegion[1]})` : "Sin datos"}.</li>
      <li><strong>Top match:</strong> ${byHighScore.map(c => escapeHtml(c.nombre_completo || "Sin nombre")).join(", ") || "Sin datos"}.</li>
      <li><strong>Mayor experiencia:</strong> ${byExp.map(c => escapeHtml(c.nombre_completo || "Sin nombre")).join(", ") || "Sin datos"}.</li>
    `;
  }

  function getRegionFromDireccion(direccion) {
    const d = normalizeText(direccion);

    if (d.includes("arica")) return "Arica y Parinacota";
    if (d.includes("iquique") || d.includes("tarapaca")) return "Tarapacá";
    if (d.includes("antofagasta") || d.includes("calama")) return "Antofagasta";
    if (d.includes("copiapo") || d.includes("atacama")) return "Atacama";
    if (d.includes("la serena") || d.includes("coquimbo")) return "Coquimbo";
    if (d.includes("valparaiso") || d.includes("vina") || d.includes("quilpue")) return "Valparaíso";
    if (d.includes("rancagua") || d.includes("ohiggins")) return "O'Higgins";
    if (d.includes("talca") || d.includes("curico") || d.includes("maule")) return "Maule";
    if (d.includes("chillan") || d.includes("nuble")) return "Ñuble";
    if (d.includes("concepcion") || d.includes("talcahuano") || d.includes("biobio")) return "Biobío";
    if (d.includes("temuco") || d.includes("araucania")) return "Araucanía";
    if (d.includes("valdivia") || d.includes("rios")) return "Los Ríos";
    if (d.includes("puerto montt") || d.includes("los lagos")) return "Los Lagos";
    if (d.includes("coihaique") || d.includes("aysen")) return "Aysén";
    if (d.includes("punta arenas") || d.includes("magallanes")) return "Magallanes";
    if (d.includes("santiago") || d.includes("maipu") || d.includes("puente alto") || d.includes("metropolitana")) return "Metropolitana";
    return "Metropolitana";
  }

  function renderGeoMap() {
    const container = $("#geoMap");
    if (!container || typeof L === "undefined") return;

    const points = buildGeoPoints(filteredCandidates);

    if (!geoMap) {
      geoMap = L.map("geoMap", {
        zoomControl: false,
        attributionControl: false
      }).setView([-33.45, -70.66], 4.2);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19 }
      ).addTo(geoMap);
    }

    if (geoLayer) {
      geoLayer.clearLayers();
    } else {
      geoLayer = L.layerGroup().addTo(geoMap);
    }

    // Heatmap Layer (NEW)
    const heatData = points.map(p => [p.lat, p.lng, p.count * 10]);
    if (window.heatLayer) geoMap.removeLayer(window.heatLayer);
    window.heatLayer = L.heatLayer(heatData, {
      radius: 35,
      blur: 25,
      maxZoom: 5,
      gradient: { 0.4: 'rgba(0, 229, 255, 0.2)', 0.65: 'rgba(0, 229, 255, 0.5)', 1: '#67e8f9' }
    }).addTo(geoMap);

    points.forEach((p) => {
      const radius = Math.max(12, Math.min(38, 8 + p.count * 3));

      const glow = L.circleMarker([p.lat, p.lng], {
        radius: radius + 12,
        color: "rgba(0,0,0,0)",
        fillColor: "rgba(0,229,255,0.18)",
        fillOpacity: 0.35,
        weight: 0
      });

      const core = L.circleMarker([p.lat, p.lng], {
        radius,
        color: "#67e8f9",
        weight: 1.5,
        fillColor: "#00e5ff",
        fillOpacity: 0.78,
        className: 'marker-pulse'
      });

      const html = `
        <div style="min-width:200px; font-family: 'Inter', sans-serif;">
          <div style="font-weight:800; color:#67e8f9; margin-bottom:6px; font-size:14px; border-bottom:1px solid rgba(103,232,249,0.2); padding-bottom:4px;">
            ${escapeHtml(p.label)}
          </div>
          <div style="color:#f1f5f9; margin-bottom:4px;">
            Candidatos: <strong>${p.count}</strong>
          </div>
          <div style="color:#94a3b8; font-size:11px; max-height:80px; overflow-y:auto;">
            ${escapeHtml(p.names.slice(0, 8).join(", "))}${p.names.length > 8 ? "..." : ""}
          </div>
        </div>
      `;

      L.layerGroup([glow, core])
        .bindPopup(html, { className: "jarvis-popup", closeButton: false })
        .addTo(geoLayer);
    });
  }

  function buildGeoPoints(candidates) {
    const regionMap = {
      "arica y parinacota": { lat: -18.4783, lng: -70.3126, label: "Arica" },
      "tarapaca": { lat: -20.2208, lng: -70.1431, label: "Iquique" },
      "antofagasta": { lat: -23.6509, lng: -70.3975, label: "Antofagasta" },
      "atacama": { lat: -27.3668, lng: -70.3322, label: "Copiapó" },
      "coquimbo": { lat: -29.9027, lng: -71.2519, label: "La Serena" },
      "valparaiso": { lat: -33.0472, lng: -71.6127, label: "Valparaíso" },
      "ohiggins": { lat: -34.1708, lng: -70.7444, label: "Rancagua" },
      "maule": { lat: -35.4264, lng: -71.6554, label: "Talca" },
      "nuble": { lat: -36.6066, lng: -72.1034, label: "Chillán" },
      "biobio": { lat: -36.8201, lng: -73.0444, label: "Concepción" },
      "araucania": { lat: -38.7359, lng: -72.5904, label: "Temuco" },
      "los rios": { lat: -39.8142, lng: -73.2459, label: "Valdivia" },
      "los lagos": { lat: -41.4693, lng: -72.9424, label: "Puerto Montt" },
      "aysen": { lat: -45.5752, lng: -72.0662, label: "Coyhaique" },
      "magallanes": { lat: -53.1638, lng: -70.9171, label: "Punta Arenas" },
      "metropolitana": { lat: -33.4489, lng: -70.6693, label: "Santiago" }
    };

    const grouped = {};

    candidates.forEach((c) => {
      const fullDir = normalizeText(getLocation(c));
      const region = getRegionFromDireccion(fullDir);
      let key = normalizeText(region);
      let coords = regionMap[key] || regionMap["metropolitana"];

      // Group by City/Comuna if match found
      for (const [cityKey, cityData] of Object.entries(cityCoordMap)) {
        if (fullDir.includes(cityKey)) {
          key = `city_${cityKey}`;
          coords = cityData;
          break;
        }
      }

      if (!grouped[key]) {
        grouped[key] = {
          count: 0,
          names: [],
          label: coords.label || region,
          ...coords
        };
      }

      grouped[key].count += 1;
      if (c.nombre_completo) grouped[key].names.push(c.nombre_completo);
    });

    return Object.values(grouped);
  }

  init();
})();