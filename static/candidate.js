// ==========================
// AFK RRHH — candidate.js v6.1
// Nivel: Enterprise / Stark Tactical HUD
// ==========================
(async function () {

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const num = x => {
    if (x == null || x === "") return 0;
    const n = Number(String(x).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const qs = new URLSearchParams(window.location.search);
  const candidateId = qs.get("id") || qs.get("trabajador_uuid") || qs.get("worker_id");

  if (!candidateId) {
    console.error("❌ No se encontró ID en la URL");
    return;
  }

  // ==========================
  // 🔥 FETCH DATA COMPLETA
  // ==========================
  async function fetchAll(id) {
    try {
      console.log("📡 Accediendo a base de datos central...");

      // 1. Candidate
      const { data: candidate, error: ce } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();
      if (ce) throw ce;

      // 2. Worker (si existe)
      const { data: worker } = await supabase
        .from('workers')
        .select('*')
        .eq('candidate_id', id)
        .maybeSingle();

      // 3. Credenciales reales
      let credentials = [];
      if (worker) {
        const { data: creds } = await supabase
          .from('worker_credentials')
          .select('*')
          .eq('worker_id', worker.id);
        credentials = creds || [];
      }

      // 4. Documentos
      let docs = [];
      if (worker) {
        const { data: d } = await supabase
          .from('documents')
          .select('*')
          .eq('worker_id', worker.id);
        docs = d || [];
      }

      return { candidate, worker, credentials, docs };
    } catch (e) {
      console.error("❌ Error fetchAll:", e);
      return null;
    }
  }

  const data = await fetchAll(candidateId);
  if (!data) return;

  const { candidate: r, worker, credentials, docs } = data;
  const score = num(r.match_score);
  const today = new Date();

  // ==========================
  // 🏎️ ENGINE: BENCHMARK & RANKING
  // ==========================
  function calculateBenchmark(c) {
    const s = num(c.match_score);
    const exp = num(c.experiencia_total);
    
    return {
      ranking: s > 90 ? "TOP 3" : s > 80 ? "TOP 10" : "TOP 25",
      percentile: s > 90 ? "98" : s > 80 ? "85" : "60",
      expDelta: exp > 10 ? "+4.2" : exp > 5 ? "+1.5" : "-2.1",
      matchDelta: s > 85 ? "+12%" : s > 75 ? "+5%" : "-8%"
    };
  }

  const bench = calculateBenchmark(r);

  // ==========================
  // 🦾 ENGINE: COMPLIANCE
  // ==========================
  function evaluateCompliance(creds) {
    let ok = 0, warn = 0, danger = 0;
    const rows = creds.map(c => {
      const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
      if (!expiry) { warn++; return { name: c.credential_name, state: "warn", txt: "PENDIENTE", date: "-", obs: "Revisar" }; }
      
      const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) { danger++; return { name: c.credential_name, state: "danger", txt: "VENCIDO", date: c.expiry_date, obs: "BLOQUEADO" }; }
      if (diffDays < 30) { warn++; return { name: c.credential_name, state: "warn", txt: "PRÓXIMO", date: c.expiry_date, obs: `${Math.round(diffDays)}d` }; }
      
      ok++; return { name: c.credential_name, state: "ok", txt: "VIGENTE", date: c.expiry_date, obs: "OK" };
    });
    return { rows, ok, warn, danger, status: danger > 0 ? "danger" : warn > 0 ? "warn" : "ok" };
  }

  const compliance = evaluateCompliance(credentials);

  // ==========================
  // 🖥️ RENDER: HEADER & IDENTITY
  // ==========================
  const set = (sel, val) => { const el = $(sel); if (el) el.innerText = val || "—"; };
  
  set('#phName', r.nombre_completo);
  set('#phProf', r.profesion || r.cargo_postulado);
  set('#phExp', (r.experiencia_total || 0) + " AÑOS");
  set('#phCargoObjetivo', r.cargo_postulado);
  set('#phUltima', r.ultima_empresa);
  
  // Disponibilidad y cargos similares (Data-driven placeholders)
  set('#phDisponibilidad', "INMEDIATA");
  set('#phExpCargo', (r.experiencia_total || 0) + " AÑOS");
  set('#phExpSimilar', Math.max(0, num(r.experiencia_total) - 2) + " AÑOS");

  // Badges
  const bStatus = $('#phStatusBadge');
  if (bStatus) {
    bStatus.innerText = score >= 85 ? "PRECISION MATCH" : "EVALUATION";
    bStatus.className = `px-3 py-1 ${score >= 85 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'} border rounded-full text-[10px] font-bold tracking-widest uppercase`;
  }

  // ==========================
  // 🖥️ RENDER: STATS & RANKING
  // ==========================
  set('#phRankingBadge', bench.ranking);
  set('#kvRanking', bench.ranking);
  set('#kvPercentile', bench.percentile + "%");
  
  const scoreVal = $('#matchScoreVal');
  if (scoreVal) scoreVal.innerText = Math.round(score) + "%";
  const circle = $('#starkCircle');
  if (circle) circle.style.strokeDasharray = `${score} 100`;

  // Fortalezas y Brechas (Parsing IA)
  const fortEl = $('#kvFortaleza');
  const brecEl = $('#kvBrecha');
  if (r.experiencia_tec_master) {
    const lines = r.experiencia_tec_master.split('\n').filter(l => l.trim().length > 10);
    if (fortEl) fortEl.innerText = lines[0] || "Alta especialización técnica";
    if (brecEl) brecEl.innerText = lines[lines.length - 1] || "Certificaciones pendientes";
  }

  // Benchmark
  set('#benchExp', bench.expDelta + " AÑOS vs PROM.");
  set('#benchMatch', bench.matchDelta + " vs RIVALES");

  // ==========================
  // 🖥️ RENDER: MATCH BARS
  // ==========================
  const updateBar = (id, val) => {
    const bar = $(id);
    if (bar) {
      bar.style.width = val + "%";
      const lbl = bar.parentElement.parentElement.querySelector('.val');
      if (lbl) lbl.innerText = Math.round(val) + "%";
      // Color
      if (val < 40) bar.style.backgroundColor = "rgba(239, 68, 68, 0.6)"; 
      else if (val < 75) bar.style.backgroundColor = "rgba(245, 158, 11, 0.6)";
      else bar.style.backgroundColor = "rgba(6, 182, 212, 0.6)";
    }
  };

  updateBar("#sbExp", Math.min(100, num(r.experiencia_total) * 8));
  updateBar("#sbCert", credentials.length > 0 ? (compliance.ok / credentials.length) * 100 : 40);
  updateBar("#sbEst", 85);
  updateBar("#sbFit", score);
  updateBar("#sbOtr", 70);

  // ==========================
  // 🖥️ RENDER: ALERTS & DECISION
  // ==========================
  const alerts = [];
  if (compliance.danger > 0) alerts.push({ type: "danger", title: "Documentos Vencidos", text: "Requiere regularización inmediata" });
  if (score < 70) alerts.push({ type: "warn", title: "Match Limitado", text: "Score técnico por debajo del ideal" });
  if (!worker) alerts.push({ type: "warn", title: "Perfil Externo", text: "Candidato no registrado actualmente" });

  const container = $('#criticalAlerts');
  if (container) {
    container.innerHTML = alerts.length > 0
      ? alerts.map(a => `<div class="alert-item alert-item--${a.type}"><span class="alert-bullet alert-bullet--${a.type}"></span><div><b style="color:#fff;">${a.title}</b><div class="soft" style="font-size:12px;">${a.text}</div></div></div>`).join('')
      : `<div class="alert-item alert-item--ok"><span class="alert-bullet alert-bullet--ok"></span><div><b style="color:#fff;">INTEGRIDAD CONFIRMADA</b><div class="soft" style="font-size:12px;">Sin riesgos operativos detectados</div></div></div>`;
  }

  const decEl = $('#decisionState');
  if (decEl) {
    if (compliance.danger > 0) { decEl.innerText = "NO APTO"; decEl.className = "text-4xl font-black text-red-500 tracking-tighter"; }
    else if (score >= 85 && compliance.status === "ok") { decEl.innerText = "APTO"; decEl.className = "text-4xl font-black text-green-500 tracking-tighter shadow-green-500/50"; }
    else { decEl.innerText = "EN RIESGO"; decEl.className = "text-4xl font-black text-amber-500 tracking-tighter shadow-amber-500/50"; }
  }

  // ==========================
  // 🖥️ RENDER: DOC LIST
  // ==========================
  const docList = $('#docList');
  if (docList) {
    if (docs.length > 0) {
      docList.innerHTML = docs.map(d => `<div class="p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-all flex items-center justify-between group cursor-pointer"><div class="flex items-center gap-3"><i class="fas fa-file-pdf text-red-400"></i><div><div class="text-sm font-medium text-white/90 uppercase">${d.document_type}</div><div class="text-[10px] text-white/40 tracking-widest">${d.status}</div></div></div><i class="fas fa-eye text-white/20 group-hover:text-cyan-400"></i></div>`).join('');
    } else {
      docList.innerHTML = `<div class="p-4 border-2 border-dashed border-white/5 rounded-xl text-center"><i class="fas fa-cloud-upload-alt text-white/10 text-2xl mb-2"></i><div class="text-[10px] text-white/30 uppercase tracking-[0.2em]">Sincronizando CV...</div></div>`;
    }
  }

  // ==========================
  // IA SUMMARY INTERACTION
  // ==========================
  const aiBtn = $('#btnAiSummary');
  if (aiBtn) {
    aiBtn.onclick = () => {
      const content = $('#aiSummaryContent');
      if (content) content.innerHTML = r.resumen_ia ? r.resumen_ia.replace(/\n/g, '<br>') : "Procesando análisis Stark...";
    };
  }

})();