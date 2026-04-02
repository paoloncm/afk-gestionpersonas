<<<<<<< HEAD:static/charts.js
(function () {
  const num = (x) => {
    if (x == null || x === "") return NaN;
    return Number(String(x).replace(",", "."));
  };

  let chartNotas = null;
  let chartScatter = null;
  let chartProfesiones = null;
  let chartPipeline = null;
  let chartExpirations = null;
  let chartIMC = null;
  let chartPressure = null;
  let chartCompanies = null;
  let chartWorkerStatus = null;
  let chartExpMonthly = null;
  let chartRiskTypes = null;
  let chartCredentialsPct = null;
  let chartExamsDistribution = null;

  function destroyIfExists(chart) {
    if (chart) chart.destroy();
  }

  function countBy(items, keyFn) {
    const map = new Map();
    items.forEach(item => {
      const key = keyFn(item) || "Sin dato";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }

  function renderNotas(items) {
    const ctx = document.getElementById("chart_notas");
    if (!ctx) return;

    destroyIfExists(chartNotas);

    const bins = {
      "0-1": 0, "1-2": 0, "2-3": 0, "3-4": 0, "4-5": 0,
      "5-6": 0, "6-7": 0, "7-8": 0, "8-9": 0, "9-10": 0
    };

    items.forEach(c => {
      const n = num(c.nota);
      if (!Number.isFinite(n)) return;
      if (n < 1) bins["0-1"]++;
      else if (n < 2) bins["1-2"]++;
      else if (n < 3) bins["2-3"]++;
      else if (n < 4) bins["3-4"]++;
      else if (n < 5) bins["4-5"]++;
      else if (n < 6) bins["5-6"]++;
      else if (n < 7) bins["6-7"]++;
      else if (n < 8) bins["7-8"]++;
      else if (n < 9) bins["8-9"]++;
      else bins["9-10"]++;
    });

    chartNotas = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(bins),
        datasets: [{
          label: "Candidatos",
          data: Object.values(bins)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#b3b7bd" }, grid: { color: "rgba(255,255,255,.06)" } },
          y: { ticks: { color: "#b3b7bd" }, grid: { color: "rgba(255,255,255,.06)" }, beginAtZero: true }
        }
      }
    });
  }

  function renderScatter(items) {
    const ctx = document.getElementById("chart_scatter");
    if (!ctx) return;

    destroyIfExists(chartScatter);

    const points = items
      .map(c => ({
        x: num(c.experiencia_total),
        y: num(c.nota)
      }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    chartScatter = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Candidatos",
          data: points
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#b3b7bd" } } },
        scales: {
          x: {
            title: { display: true, text: "Años experiencia", color: "#b3b7bd" },
            ticks: { color: "#b3b7bd" },
            grid: { color: "rgba(255,255,255,.06)" }
          },
          y: {
            title: { display: true, text: "Nota", color: "#b3b7bd" },
            ticks: { color: "#b3b7bd" },
            grid: { color: "rgba(255,255,255,.06)" },
            beginAtZero: true
          }
        }
      }
    });
  }

  function renderProfesiones(items) {
    const ctx = document.getElementById("chart_profesiones");
    if (!ctx) return;

    destroyIfExists(chartProfesiones);

    const counts = countBy(items, c => c.profesion || "Sin profesión");
    const entries = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    chartProfesiones = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: entries.map(x => x[0]),
        datasets: [{
          data: entries.map(x => x[1])
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#b3b7bd" }
          }
        }
      }
    });
  }

  function renderPipeline(items) {
    const ctx = document.getElementById("chart_pipeline");
    if (!ctx) return;

    destroyIfExists(chartPipeline);

    const counts = countBy(items, c => c.status || "Sin estado");
    const labels = [...counts.keys()];
    const values = [...counts.values()];

    chartPipeline = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Candidatos",
          data: values
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#b3b7bd" }, grid: { color: "rgba(255,255,255,.06)" } },
          y: { ticks: { color: "#b3b7bd" }, grid: { color: "rgba(255,255,255,.06)" }, beginAtZero: true }
        }
      }
    });
  }

  window.renderWorkerAnalytics = function (workers, exams) {
    renderWorkerStatus(workers, exams); // Sincronizado con Dashboard (Level God)
    renderWorkerExpirations(exams);
    renderWorkerIMC(exams);
    renderWorkerPressure(exams);
    renderWorkerCompanies(workers);
  };

  function renderWorkerExpirations(exams) {
    const ctx = document.getElementById("chartCompliance");
    if (!ctx) return;
    destroyIfExists(chartExpirations);

    const now = new Date();
    const buckets = {
      "Vencidos":    { count: 0, color: "#e74c3c" },
      "0–100 días":  { count: 0, color: "#e67e22" },
      "101–200 días":{ count: 0, color: "#f1c40f" },
      "201–300 días":{ count: 0, color: "#3498db" },
      "+300 días":   { count: 0, color: "#2ecc71" }
    };

    exams.forEach(e => {
      if (!e.expiry_date) return;
      const exp = new Date(e.expiry_date);
      if (isNaN(exp.getTime())) return;
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      if      (diffDays <= 0)    buckets["Vencidos"].count++;
      else if (diffDays <= 100)  buckets["0–100 días"].count++;
      else if (diffDays <= 200)  buckets["101–200 días"].count++;
      else if (diffDays <= 300)  buckets["201–300 días"].count++;
      else                       buckets["+300 días"].count++;
    });

    const labels  = Object.keys(buckets);
    const values  = labels.map(k => buckets[k].count);
    const colors  = labels.map(k => buckets[k].color);

    chartExpirations = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Documentos",
          data: values,
          backgroundColor: colors.map(c => c + "cc"),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const label = labels[elements[0].index];
            if (window.onChartDrillDown) window.onChartDrillDown("expiration", label);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw} documento${ctx.raw !== 1 ? "s" : ""}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: "#b3b7bd", stepSize: 1 },
            grid: { color: "rgba(255,255,255,0.05)" }
          },
          y: {
            ticks: { color: "#b3b7bd" },
            grid: { display: false }
          }
        }
      }
    });
  }

  function getLatestExamsPerWorker(exams) {
    const latest = {};
    exams.forEach(e => {
      const id = e.worker_id || e.rut;
      if (!id) return;
      if (!latest[id] || new Date(e.exam_date) > new Date(latest[id].exam_date)) {
        latest[id] = e;
      }
    });
    return Object.values(latest);
  }

  function renderWorkerIMC(exams) {
    const ctx = document.getElementById("chartIMC");
    if (!ctx) return;
    destroyIfExists(chartIMC);

    const latestExams = getLatestExamsPerWorker(exams);
    const bins = { "Bajo": 0, "Normal": 0, "Sobrepeso": 0, "Obeso I": 0, "Obeso II+": 0 };
    
    latestExams.forEach(e => {
      const imc = num(e.imc);
      if (!Number.isFinite(imc)) return;
      if (imc < 18.5) bins["Bajo"]++;
      else if (imc < 25) bins["Normal"]++;
      else if (imc < 30) bins["Sobrepeso"]++;
      else if (imc < 35) bins["Obeso I"]++;
      else bins["Obeso II+"]++;
    });

    chartIMC = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(bins),
        datasets: [{
          label: "Trabajadores",
          data: Object.values(bins),
          backgroundColor: ["#f1c40f", "#2ecc71", "#e67e22", "#e74c3c", "#c0392b"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const label = Object.keys(bins)[index];
            if (window.onChartDrillDown) window.onChartDrillDown("imc", label);
          }
        },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#b3b7bd" }, grid: { display: false } },
          y: { 
            beginAtZero: true, 
            ticks: { color: "#b3b7bd", stepSize: 1 }, 
            grid: { color: "rgba(255,255,255,0.05)" } 
          }
        }
      }
    });
  }

  function classifyPressure(sys, dia) {
    if (sys < 120 && dia < 80)                         return { label: "Normal",          color: "#2ecc71" };
    if (sys < 130 && dia < 80)                         return { label: "Elevada",          color: "#f1c40f" };
    if ((sys >= 130 && sys < 140) || (dia >= 80 && dia < 90)) return { label: "Hipertensión I",   color: "#e67e22" };
    return                                                      { label: "Hipertensión II",  color: "#e74c3c" };
  }

  function renderWorkerPressure(exams) {
    const ctx = document.getElementById("chartPressure");
    if (!ctx) return;
    destroyIfExists(chartPressure);

    const latestExams = getLatestExamsPerWorker(exams);

    // Build per-risk-level buckets
    const levels = {
      "Normal":         { color: "#2ecc71", points: [] },
      "Elevada":        { color: "#f1c40f", points: [] },
      "Hipertensión I": { color: "#e67e22", points: [] },
      "Hipertensión II":{ color: "#e74c3c", points: [] }
    };

    latestExams.forEach(e => {
      const p = String(e.presion || "").split("/");
      if (p.length !== 2) return;
      const sys = num(p[0]);
      const dia = num(p[1]);
      if (!Number.isFinite(sys) || !Number.isFinite(dia)) return;
      const cat = classifyPressure(sys, dia);
      levels[cat.label].points.push({
        x: sys,
        y: dia,
        worker_id: e.worker_id,
        full_name: e.full_name || "Sin nombre",
        classification: cat.label
      });
    });

    const datasets = Object.entries(levels).map(([label, cfg]) => ({
      label,
      data: cfg.points,
      backgroundColor: cfg.color + "cc",
      borderColor: cfg.color,
      pointRadius: 7,
      hoverRadius: 11,
      pointBorderWidth: 1.5
    }));

    chartPressure = new Chart(ctx, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#b3b7bd", padding: 12, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: "rgba(15,17,26,0.92)",
            titleColor: "#ffffff",
            bodyColor: "#b3b7bd",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => items[0]?.raw?.full_name ?? "",
              label: (ctx) => {
                const p = ctx.raw;
                return [
                  `  Sistólica / Diastólica: ${p.x} / ${p.y} mmHg`,
                  `  Clasificación: ${p.classification}`
                ];
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const ds = datasets[elements[0].datasetIndex];
            const pt = ds.data[elements[0].index];
            if (window.onChartDrillDown) window.onChartDrillDown("worker_name", pt.full_name);
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Sistólica (mmHg)", color: "#b3b7bd" },
            ticks: { color: "#b3b7bd" },
            grid: { color: "rgba(255,255,255,0.05)" }
          },
          y: {
            title: { display: true, text: "Diastólica (mmHg)", color: "#b3b7bd" },
            ticks: { color: "#b3b7bd" },
            grid: { color: "rgba(255,255,255,0.05)" }
          }
        }
      }
    });
  }

  function renderWorkerCompanies(workers) {
    const ctx = document.getElementById("chartCompanies");
    if (!ctx) return;
    destroyIfExists(chartCompanies);

    const counts = countBy(workers, w => w.company_name && w.company_name !== "Sin asignar" ? w.company_name : "Sin asignar");
    const entries = [...counts.entries()]
      .sort((a, b) => b[1] - a[1]) // highest first
      .slice(0, 6); // max 6 slices for readability

    chartCompanies = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: entries.map(x => x[0]),
        datasets: [{
          data: entries.map(x => x[1]),
          borderWidth: 0,
          backgroundColor: ["#3498db", "#9b59b6", "#e67e22", "#1abc9c", "#f1c40f", "#7f8c8d"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "#b3b7bd", boxWidth: 12, font: { size: 10 } } }
        }
      }
    });
  }

  function renderWorkerStatus(workers, exams) {
    const ctx = document.getElementById("chart_worker_status");
    if (!ctx) return;
    destroyIfExists(chartWorkerStatus);

    const counts = { "Habilitado": 0, "No habilitado": 0, "En riesgo": 0, "Sin info": 0 };
    
    workers.forEach(w => {
      // Logic synchronized with workers.supabase.js & getComplianceSummary
      const wExams = exams.filter(e => e.worker_id === w.id || (e.rut && w.rut && e.rut.replace(/\./g,'').split('-')[0] === w.rut.replace(/\./g,'').split('-')[0]));
      
      // 1. SIN DOCUMENTOS -> NO HABILITADO (ROJO/BLOQUEADO)
      if (wExams.length === 0) {
        counts["No habilitado"]++;
        return;
      }

      let minDiff = 9999;
      wExams.forEach(e => {
        if (!e.expiry_date) return;
        const diff = Math.ceil((new Date(e.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        if (diff < minDiff) minDiff = diff;
      });

      // 2. VENCIDOS O PRÓXIMOS (Tensión Operativa 300 días) -> EN RIESGO (AMARILLO)
      if (minDiff <= 300) {
        counts["En riesgo"]++;
      } else {
        // 3. TODO AL DÍA -> HABILITADO (VERDE)
        counts["Habilitado"]++;
      }
    });

    chartWorkerStatus = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#6b7280"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#b3b7bd", boxWidth: 12 } }
        }
      }
    });
  }

  function renderExpMonthly(exams) {
    const ctx = document.getElementById("chart_exp_monthly");
    if (!ctx) return;
    destroyIfExists(chartExpMonthly);

    const now = new Date();
    const buckets = { "Semana 1": 0, "Semana 2": 0, "Semana 3": 0, "Semana 4": 0 };
    
    exams.forEach(e => {
      if (!e.expiry_date) return;
      const exp = new Date(e.expiry_date);
      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      if (diff > 0 && diff <= 7) buckets["Semana 1"]++;
      else if (diff > 7 && diff <= 14) buckets["Semana 2"]++;
      else if (diff > 14 && diff <= 21) buckets["Semana 3"]++;
      else if (diff > 21 && diff <= 30) buckets["Semana 4"]++;
    });

    chartExpMonthly = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          label: "Vencimientos",
          data: Object.values(buckets),
          backgroundColor: "#3498db"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#b3b7bd" }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: "#b3b7bd", stepSize: 1 }, grid: { color: "rgba(255,255,255,.05)" } }
        }
      }
    });
  }

  function renderRiskTypes(exams) {
    const ctx = document.getElementById("chart_risk_types");
    if (!ctx) return;
    destroyIfExists(chartRiskTypes);

    const latestExams = getLatestExamsPerWorker(exams);
    const counts = { "Normal": 0, "Elevada": 0, "Hipertensión I": 0, "Hipertensión II": 0 };
    
    latestExams.forEach(e => {
      const p = String(e.presion || "").split("/");
      if (p.length !== 2) return;
      const sys_val = num(p[0]);
      const dia_val = num(p[1]);
      if (!Number.isFinite(sys_val) || !Number.isFinite(dia_val)) return;
      const cat = classifyPressure(sys_val, dia_val);
      counts[cat.label]++;
    });

    chartRiskTypes = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ["#10b981", "#f1c40f", "#e67e22", "#e74c3c"]
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: "#b3b7bd", stepSize: 1 }, grid: { color: "rgba(255,255,255,.05)" } },
          y: { ticks: { color: "#b3b7bd" }, grid: { display: false } }
        }
      }
    });
  }
  
  function renderCredentialsPct(workers, exams) {
    const ctx = document.getElementById("chart_credentials_pct");
    if (!ctx) return;
    destroyIfExists(chartCredentialsPct);

    if (!workers.length) return;

    // Con v_worker_profile, cada worker tiene un array 'credentials'
    const withDocs = workers.filter(w => w.credentials && w.credentials.length > 0).length;
    const total = workers.length;
    const withoutDocs = total - withDocs;

    chartCredentialsPct = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Con Exámenes", "Sin Exámenes"],
        datasets: [{
          data: [withDocs, withoutDocs],
          backgroundColor: ["#10b981", "#6b7280"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#b3b7bd", boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const pct = Math.round((val / total) * 100);
                return ` ${val} trabajadores (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderExamsDistribution(exams) {
    const ctx = document.getElementById("chart_exams_distribution");
    if (!ctx) return;
    destroyIfExists(chartExamsDistribution);

    // Count by credential_name or exam_type
    const counts = countBy(exams, e => e.credential_name || e.exam_type || "Otros");
    const entries = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    chartExamsDistribution = new Chart(ctx, {
      type: "bar",
      data: {
        labels: entries.map(x => x[0]),
        datasets: [{
          label: "Cantidad",
          data: entries.map(x => x[1]),
          backgroundColor: "#3498db",
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: "#b3b7bd", stepSize: 1 }, grid: { color: "rgba(255,255,255,.05)" } },
          y: { ticks: { color: "#b3b7bd", font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  window.renderAfkCharts = function (items, workers, exams) {
    if (items) {
        renderNotas(items);
        renderScatter(items);
        renderProfesiones(items);
        renderPipeline(items);
    }
    if (workers || exams) {
        // renderWorkerStatus ya no se usa en Dashboard, pero se mantiene para Workers.html
        // renderWorkerStatus(workers || [], exams || []); 
        renderCredentialsPct(workers || [], exams || []);
        renderExamsDistribution(exams || []);
    }
  };

  /**
   * Nuevo: Distribución por Tipo de Examen (altfis, ruido, silice, etc.)
   */
  window.renderExamTypeDistribution = function(exams) {
    const ctx = document.getElementById("chart_exam_types");
    if (!ctx) return;
    destroyIfExists(window.chartExamTypes);

    const counts = {};
    (exams || []).forEach(e => {
      let type = String(e.exam_type || "").trim();
      if (!type || type.toLowerCase() === "null") return; // Ignoramos nulos
      
      counts[type] = (counts[type] || 0) + 1;
    });

    const sortedEntries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8);
    const labels = sortedEntries.map(e => e[0].toUpperCase());
    const values = sortedEntries.map(e => e[1]);

    window.chartExamTypes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cantidad',
          data: values,
          backgroundColor: '#3b82f6',
          borderRadius: 8,
          barThickness: 24
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} exámenes`
            }
          }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', stepSize: 1 } },
          y: { grid: { display: false }, ticks: { color: '#b3b7bd', font: { size: 10, weight: 'bold' } } }
        }
      }
    });
  };
})();
=======
console.log('CHARTS.js cargado ✅');

(() => {
  const num = (v) => {
    if (v == null || v === '') return NaN;
    const s = String(v).replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const destroyIfExists = (canvasId) => {
    const chart = Chart.getChart(canvasId);
    if (chart) chart.destroy();
  };

  const safe = (v, fallback = '—') => (v == null || v === '' ? fallback : v);

  function renderDashboard(rows) {
    rows = rows || [];

    // ---------- KPIs ----------
    const total = rows.length;
    const notas = rows.map(r => num(r.nota)).filter(Number.isFinite);
    const exps  = rows.map(r => num(r.experiencia_total || r.experiencia_total_anos || r.años_experiencia)).filter(Number.isFinite);

    const promNota = notas.length ? notas.reduce((a,b)=>a+b,0)/notas.length : 0;
    const promExp  = exps.length  ? exps.reduce((a,b)=>a+b,0)/exps.length : 0;
    const pctN6    = notas.length ? (notas.filter(n => n >= 6).length / notas.length * 100) : 0;

    setText('kpi_total', String(total));
    setText('kpi_prom_nota', promNota ? promNota.toFixed(1) : '0.0');
    setText('kpi_prom_exp', promExp ? promExp.toFixed(1) : '0.0');
    setText('kpi_pct_n6', (pctN6 ? pctN6.toFixed(0) : '0') + '%');

    // ---------- Chart: Distribución notas ----------
    destroyIfExists('chart_notas');

    const bins = Array.from({ length: 10 }, () => 0);
    notas.forEach(n => {
      // nota 0-10
      const x = Math.max(0, Math.min(9.999, n));
      const i = Math.min(9, Math.max(0, Math.floor(x)));
      bins[i]++;
    });

    new Chart(document.getElementById('chart_notas'), {
      type: 'bar',
      data: {
        labels: ['0–1','1–2','2–3','3–4','4–5','5–6','6–7','7–8','8–9','9–10'],
        datasets: [{ label: 'Candidatos', data: bins }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });

    // ---------- Chart: Nota vs Experiencia ----------
    destroyIfExists('chart_scatter');

    const scatterData = rows
      .map(r => ({ x: num(r.experiencia_total || r.experiencia_total_anos || r.años_experiencia), y: num(r.nota) }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    new Chart(document.getElementById('chart_scatter'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Candidatos',
          data: scatterData
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Años experiencia' } },
          y: { title: { display: true, text: 'Nota' }, min: 0, max: 10 }
        }
      }
    });

    // ---------- Chart: Profesiones (Top 10 + "Otros") ----------
    destroyIfExists('chart_profesiones');

    const profMap = new Map();
    rows.forEach(r => {
      const p = safe(r.profesion, 'Sin profesión');
      profMap.set(p, (profMap.get(p) || 0) + 1);
    });

    const profSorted = [...profMap.entries()].sort((a,b) => b[1]-a[1]);
    const top10 = profSorted.slice(0, 10);
    const rest = profSorted.slice(10);
    const otros = rest.reduce((acc, [,v]) => acc + v, 0);

    const profLabels = top10.map(([k]) => k);
    const profValues = top10.map(([,v]) => v);
    if (otros > 0) {
      profLabels.push('Otros');
      profValues.push(otros);
    }

    new Chart(document.getElementById('chart_profesiones'), {
      type: 'doughnut',
      data: {
        labels: profLabels,
        datasets: [{ data: profValues }]
      },
      options: { responsive: true }
    });

    // ---------- Pipeline por estado ----------
    destroyIfExists('chart_pipeline');

    const estadoMap = new Map();
    rows.forEach(r => {
      const e = safe(r.status || r.estado, 'Sin estado');
      estadoMap.set(e, (estadoMap.get(e) || 0) + 1);
    });

    const estadoLabels = [...estadoMap.keys()];
    const estadoValues = [...estadoMap.values()];

    new Chart(document.getElementById('chart_pipeline'), {
      type: 'bar',
      data: {
        labels: estadoLabels,
        datasets: [{ label: 'Candidatos', data: estadoValues }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });

    // ---------- Top 5 (por nota) con click ----------
    const topList = document.getElementById('topCandidates');
    if (topList) {
      const top = [...rows]
        .filter(r => Number.isFinite(num(r.nota)))
        .sort((a,b) => num(b.nota) - num(a.nota))
        .slice(0, 5);

      topList.innerHTML = '';

      if (!top.length) {
        const li = document.createElement('li');
        li.textContent = 'No hay candidatos con nota válida.';
        topList.appendChild(li);
      } else {
        top.forEach(r => {
          const li = document.createElement('li');
          li.style.cursor = 'pointer';
          li.textContent = `${safe(r.nombre_completo)} — Nota ${num(r.nota).toFixed(1)} — Exp ${Number.isFinite(num(r.experiencia_total)) ? num(r.experiencia_total).toFixed(1) : '—'}`;
          li.addEventListener('click', () => {
            const cid = r.id || r.trabajador_uuid;
            if (cid) {
              window.location.href = `candidates.html?id=${cid}`;
            }
          });
          topList.appendChild(li);
        });
      }
    }
  }

  window.renderAFKDashboard = renderDashboard;

  window.addEventListener('afk:candidates-loaded', (e) => {
    renderDashboard(e.detail);
  });

  if (window.__CANDIDATES__) {
    renderDashboard(window.__CANDIDATES__);
  }
})();
>>>>>>> 8c99da40efea7850d26fba9f412dc9128e25ba4d:charts.js
