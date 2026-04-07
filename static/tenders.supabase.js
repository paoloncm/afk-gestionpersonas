/** 
 * tenders.supabase.js - Protocolo Stark Intelligence V20 (Master Merge)
 * 
 * Combinando Arquitectura Estable (V16 del Usuario) + Escaneo Level-God (JARVIS)
 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // =========================================================
  // STATE & CONFIG
  // =========================================================
  const state = {
    allTenders: [],
    detectedVacancies: [],
    selectedTenderId: null,
    activeMatchTender: null,
    activeMatchVacancies: [],
    activeMatchVacancyIndex: 0,
    talentCache: {
      workers: null,
      workerCredentials: null,
      candidates: null,
      shortlistsByVacancy: {},
      lastLoadedAt: 0
    }
  };

  const CACHE_TTL_MS = 60 * 1000;

  const REQUIREMENT_ALIASES = {
    "altura fisica": ["altura fisica", "trabajo en altura", "altura", "altfis", "altura geográfica", "altura geografica"],
    "silice": ["silice", "sílice"],
    "ruido": ["ruido"],
    "infpsico": ["infpsico", "informe psicologico", "informe psicológico", "psicologico", "psicológico"],
    "examen preocupacional": ["preocupacional", "examen preocupacional", "preocupacional vigente"],
    "licencia conducir": ["licencia conducir", "licencia de conducir", "licencia clase b", "licencia clase a", "licencia"],
    "curso": ["curso", "capacitacion", "capacitación", "certificacion", "certificación"],
    "certificacion": ["certificacion", "certificación", "acreditacion", "acreditación"],
    "operador": ["operador", "operacion", "operación"],
    "soldador": ["soldador", "soldadura"],
    "electrico": ["electrico", "eléctrico", "electricidad"],
    "mecanico": ["mecanico", "mecánico", "mecánica", "mecanica"],
    "conductor": ["conductor", "chofer", "driver"],
    "supervisor": ["supervisor", "jefe", "encargado"],
    "ingeniero": ["ingeniero", "engineering"]
  };

  // =========================================================
  // HELPERS
  // =========================================================
  const openModal = (m) => m?.classList.add('is-open');
  const closeModal = (m) => m?.classList.remove('is-open');
  
  const notify = (msg) => { if (typeof window.notificar === 'function') window.notificar(msg); else console.log(msg); };
  const notifyError = (msg, err) => { console.error(msg, err); notify(`ERROR: ${msg}`); };
  const escapeHtml = (v) => { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; };

  function normalizeText(v) {
    return String(v || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function safeArray(v) { return Array.isArray(v) ? v : []; }

  // =========================================================
  // MOTOR DE PROCESAMIENTO PDF LEVEL-GOD (JARVIS)
  // =========================================================
  const StarkProcessor = {
    async process(file) {
        this.updateRadar("INICIANDO MATRIX SCAN...", "Accediendo al binario del pliego...");
        const text = await this.extractText(file);
        this.updateRadar("EXTRACCIÓN COMPLETADA", `Analizando con JARVIS AI...`);
        return await this.analyzeTender(text);
    },
    async extractText(file) {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let txt = "";
        for (let i = 1; i <= pdf.length || pdf.numPages; i++) {
            const num = pdf.numPages || pdf.length;
            this.updateRadar(`ESCANEANDO PÁGINA ${i}/${num}`, "Detectando jerarquía...");
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            txt += content.items.map(it => it.str).join(" ") + "\n";
            if (i >= (pdf.numPages || pdf.length)) break;
        }
        return txt;
    },
    async analyzeTender(text) {
        const res = await fetch('/api/analyze-tender', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ text: text.substring(0, 30000) }) 
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.detail);
        return data.analysis;
    },
    updateRadar(t, l) {
        if ($('#radarText')) $('#radarText').textContent = t;
        if ($('#radarLog')) $('#radarLog').textContent = l;
    }
  };

  // =========================================================
  // SCORING & MATCHMAKING
  // =========================================================
  function matchesRequirement(sourceText, requirement) {
    const source = normalizeText(sourceText);
    const normReq = normalizeText(requirement);
    const aliases = REQUIREMENT_ALIASES[normReq] || [normReq];
    return aliases.some(alias => source.includes(normalizeText(alias)));
  }

  function scoreRequirements(sourceText, requirements) {
    const reqs = safeArray(requirements).map(r => String(r).trim()).filter(Boolean);
    if (!reqs.length) return { score: 0, missing: [], matched: [] };
    const matched = [], missing = [];
    for (const req of reqs) {
      if (matchesRequirement(sourceText, req)) matched.push(req);
      else missing.push(req);
    }
    return { score: Math.round((matched.length / reqs.length) * 100), missing, matched };
  }

  function getWorkerSourceText(worker, credentials) {
    const credsText = (credentials || []).map(c => [c.credential_name, c.exam_type, c.result_status].filter(Boolean).join(' ')).join(' ');
    return [worker?.full_name, worker?.cargo, worker?.position, worker?.profession, credsText].filter(Boolean).join(' ');
  }

  function getCandidateSourceText(candidate) {
    return [candidate?.nombre_completo, candidate?.profesion, candidate?.evaluacion_general, candidate?.experiencia_general, candidate?.cargo_a_desempenar].filter(Boolean).join(' ');
  }

  // =========================================================
  // API & DATA
  // =========================================================
  async function loadTenders() {
    try {
      if (!window.supabase) return setTimeout(loadTenders, 500);
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      state.allTenders = data || [];
      renderTenders();
    } catch (error) { notifyError('Fallo en carga de licitaciones.', error); }
  }

  async function ensureTalentDataLoaded(force = false) {
    const now = Date.now();
    const cacheFresh = (now - state.talentCache.lastLoadedAt) < CACHE_TTL_MS;
    if (!force && cacheFresh && state.talentCache.workers) return state.talentCache;

    const [w, cr, cd, sl] = await Promise.all([
      window.supabase.from('workers').select('*'),
      window.supabase.from('worker_credentials').select('*'),
      window.supabase.from('candidates').select('*'),
      window.supabase.from('vacancy_shortlists').select('*')
    ]);

    state.talentCache.workers = w.data || [];
    state.talentCache.workerCredentials = cr.data || [];
    state.talentCache.candidates = cd.data || [];
    
    const slMap = {};
    (sl.data || []).forEach(item => {
      if (!slMap[item.vacancy_id]) slMap[item.vacancy_id] = [];
      slMap[item.vacancy_id].push(item);
    });
    state.talentCache.shortlistsByVacancy = slMap;
    state.talentCache.lastLoadedAt = now;
    return state.talentCache;
  }

  // =========================================================
  // UI RENDERERS
  // =========================================================
  function renderTenders() {
    const body = $('#tendersBody'); if (!body) return;
    const term = normalizeText($('#searchTender')?.value || '');
    const filtered = state.allTenders.filter(t => normalizeText(t.name).includes(term) || normalizeText(t.description).includes(term));

    body.innerHTML = filtered.map(t => `
        <div class="t-row stark-card" data-id="${t.id}" style="margin-bottom:10px; padding:18px 20px; display:flex; align-items:center;">
          <div style="flex: 0 0 25%; font-weight:800; color:var(--text); cursor:pointer;" onclick="editTenderById('${t.id}', 'intel')">
             <span style="color:var(--accent)">[</span> ${escapeHtml(t.name)} <span style="color:var(--accent)">]</span>
          </div>
          <div style="flex: 0 0 35%; color:var(--muted); font-size:11px;">${escapeHtml(t.description || '')}</div>
          <div style="flex:1; display:flex; flex-wrap:wrap; gap:5px;">
            ${safeArray(t.requirements).slice(0,3).map(r => `<span class="badge" style="font-size:10px;">${escapeHtml(r)}</span>`).join('')}
          </div>
          <div style="flex:0 0 150px; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn--mini btn--primary" onclick="runMatchmakingById('${t.id}')">[ OPERATIVO ]</button>
            <button class="btn btn--mini btn-delete" onclick="deleteTender('${t.id}')" style="color:var(--danger); opacity:0.6;">🗑️</button>
          </div>
        </div>
    `).join('');
  }

  function renderDetectedVacancies() {
    const list = $('#vacanciesList'); if (!list) return;
    $('#vacanciesWrapper').style.display = state.detectedVacancies.length ? 'block' : 'none';
    list.innerHTML = state.detectedVacancies.map((v, i) => `
      <div class="stark-card" style="padding:15px; margin-bottom:8px; border-left:2px solid var(--accent); display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1;">
          <input class="input" value="${escapeHtml(v.title)}" style="background:transparent; border:none; font-weight:900; color:var(--accent); width:100%; border-bottom:1px solid rgba(255,255,255,0.05);" onchange="state.detectedVacancies[${i}].title=this.value">
          <div style="font-size:9px; color:var(--muted); margin-top:4px;">${safeArray(v.requirements).join(' • ')}</div>
        </div>
        <div style="width:60px; margin:0 15px;">
          <input type="number" class="input" value="${v.total_positions || 1}" onchange="state.detectedVacancies[${i}].total_positions=parseInt(this.value)" style="background:rgba(0,0,0,0.2); text-align:center;">
        </div>
        <button type="button" class="btn btn--mini" onclick="removeVacancy(${i})" style="color:var(--danger)">×</button>
      </div>
    `).join('');
  }

  window.removeVacancy = (i) => { state.detectedVacancies.splice(i, 1); renderDetectedVacancies(); };

  async function updateIntelTab(id) {
    const tender = getTenderById(id);
    if ($('#intelTenderInfo')) $('#intelTenderInfo').textContent = tender?.description || '';
    try {
      const [{ data: vacs }, talent] = await Promise.all([
        window.supabase.from('vacancies').select('*').eq('tender_id', id),
        ensureTalentDataLoaded()
      ]);
      const slByVac = talent.shortlistsByVacancy || {};
      $('#intelVacancyList').innerHTML = (vacs || []).map(v => {
        const count = (slByVac[v.id] || []).length, pos = v.total_positions || 1, pct = Math.round((count / pos) * 100);
        return `
          <div class="stark-card" style="padding:15px; margin-bottom:10px; border-left:3px solid ${pct >= 100 ? 'var(--ok)' : 'var(--accent)'};">
            <div style="display:flex; justify-content:space-between; align-items:start;">
              <div><div style="font-size:10px; font-weight:900;">[ ${escapeHtml(v.title.toUpperCase())} ]</div><div style="font-size:13px; font-weight:700; margin:5px 0;">${count} / ${pos} PUESTOS</div></div>
              <div style="font-size:18px; font-weight:900; color:var(--accent)">${pct}%</div>
            </div>
            <div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>
          </div>`;
      }).join('');
    } catch (err) { notifyError('Fallo en vista de inteligencia.', err); }
  }

  // =========================================================
  // ACTIONS
  // =========================================================
  async function handleFile(f) {
    if (!f) return;
    $('#scannerOverlay').style.display = 'flex';
    try {
        const analysis = await StarkProcessor.process(f);
        $('#tenderName').value = `Licitación: ${analysis.roles[0]?.nombre || f.name.replace('.pdf','')}`;
        $('#tenderDesc').value = analysis.tender_summary || "";
        
        $('#reqContainer').innerHTML = '';
        (analysis.roles[0]?.requisitos || []).slice(0, 5).forEach(r => addReqInput(r));
        
        state.detectedVacancies = analysis.roles.map(r => ({ 
            title: r.nombre, 
            requirements: [...(r.requisitos||[]), ...(r.certificaciones||[]), r.experiencia_minima].filter(v=>v), 
            total_positions: r.cantidad || 1 
        }));
        renderDetectedVacancies();
        notify("INTEGRACIÓN NIVEL STARK COMPLETADA");
    } catch (e) { notifyError("Error en Scan", e); }
    $('#scannerOverlay').style.display = 'none';
  }

  async function saveTender(e) {
    if (e) e.preventDefault();
    try {
      const id = $('#tenderId').value;
      const payload = {
        name: $('#tenderName').value.trim(),
        description: $('#tenderDesc').value.trim(),
        requirements: $$('.req-input').map(i => i.value.trim()).filter(Boolean)
      };
      
      const { data: tRes, error: tErr } = id ? 
        await window.supabase.from('tenders').update(payload).eq('id', id).select() :
        await window.supabase.from('tenders').insert(payload).select();

      if (tErr) throw tErr;
      const tid = id || tRes[0].id;

      // Sincronizar vacantes
      const { data: exV } = await window.supabase.from('vacancies').select('id').eq('tender_id', tid);
      const exIds = (exV||[]).map(v => v.id), nIds = state.detectedVacancies.map(v => v.id).filter(i => i);
      const toDel = exIds.filter(i => !nIds.includes(i));
      if (toDel.length) await window.supabase.from('vacancies').delete().in('id', toDel);

      await window.supabase.from('vacancies').upsert(state.detectedVacancies.map(v => ({
        id: v.id || undefined,
        tender_id: tid,
        title: v.title,
        requirements: v.requirements,
        total_positions: v.total_positions || 1
      })));

      notify('PROTOCOL_ENTRY: INTEGRIDAD DE DATOS SINCRONIZADA.');
      closeModal($('#tenderModal'));
      loadTenders();
    } catch (err) { notifyError('Fallo al guardar licitación.', err); }
  }

  async function runMatchmaking(tender) {
    state.activeMatchTender = tender;
    openModal($('#matchModal'));
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    setMatchTab('workers');

    const { data: v } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    state.activeMatchVacancies = v?.length ? v : [{ id: 'global', title: 'Operación Global', requirements: tender.requirements, total_positions: 1 }];
    
    if ($('#vacancySelector')) {
        $('#vacancySelector').innerHTML = state.activeMatchVacancies.map((vac, i) => `<option value="${i}">[ ${escapeHtml(vac.title.toUpperCase())} ]</option>`).join('');
        $('#vacancySelector').onchange = () => evaluateVacancy(state.activeMatchVacancies[$('#vacancySelector').value]);
    }
    evaluateVacancy(state.activeMatchVacancies[0]);
  }

  async function evaluateVacancy(vacancy) {
    const talent = await ensureTalentDataLoaded();
    const reqs = vacancy.requirements || [];
    const sl = talent.shortlistsByVacancy[vacancy.id] || [];

    const scoredW = talent.workers.map(w => ({
        person: w,
        ...scoreRequirements(getWorkerSourceText(w, talent.workerCredentials.filter(c => c.worker_id === w.id)), reqs),
        isS: sl.some(s => s.person_id === w.id)
    })).sort((a,b) => b.score - a.score);

    const scoredC = talent.candidates.map(c => ({
        person: { ...c, full_name: c.nombre_completo },
        ...scoreRequirements(getCandidateSourceText(c), reqs),
        isS: sl.some(s => s.person_id === c.id)
    })).sort((a,b) => b.score - a.score);

    $('#matchBodyWorkers').innerHTML = renderMatchGrid(scoredW, vacancy.id, 'AFK');
    $('#matchBodyCandidates').innerHTML = renderMatchGrid(scoredC, vacancy.id, 'IA EXTERNO');
  }

  function renderMatchGrid(list, vacId, label) {
    return list.map(item => `
        <div class="stark-card" style="padding:15px; margin-bottom:10px; cursor:pointer; border:${item.isS ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)'};">
          <div style="display:flex; justify-content:space-between; align-items:start;" onclick="StarkUI.openPersonProfile('${item.person.id}', '${item.person.full_name ? 'worker':'candidate'}')">
            <div><strong>${escapeHtml(item.person.full_name.toUpperCase())}</strong><div style="font-size:9px; color:var(--muted);">${escapeHtml(item.person.cargo || item.person.profesion || '')}</div></div>
            <div style="text-align:right;"><span style="color:var(--accent); font-weight:900;">${item.score}%</span><div style="font-size:8px; color:var(--muted);">${label} MATCH</div></div>
          </div>
          <div class="affinity-bar"><div class="affinity-fill" style="width:${item.score}%"></div></div>
          ${item.missing.length ? `<div style="font-size:8px; color:#ff3264; margin-top:5px;">GAP: ${item.missing.join(' • ')}</div>` : ''}
          <div style="margin-top:10px; text-align:right;">
             ${!item.isS && vacId !== 'global' ? `<button class="btn btn--mini primary" onclick="shortlist('${vacId}', '${item.person.id}', '${item.person.full_name ? 'worker':'candidate'}', ${item.score})">+ PRESELECCIONAR</button>` : `<span style="color:var(--accent); font-size:10px;">[ SELECCIONADO ]</span>`}
          </div>
        </div>`).join('');
  }

  window.shortlist = async (vid, pid, type, score) => {
    await window.supabase.from('vacancy_shortlists').upsert({ vacancy_id: vid, person_id: pid, person_type: type, score: score }, { onConflict: 'vacancy_id, person_id, person_type' });
    notify("PIPELINE ACTUALIZADO");
    await ensureTalentDataLoaded(true);
    evaluateVacancy(state.activeMatchVacancies[$('#vacancySelector').value]);
  };

  // =========================================================
  // BOOTSTRAP
  // =========================================================
  function bindGlobalEvents() {
    $('#btnNewTender').onclick = () => editTenderById(null);
    $('#searchTender').oninput = () => renderTenders();
    $('#tenderForm').onsubmit = (e) => saveTender(e);

    $('#tabTenderEdit').onclick = () => setTenderTab('edit');
    $('#tabTenderIntel').onclick = () => { setTenderTab('intel'); if ($('#tenderId').value) updateIntelTab($('#tenderId').value); };
    $('#tabWorkers').onclick = () => setMatchTab('workers');
    $('#tabCandidates').onclick = () => setMatchTab('candidates');

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => {
        closeModal($('#tenderModal')); closeModal($('#matchModal')); closeModal($('#personProfileModal'));
    });

    // Drag & Drop JARVIS
    const z = $('#uploadZone'), i = $('#pdfInput');
    if (z && i) {
        z.onclick = () => i.click();
        i.onchange = (e) => handleFile(e.target.files[0]);
        z.ondragover = (e) => { e.preventDefault(); z.style.borderColor = 'var(--accent)'; z.style.background = 'rgba(34,211,238,0.1)'; };
        z.ondragleave = () => { z.style.borderColor = 'var(--border)'; z.style.background = 'transparent'; };
        z.ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') handleFile(f); };
    }
  }

  function setTenderTab(tab) {
    const isE = tab === 'edit';
    $('#tenderEditContent').style.display = isE ? 'flex' : 'none';
    $('#tenderIntelContent').style.display = isE ? 'none' : 'flex';
    $('#tabTenderEdit').className = `tab ${isE ? 'active' : ''}`;
    $('#tabTenderIntel').className = `tab ${!isE ? 'active' : ''}`;
  }

  function setMatchTab(tab) {
    const isW = tab === 'workers';
    $('#matchBodyWorkers').style.display = isW ? 'block' : 'none';
    $('#matchBodyCandidates').style.display = isW ? 'none' : 'block';
    $('#tabWorkers').className = `tab ${isW ? 'active' : ''}`;
    $('#tabCandidates').className = `tab ${!isW ? 'active' : ''}`;
  }

  function addReqInput(v = '') {
    const d = document.createElement('div'); d.style.display = 'flex'; d.style.gap = '8px'; d.style.marginBottom = '5px';
    d.innerHTML = `<input class="input req-input" value="${escapeHtml(v)}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="this.parentElement.remove()">×</button>`;
    $('#reqContainer').appendChild(d);
  }

  window.editTenderById = async (id, tab = 'edit') => {
    const t = id ? state.allTenders.find(x => x.id === id) : { id: '', name: '', description: '', requirements: [] };
    $('#tenderId').value = t.id; $('#tenderName').value = t.name; $('#tenderDesc').value = t.description || '';
    $('#reqContainer').innerHTML = ''; (t.requirements || []).forEach(r => addReqInput(r)); if (!t.requirements?.length) addReqInput();
    if (id) { const { data } = await window.supabase.from('vacancies').select('*').eq('tender_id', id); state.detectedVacancies = data || []; }
    else state.detectedVacancies = [];
    renderDetectedVacancies(); setTenderTab(tab); openModal($('#tenderModal'));
    if (tab === 'intel') updateIntelTab(id);
  };

  window.runMatchmakingById = (id) => runMatchmaking(state.allTenders.find(t => t.id === id));

  window.deleteTender = async (id) => {
    if (confirm('¿DESACTIVAR PROYECTO?')) {
        await window.supabase.from('vacancies').delete().eq('tender_id', id);
        await window.supabase.from('tenders').delete().eq('id', id);
        loadTenders();
    }
  };

  window.StarkUI = {
    openPersonProfile: async (id, type) => {
        $('#scannerOverlay').style.display = 'flex'; openModal($('#personProfileModal'));
        try {
            const { data: p } = await window.supabase.from(type === 'worker' ? 'workers' : 'candidates').select('*').eq('id', id).single();
            if (p) {
                $('#profileName').textContent = (p.full_name || p.nombre_completo || '').toUpperCase();
                $('#profileProfession').textContent = p.cargo || p.profesion || '';
                $('#profileCvSummary').innerHTML = p.evaluacion_general || p.perfil_profesional || '';
                $('#profileEditBtn').onclick = () => window.location.href = type === 'worker' ? `worker.html?id=${id}` : `candidate.html?id=${id}`;
            }
        } catch (e) {}
        setTimeout(() => $('#scannerOverlay').style.display = 'none', 800);
    }
  };

  async function init() {
    bindGlobalEvents();
    loadTenders();
  }

  init();
})();
