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

      // 5. Vacantes Abiertas
      const { data: vacancies } = await supabase
        .from('vacancies')
        .select('id, title, requirements')
        .eq('status', 'Abierta');

      return { candidate, worker, credentials, docs, vacancies: vacancies || [] };
    } catch (e) {
      console.error("❌ Error fetchAll:", e);
      return null;
    }
  }

  const data = await fetchAll(candidateId);
  if (!data) return;

  const { candidate: r, worker, credentials, docs, vacancies } = data;
  const today = new Date();

  // ==========================
  // 🏎️ ENGINE: MATCHING & HUD CACHE
  // ==========================
  function calculateCandidateMatch(cand, vac) {
    if (!vac || !cand) return 0;
    const clean = t => (t || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const candText = clean(`${cand.profesion} ${cand.cargo_postulado} ${cand.evaluacion_general} ${cand.experiencia_general} ${cand.resumen_ia} ${cand.experiencia_tec_master}`);
    const vacTitle = clean(vac.title);
    const vacReqs = (vac.requirements || []).map(r => clean(r));

    let tScore = 0;
    if (candText.includes(vacTitle)) tScore = 40;
    else if (vacTitle.split(' ').some(w => w.length > 3 && candText.includes(w))) tScore = 25;

    let rHits = 0;
    if (vacReqs.length > 0) {
      vacReqs.forEach(req => {
        const words = req.split(' ').filter(w => w.length > 3);
        if (candText.includes(req) || words.some(w => candText.includes(w))) rHits++;
      });
      rHits = (rHits / vacReqs.length) * 60;
    } else { rHits = 30; }

    return Math.min(100, tScore + rHits);
  }

  // Pre-calculate scores for all vacancies
  const scoredVacancies = vacancies.map(v => ({
    ...v,
    match: calculateCandidateMatch(r, v)
  })).sort((a,b) => b.match - a.match);

  // Initialize Selector
  const vSelector = $('#vacancySelectorHUD');
  if (vSelector) {
    vSelector.innerHTML = scoredVacancies.length > 0 
      ? scoredVacancies.map(v => `<option value="${v.id}">${v.title.toUpperCase()} (${Math.round(v.match)}%)</option>`).join('')
      : '<option value="">SIN VACANTES DISPONIBLES</option>';
    
    vSelector.onchange = () => {
      const selected = scoredVacancies.find(x => x.id === vSelector.value);
      if (selected) updateHUD(selected);
    };
  }

  function updateHUD(vac) {
    const score = vac ? vac.match : num(r.match_score);
    
    // Circular Chart
    const scoreVal = $('#matchScoreVal');
    if (scoreVal) scoreVal.innerText = Math.round(score) + "%";
    const circle = $('#starkCircle');
    if (circle) circle.style.strokeDasharray = `${score} 100`;

    // Ranking/Merit Labels
    const badge = $('#phRankingBadge');
    if (badge) {
      badge.innerText = score > 85 ? "TOP MATCH" : score > 70 ? "HIGH AFINITY" : "EVALUATION REQUIRED";
      badge.style.color = score > 85 ? "var(--ok)" : score > 70 ? "var(--accent)" : "var(--warn)";
    }
    
    const context = $('#rankingContext');
    if (context) context.innerText = vac ? `Afinidad con: ${vac.title}` : "Análisis táctico completado.";

    // Decision Logic
    const decEl = $('#decisionState');
    const bStatus = $('#phStatusBadge');
    const compliance = evaluateCompliance(credentials);

    if (decEl) {
      if (compliance.danger > 0) {
        decEl.innerText = "NO APTO"; decEl.className = "text-4xl font-black text-red-500 tracking-tighter";
      } else if (score >= 80 && compliance.status === "ok") {
        decEl.innerText = "APTO"; decEl.className = "text-4xl font-black text-green-500 tracking-tighter shadow-green-500/50";
      } else {
        decEl.innerText = "EN RIESGO"; decEl.className = "text-4xl font-black text-amber-500 tracking-tighter shadow-amber-500/50";
      }
    }

    if (bStatus) {
      bStatus.innerText = score >= 80 ? "PRECISION MATCH" : "REVIEW NEEDED";
      bStatus.className = `px-3 py-1 ${score >= 80 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'} border rounded-full text-[10px] font-bold tracking-widest uppercase`;
    }

    // Update process state in hero summary
    const statusSec = $('#phStatusSecondary');
    if (statusSec) statusSec.innerText = vac ? vac.title : "Sin vacante vinculada";

    // Update bars
    updateBar("#sbFit", score);
  }

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


  // Stark Benchmarks (Keep labels but use new logic)
  set('#phRankingBadge', "SCANNING...");
  set('#kvRanking', "TOP 3"); // Placeholder logic can stay in secondary panels
  set('#kvPercentile', "98%");

  // Fortalezas y Brechas (Parsing IA)
  const fortEl = $('#kvFortaleza');
  const brecEl = $('#kvBrecha');
  if (r.experiencia_tec_master) {
    const lines = r.experiencia_tec_master.split('\n').filter(l => l.trim().length > 10);
    if (fortEl) fortEl.innerText = lines[0] || "Alta especialización técnica";
    if (brecEl) brecEl.innerText = lines[lines.length - 1] || "Certificaciones pendientes";
  }

  // Benchmark (Placeholders)
  set('#benchExp', "+2.5 AÑOS vs PROM.");
  set('#benchMatch', "+15% vs RIVALES");

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
  // Note: updateBar("#sbFit", score) is now handled inside updateHUD()
  updateBar("#sbOtr", 70);

  // Initial HUD Render (Best match)
  if (scoredVacancies.length > 0) {
    updateHUD(scoredVacancies[0]);
  } else {
    updateHUD(null);
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