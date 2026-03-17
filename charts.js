(function () {
  const num = (x) => {
    if (x == null || x === "") return NaN;
    return Number(String(x).replace(",", "."));
  };

  let chartNotas = null;
  let chartScatter = null;
  let chartProfesiones = null;
  let chartPipeline = null;

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

  window.renderAfkCharts = function (items) {
    renderNotas(items || []);
    renderScatter(items || []);
    renderProfesiones(items || []);
    renderPipeline(items || []);
  };
})();