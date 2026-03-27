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

  function getStarkGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }

  function renderNotas(items) {
    const can = document.getElementById("chart_notas");
    if (!can) return;
    const ctx = can.getContext('2d');

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

    const grad = getStarkGradient(ctx, "rgba(103, 232, 249, 0.8)", "rgba(8, 145, 178, 0.2)");

    chartNotas = new Chart(can, {
      type: "bar",
      data: {
        labels: Object.keys(bins),
        datasets: [{
          label: "Candidatos",
          data: Object.values(bins),
          backgroundColor: grad,
          borderColor: "rgba(103, 232, 249, 0.5)",
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#67e8f9",
            borderColor: "rgba(103, 232, 249, 0.2)",
            borderWidth: 1
          }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,.05)" }, beginAtZero: true }
        }
      }
    });
  }

  function renderScatter(items) {
    const can = document.getElementById("chart_scatter");
    if (!can) return;

    destroyIfExists(chartScatter);

    const points = items
      .map(c => ({
        x: num(c.experiencia_total),
        y: num(c.nota)
      }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    chartScatter = new Chart(can, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Candidatos",
          data: points,
          backgroundColor: "rgba(103, 232, 249, 0.8)",
          pointRadius: 6,
          pointHoverRadius: 9,
          pointBorderColor: "#fff",
          pointBorderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { labels: { color: "#94a3b8" } },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#67e8f9"
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Años experiencia", color: "#94a3b8", font: { weight: 'bold' } },
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(255,255,255,.05)" }
          },
          y: {
            title: { display: true, text: "Nota", color: "#94a3b8", font: { weight: 'bold' } },
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(255,255,255,.05)" },
            beginAtZero: true
          }
        }
      }
    });
  }

  function renderProfesiones(items) {
    const can = document.getElementById("chart_profesiones");
    if (!can) return;

    destroyIfExists(chartProfesiones);

    const counts = countBy(items, c => c.profesion || "Sin profesión");
    const entries = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    chartProfesiones = new Chart(can, {
      type: "doughnut",
      data: {
        labels: entries.map(x => x[0]),
        datasets: [{
          data: entries.map(x => x[1]),
          backgroundColor: [
            "rgba(103, 232, 249, 0.8)",
            "rgba(8, 145, 178, 0.7)",
            "rgba(52, 211, 153, 0.7)",
            "rgba(139, 92, 246, 0.7)",
            "rgba(251, 113, 133, 0.7)",
            "rgba(251, 191, 36, 0.7)",
            "rgba(148, 163, 184, 0.5)",
            "rgba(71, 85, 105, 0.4)"
          ],
          borderWidth: 0,
          hoverOffset: 15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#94a3b8", usePointStyle: true, boxWidth: 8 }
          }
        }
      }
    });
  }

  function renderPipeline(items) {
    const can = document.getElementById("chart_pipeline");
    if (!can) return;
    const ctx = can.getContext('2d');

    destroyIfExists(chartPipeline);

    const counts = countBy(items, c => c.status || "Sin estado");
    const labels = [...counts.keys()];
    const values = [...counts.values()];

    const grad = getStarkGradient(ctx, "rgba(103, 232, 249, 0.9)", "rgba(52, 211, 153, 0.2)");

    chartPipeline = new Chart(can, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Candidatos",
          data: values,
          backgroundColor: grad,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,.05)" }, beginAtZero: true }
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
    const can = document.getElementById("chartCompliance");
    if (!can) return;
    const ctx = can.getContext('2d');
    destroyIfExists(chartExpirations);

    const now = new Date();
    const buckets = {
      "Vencidos":    { count: 0, color: "#fb7185" },
      "0–100 días":  { count: 0, color: "#fbbf24" },
      "101–200 días":{ count: 0, color: "#34d399" },
      "201–300 días":{ count: 0, color: "#67e8f9" },
      "+300 días":   { count: 0, color: "#10b981" }
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

    chartExpirations = new Chart(can, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Documentos",
          data: values,
          backgroundColor: colors.map(c => c + "aa"),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#67e8f9"
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: "#94a3b8", stepSize: 1 },
            grid: { color: "rgba(255,255,255,0.05)" }
          },
          y: {
            ticks: { color: "#94a3b8" },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderWorkerIMC(exams) {
    const can = document.getElementById("chartIMC");
    if (!can) return;
    const ctx = can.getContext('2d');
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

    chartIMC = new Chart(can, {
      type: "bar",
      data: {
        labels: Object.keys(bins),
        datasets: [{
          label: "Trabajadores",
          data: Object.values(bins),
          backgroundColor: ["#fcd34d", "#34d399", "#fbbf24", "#fb7185", "#be123c"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: { backgroundColor: "rgba(15, 23, 42, 0.9)" }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
          y: { 
            beginAtZero: true, 
            ticks: { color: "#94a3b8", stepSize: 1 }, 
            grid: { color: "rgba(255,255,255,0.05)" } 
          }
        }
      }
    });
  }

  function renderWorkerPressure(exams) {
    const can = document.getElementById("chartPressure");
    if (!can) return;
    destroyIfExists(chartPressure);

    const latestExams = getLatestExamsPerWorker(exams);

    const levels = {
      "Normal":         { color: "#34d399", points: [] },
      "Elevada":        { color: "#fbbf24", points: [] },
      "Hipertensión I": { color: "#f59e0b", points: [] },
      "Hipertensión II":{ color: "#fb7185", points: [] }
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
      borderColor: "#fff",
      pointRadius: 7,
      hoverRadius: 11,
      pointBorderWidth: 1
    }));

    chartPressure = new Chart(can, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#94a3b8", usePointStyle: true, boxWidth: 8 }
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.95)",
            titleColor: "#67e8f9"
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Sistólica (mmHg)", color: "#94a3b8" },
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(255,255,255,0.05)" }
          },
          y: {
            title: { display: true, text: "Diastólica (mmHg)", color: "#94a3b8" },
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(255,255,255,0.05)" }
          }
        }
      }
    });
  }

  function renderWorkerCompanies(workers) {
    const can = document.getElementById("chartCompanies");
    if (!can) return;
    destroyIfExists(chartCompanies);

    const counts = countBy(workers, w => w.company_name && w.company_name !== "Sin asignar" ? w.company_name : "Sin asignar");
    const entries = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    chartCompanies = new Chart(can, {
      type: "doughnut",
      data: {
        labels: entries.map(x => x[0]),
        datasets: [{
          data: entries.map(x => x[1]),
          borderWidth: 0,
          backgroundColor: ["#67e8f9", "#3b82f6", "#8b5cf6", "#10b981", "#fbbf24", "#94a3b8"],
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: "right", labels: { color: "#94a3b8", boxWidth: 8, font: { size: 10 } } }
        }
      }
    });
  }

  function renderWorkerStatus(workers, exams) {
    const can = document.getElementById("chart_worker_status");
    if (!can) return;
    destroyIfExists(chartWorkerStatus);

    const counts = { "Habilitado": 0, "No habilitado": 0, "En riesgo": 0, "Sin info": 0 };
    
    workers.forEach(w => {
      const wExams = exams.filter(e => e.worker_id === w.id || (e.rut && w.rut && e.rut.replace(/\./g,'').split('-')[0] === w.rut.replace(/\./g,'').split('-')[0]));
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

      if (minDiff <= 300) counts["En riesgo"]++;
      else counts["Habilitado"]++;
    });

    chartWorkerStatus = new Chart(can, {
      type: "doughnut",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ["#10b981", "#fb7185", "#f59e0b", "#64748b"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: "bottom", labels: { color: "#94a3b8", boxWidth: 8 } }
        }
      }
    });
  }

  function renderExpMonthly(exams) {
    const can = document.getElementById("chart_exp_monthly");
    if (!can) return;
    const ctx = can.getContext('2d');
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

    const grad = getStarkGradient(ctx, "rgba(59, 130, 246, 0.8)", "rgba(59, 130, 246, 0.1)");

    chartExpMonthly = new Chart(can, {
      type: "bar",
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          label: "Vencimientos",
          data: Object.values(buckets),
          backgroundColor: grad,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(255,255,255,.05)" } }
        }
      }
    });
  }

  function renderRiskTypes(exams) {
    const can = document.getElementById("chart_risk_types");
    if (!can) return;
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

    chartRiskTypes = new Chart(can, {
      type: "bar",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ["#10b981", "#fbbf24", "#f59e0b", "#fb7185"],
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(255,255,255,.05)" } },
          y: { ticks: { color: "#94a3b8" }, grid: { display: false } }
        }
      }
    });
  }
  
  function renderCredentialsPct(workers, exams) {
    const can = document.getElementById("chart_credentials_pct");
    if (!can) return;
    destroyIfExists(chartCredentialsPct);

    if (!workers.length) return;

    const withDocs = workers.filter(w => w.credentials && w.credentials.length > 0).length;
    const total = workers.length;
    const withoutDocs = total - withDocs;

    chartCredentialsPct = new Chart(can, {
      type: "doughnut",
      data: {
        labels: ["Con Exámenes", "Sin Exámenes"],
        datasets: [{
          data: [withDocs, withoutDocs],
          backgroundColor: ["#10b981", "rgba(148, 163, 184, 0.3)"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { position: "bottom", labels: { color: "#94a3b8", boxWidth: 8 } }
        }
      }
    });
  }

  function renderExamsDistribution(exams) {
    const can = document.getElementById("chart_exams_distribution");
    if (!can) return;
    const ctx = can.getContext('2d');
    destroyIfExists(chartExamsDistribution);

    const counts = countBy(exams, e => e.credential_name || e.exam_type || "Otros");
    const entries = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const grad = getStarkGradient(ctx, "rgba(59, 130, 246, 0.8)", "rgba(59, 130, 246, 0.1)");

    chartExamsDistribution = new Chart(can, {
      type: "bar",
      data: {
        labels: entries.map(x => x[0]),
        datasets: [{
          label: "Cantidad",
          data: entries.map(x => x[1]),
          backgroundColor: grad,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { display: false } }
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
        renderCredentialsPct(workers || [], exams || []);
        renderExamsDistribution(exams || []);
    }
  };

  window.renderExamTypeDistribution = function(exams) {
    const can = document.getElementById("chart_exam_types");
    if (!can) return;
    const ctx = can.getContext('2d');
    destroyIfExists(window.chartExamTypes);

    const counts = {};
    (exams || []).forEach(e => {
      let type = String(e.exam_type || "").trim();
      if (!type || type.toLowerCase() === "null") return;
      counts[type] = (counts[type] || 0) + 1;
    });

    const sortedEntries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8);
    const labels = sortedEntries.map(e => e[0].toUpperCase());
    const values = sortedEntries.map(e => e[1]);

    const grad = getStarkGradient(ctx, "rgba(59, 130, 246, 0.9)", "rgba(59, 130, 246, 0.2)");

    window.chartExamTypes = new Chart(can, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cantidad',
          data: values,
          backgroundColor: grad,
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
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#67e8f9"
          }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', stepSize: 1 } },
          y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' } } }
        }
      }
    });
  };
})();