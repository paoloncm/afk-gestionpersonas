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
   * Nuevo: Distribución de Profesiones con agrupación inteligente
   */
  window.renderProfessionDistribution = function(workers, candidates) {
    const ctx = document.getElementById("chart_professions");
    if (!ctx) return;
    destroyIfExists(window.chartProfessions);

    const allPeople = [
      ...(workers || []).map(w => ({ profession: w.job_title || w.profession || "" })),
      ...(candidates || []).map(c => ({ profession: c.profesion || c.profession || "" }))
    ];

    const counts = {};
    allPeople.forEach(p => {
      let raw = String(p.profession || "Sin definir").trim();
      let normalized = "Otros";

      if (raw === "Sin definir") {
          normalized = "Sin definir";
      } else if (raw.toLowerCase().includes("técnico") || raw.toLowerCase().includes("tecnico")) {
          normalized = "Técnico";
      } else if (raw.toLowerCase().includes("ingeniero")) {
          normalized = "Ingeniero";
      } else if (raw.toLowerCase().includes("operador")) {
          normalized = "Operador";
      } else if (raw.toLowerCase().includes("supervisor")) {
          normalized = "Supervisor";
      } else if (raw.toLowerCase().includes("admin") || raw.toLowerCase().includes("gestión") || raw.toLowerCase().includes("gestion")) {
          normalized = "Administrativo";
      } else {
          normalized = raw; // O podrías usar "Especialista" o similar
      }

      counts[normalized] = (counts[normalized] || 0) + 1;
    });

    const sortedEntries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 7);
    const labels = sortedEntries.map(e => e[0]);
    const values = sortedEntries.map(e => e[1]);

    window.chartProfessions = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cantidad',
          data: values,
          backgroundColor: [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'
          ],
          borderRadius: 8,
          barThickness: 20
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
              label: (ctx) => ` ${ctx.raw} personas`
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