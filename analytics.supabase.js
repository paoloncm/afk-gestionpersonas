/**
 * analytics.supabase.js
 * Dashboard People Analytics conectado a public.candidates
 */

(async function () {
  const $ = (s) => document.querySelector(s);

  let allCandidates = [];
  let filteredCandidates = [];
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
      const nombre = String(c.nombre_completo || "").toLowerCase();
      const profesion = String(getProfession(c) || "").toLowerCase();
      const direccion = String(getLocation(c) || "").toLowerCase();
      const rut = String(c.rut || "").toLowerCase();
      const cStatus = getStatus(c);
      const cRegion = getRegionFromDireccion(getLocation(c));

      const matchQ =
        !q ||
        nombre.includes(q) ||
        profesion.includes(q) ||
        direccion.includes(q) ||
        rut.includes(q);

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
    renderGeoMap();
    renderTopInsights();
  }

  function renderKPIs() {
    const total = filteredCandidates.length;

    const avgExp = average(
      filteredCandidates
        .map(c => safeNum(c.experiencia_total))
        .filter(v => v != null)
    );

    const avgScore = average(
      filteredCandidates
        .map(c => safeNum(c.match_score))
        .filter(v => v != null)
    );

    const avgNota = average(
      filteredCandidates
        .map(c => safeNum(c.nota))
        .filter(v => v != null)
    );

    const highMatch = filteredCandidates.filter(c => (safeNum(c.match_score) || 0) >= 70).length;

    if ($("#kpi_total_candidates")) $("#kpi_total_candidates").textContent = total;
    if ($("#kpi_avg_experience")) $("#kpi_avg_experience").textContent = avgExp != null ? avgExp.toFixed(1) : "--";
    if ($("#kpi_avg_score")) $("#kpi_avg_score").textContent = avgScore != null ? Math.round(avgScore) : "--";
    if ($("#kpi_avg_nota")) $("#kpi_avg_nota").textContent = avgNota != null ? avgNota.toFixed(1) : "--";
    if ($("#kpi_high_match")) $("#kpi_high_match").textContent = highMatch;
  }

  function average(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function renderAgeChart() {
    const ctx = $("#chart_age_dist");
    if (!ctx) return;

    const groups = {
      "18-24": 0,
      "25-34": 0,
      "35-44": 0,
      "45-54": 0,
      "55+": 0
    };

    filteredCandidates.forEach((c) => {
      const age = getAgeFromBirthDate(c.fecha_nacimiento || c.birth_date);
      if (age == null) return;

      if (age < 25) groups["18-24"]++;
      else if (age < 35) groups["25-34"]++;
      else if (age < 45) groups["35-44"]++;
      else if (age < 55) groups["45-54"]++;
      else groups["55+"]++;
    });

    charts.age = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(groups),
        datasets: [{
          label: "Candidatos",
          data: Object.values(groups),
          backgroundColor: [
            "rgba(0, 229, 255, 0.75)",
            "rgba(0, 229, 255, 0.65)",
            "rgba(0, 229, 255, 0.55)",
            "rgba(0, 229, 255, 0.45)",
            "rgba(0, 229, 255, 0.35)"
          ],
          borderColor: "rgba(0, 229, 255, 1)",
          borderWidth: 1.5,
          borderRadius: 12
        }]
      },
      options: getChartOptions()
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

    points.forEach((p) => {
      const radius = Math.max(10, Math.min(34, 8 + p.count * 2));

      const glow = L.circleMarker([p.lat, p.lng], {
        radius: radius + 10,
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
        fillOpacity: 0.78
      });

      const html = `
        <div style="min-width:220px">
          <div style="font-weight:800; color:#67e8f9; margin-bottom:6px;">${escapeHtml(p.label)}</div>
          <div style="color:#e2e8f0;">Candidatos: <strong>${p.count}</strong></div>
          <div style="color:#94a3b8; margin-top:6px; font-size:12px;">${escapeHtml(p.names.slice(0, 6).join(", "))}</div>
        </div>
      `;

      glow.addTo(geoLayer);
      core.addTo(geoLayer).bindPopup(html);
    });
  }

  function buildGeoPoints(candidates) {
    const coordMap = {
      "arica y parinacota": { lat: -18.4783, lng: -70.3126, label: "Arica" },
      "tarapaca": { lat: -20.2208, lng: -70.1431, label: "Iquique" },
      "antofagasta": { lat: -23.6509, lng: -70.3975, label: "Antofagasta" },
      "atacama": { lat: -27.3668, lng: -70.3322, label: "Copiapó" },
      "coquimbo": { lat: -29.9027, lng: -71.2519, label: "La Serena" },
      "valparaiso": { lat: -33.0472, lng: -71.6127, label: "Valparaíso" },
      "o'higgins": { lat: -34.1708, lng: -70.7444, label: "Rancagua" },
      "maule": { lat: -35.4264, lng: -71.6554, label: "Talca" },
      "ñuble": { lat: -36.6066, lng: -72.1034, label: "Chillán" },
      "biobío": { lat: -36.8201, lng: -73.0444, label: "Concepción" },
      "araucanía": { lat: -38.7359, lng: -72.5904, label: "Temuco" },
      "los ríos": { lat: -39.8142, lng: -73.2459, label: "Valdivia" },
      "los lagos": { lat: -41.4693, lng: -72.9424, label: "Puerto Montt" },
      "aysén": { lat: -45.5752, lng: -72.0662, label: "Coyhaique" },
      "magallanes": { lat: -53.1638, lng: -70.9171, label: "Punta Arenas" },
      "metropolitana": { lat: -33.4489, lng: -70.6693, label: "Santiago" }
    };

    const grouped = {};

    candidates.forEach((c) => {
      const region = getRegionFromDireccion(getLocation(c));
      const key = normalizeText(region);

      if (!grouped[key]) {
        grouped[key] = {
          count: 0,
          names: [],
          region,
          ...(
            coordMap[key] || coordMap["metropolitana"]
          )
        };
      }

      grouped[key].count += 1;
      if (c.nombre_completo) grouped[key].names.push(c.nombre_completo);
    });

    return Object.values(grouped);
  }

  init();
})();