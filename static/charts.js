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
