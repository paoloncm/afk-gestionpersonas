// tenders.supabase.js - Lógica Stark Intelligence V15: MATCHMAKING TOTAL & ANÁLISIS DE GAPS
(function () {
  const $ = (s) => document.querySelector(s);
  
  // UI - Dash & Modals
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const personProfileModal = $('#personProfileModal');
  const tendersBody = $('#tendersBody');
  const searchInput = $('#searchTender');

  const scannerOverlay = $('#scannerOverlay');
  const radarText = $('#radarText');
  const radarLog = $('#radarLog');
  const uploadZone = $('#uploadZone');
  const pdfInput = $('#pdfInput');
  const intelPreview = $('#intelPreview');
  const intelReqs = $('#intelReqs');
  const intelDesc = $('#intelDesc');
  const btnStarkScan = $('#btnStarkScan');
  const vacanciesWrapper = $('#vacanciesWrapper');
  const vacanciesList = $('#vacanciesList');

  const tabWorkers = $('#tabWorkers');
  const tabCandidates = $('#tabCandidates');
  const matchBodyWorkers = $('#matchBodyWorkers');
  const matchBodyCandidates = $('#matchBodyCandidates');
  const vacancySelector = $('#vacancySelector');

  let allTenders = [];
  let detectedVacancies = [];
  let currentScanVacancies = [];

  const openModal = (m) => m?.classList.add('is-open');
  const closeModal = (m) => m?.classList.remove('is-open');

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { closeModal(tenderModal); closeModal(matchModal); closeModal(personProfileModal); };
  });

  // --- TABS: TENDER ---
  const tabEdit = $('#tabTenderEdit');
  const tabIntel = $('#tabTenderIntel');
  const contentEdit = $('#tenderEditContent');
  const contentIntel = $('#tenderIntelContent');

  function switchToTenderTab(tab) {
    if (tab === 'edit') {
        contentEdit.style.display = 'block';
        contentIntel.style.display = 'none';
        tabEdit.className = 'tab active';
        tabEdit.style.color = 'var(--accent)';
        tabEdit.style.borderBottom = '2px solid var(--accent)';
        tabIntel.className = 'tab';
        tabIntel.style.color = 'var(--muted)';
        tabIntel.style.borderBottom = '2px solid transparent';
    } else {
        contentEdit.style.display = 'none';
        contentIntel.style.display = 'block';
        tabIntel.className = 'tab active';
        tabIntel.style.color = 'var(--accent)';
        tabIntel.style.borderBottom = '2px solid var(--accent)';
        tabEdit.className = 'tab';
        tabEdit.style.color = 'var(--muted)';
        tabEdit.style.borderBottom = '2px solid transparent';
        if ($('#tenderId').value) updateIntelTab($('#tenderId').value);
    }
  }

  if (tabEdit && tabIntel) {
    tabEdit.onclick = () => switchToTenderTab('edit');
    tabIntel.onclick = () => switchToTenderTab('intel');
  }

  // --- TABS: MATCHMAKING ---
  if (tabWorkers && tabCandidates) {
    tabWorkers.onclick = () => {
        matchBodyWorkers.style.display = 'block';
        matchBodyCandidates.style.display = 'none';
        tabWorkers.className = 'tab active';
        tabWorkers.style.color = 'var(--accent)';
        tabWorkers.style.borderBottom = '2px solid var(--accent)';
        tabCandidates.className = 'tab';
        tabCandidates.style.color = 'var(--muted)';
        tabCandidates.style.borderBottom = '2px solid transparent';
    };
    tabCandidates.onclick = () => {
        matchBodyWorkers.style.display = 'none';
        matchBodyCandidates.style.display = 'block';
        tabCandidates.className = 'tab active';
        tabCandidates.style.color = 'var(--accent)';
        tabCandidates.style.borderBottom = '2px solid var(--accent)';
        tabWorkers.className = 'tab';
        tabWorkers.style.color = 'var(--muted)';
        tabWorkers.style.borderBottom = '2px solid transparent';
    };
  }

  // --- DASHBOARD ---
  async function loadTenders() {
    try {
      if (!window.supabase) return setTimeout(loadTenders, 500);
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allTenders = data || [];
      renderTenders();
    } catch (err) { console.error(err); }
  }
  loadTenders();

  function renderTenders() {
    if (!tendersBody) return;
    const term = (searchInput?.value || "").toLowerCase();
    const filtered = allTenders.filter(t => (t.name||"").toLowerCase().includes(term) || (t.description||"").toLowerCase().includes(term));

    tendersBody.innerHTML = filtered.map(t => {
      const topReqs = (t.requirements || []).slice(0, 3).map(r => `<span class="badge" style="font-size:10px; border-color:rgba(34,211,238,0.2)">${r}</span>`).join('');
      return `
        <div class="t-row stark-card" style="margin-bottom:10px; padding: 18px 20px; display:flex; align-items: center;">
          <div style="flex: 0 0 25%;">
            <div style="font-weight: 800; color:var(--text); font-size:15px; cursor:pointer;" onclick="window.editTenderById('${t.id}', 'intel')">
               <span style="color:var(--accent)">[</span> ${escapeHtml(t.name)} <span style="color:var(--accent)">]</span>
            </div>
          </div>
          <div style="flex: 0 0 35%; padding-right:15px; font-size:11px; color:var(--muted); line-height:1.4;">
             ${escapeHtml(t.description || 'Sin descripción estratégica')}
          </div>
          <div style="flex: 1; display:flex; flex-wrap:wrap; gap:5px;">${topReqs}</div>
          <div style="flex: 0 0 150px; display: flex; gap:8px; justify-content: flex-end;">
            <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">[ OPERATIVO ]</button>
            <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:var(--danger); opacity:0.6;">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
    document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); runMatchmaking(allTenders.find(x => x.id === btn.dataset.id)); });
    document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteTender(btn.dataset.id); });
  }

  if (searchInput) searchInput.oninput = renderTenders;

  window.editTenderById = (id, startTab = 'edit') => {
    const t = allTenders.find(x => x.id === id);
    if (!t) return;
    $('#tenderId').value = t.id;
    $('#tenderName').value = t.name;
    $('#tenderDesc').value = t.description || '';
    reqContainer.innerHTML = '';
    (t.requirements || []).forEach(r => addReqInput(r));
    window.supabase.from('vacancies').select('*').eq('tender_id', id).then(({data}) => {
        detectedVacancies = data || [];
        renderDetectedVacancies();
        if (startTab === 'intel') updateIntelTab(id);
    });
    switchToTenderTab(startTab);
    openModal(tenderModal);
  };

  async function updateIntelTab(id) {
    const infoDiv = $('#intelTenderInfo');
    const intelList = $('#intelVacancyList');
    const totalScoreText = $('#intelTotalScore');
    const totalProgressCircle = $('#intelTotalProgress');
    const tender = allTenders.find(x => x.id === id);

    if (infoDiv) infoDiv.textContent = tender?.description || "Sin descripción.";

    try {
      const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
      const { data: ws } = await window.supabase.from('workers').select('*, worker_credentials(*)');
      const { data: cs } = await window.supabase.from('candidates').select('*');

      if (!vacs || vacs.length === 0) {
          intelList.innerHTML = '<p style="text-align:center; padding:20px;">Sin vacantes.</p>';
          return;
      }

      let filled = 0, totalP = 0;
      const normalize = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const html = vacs.map(v => {
          const rs = v.requirements || [];
          const pos = v.total_positions || 1;
          totalP += pos;

          let sl = [];
          try { sl = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates) : (v.shortlisted_candidates || []); } catch(e) {}
          filled += Math.min(pos, sl.length);

          const pct = Math.round((sl.length / pos) * 100);

          return `
            <div class="stark-card" style="padding:15px; margin-bottom:10px; border-left: 3px solid ${pct >= 100 ? 'var(--ok)' : 'var(--accent)'};">
               <div style="display:flex; justify-content:space-between; align-items:start;">
                  <div style="flex:1;">
                    <div style="font-size:10px; color:var(--accent); font-weight:900;">[ ${v.title.toUpperCase()} ]</div>
                    <div style="font-size:13px; font-weight:700; margin:5px 0;">${sl.length} / ${pos} PUESTOS</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:18px; font-weight:900; color:var(--accent)">${pct}%</div>
                    <div style="font-size:9px; color:var(--muted);">LLENADO</div>
                  </div>
               </div>
               <div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>
            </div>
          `;
      }).join('');

      const globalPct = totalP > 0 ? Math.round((filled / totalP) * 100) : 0;
      totalScoreText.textContent = `${globalPct}%`;
      totalProgressCircle.setAttribute('stroke-dasharray', `${globalPct}, 100`);
      intelList.innerHTML = html;

    } catch (err) { console.error(err); }
  }

  // --- MATCHMAKING & COMPARATIVE ---
  async function runMatchmaking(tender) {
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    if (tabWorkers) tabWorkers.click();
    
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let activeVacs = vacs?.length ? vacs : [{ id: 'global', title: 'Operación Global', requirements: tender.requirements || [] }];
    
    vacancySelector.innerHTML = activeVacs.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
    vacancySelector.onchange = () => evaluate(tender, activeVacs[vacancySelector.value]);
    evaluate(tender, activeVacs[0]);
  }

  async function evaluate(tender, vacancy) {
    const rs = vacancy.requirements || [];
    let sl = [];
    try { sl = (typeof vacancy.shortlisted_candidates === 'string') ? JSON.parse(vacancy.shortlisted_candidates) : (vacancy.shortlisted_candidates || []); } catch(e) {}

    const { data: ws } = await window.supabase.from('workers').select('*');
    const { data: wCreds } = await window.supabase.from('worker_credentials').select('*');
    const { data: cs } = await window.supabase.from('candidates').select('*');

    const nw = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

    // 1. Scoring & Gaps: Internal Workers
    const scoredW = (ws || []).map(w => {
        const myCreds = (wCreds || []).filter(c => c.worker_id === w.id);
        const miss = rs.filter(r => !myCreds.some(c => nw(c.credential_name).includes(nw(r))));
        const score = rs.length ? Math.round(((rs.length - miss.length) / rs.length) * 100) : 0;
        return { w, score, miss, isS: sl.some(s => s.id === w.id) };
    }).sort((a,b) => b.score - a.score);

    matchBodyWorkers.innerHTML = renderMatchGrid(scoredW, vacancy.id, 'AFK');

    // 2. Scoring & Gaps: External Candidates
    const scoredC = (cs || []).map(c => {
        const text = nw((c.profesion || '') + ' ' + (c.evaluacion_general || '') + ' ' + (c.experiencia_general || ''));
        const miss = rs.filter(r => !text.includes(nw(r)));
        const score = rs.length ? Math.round(((rs.length - miss.length) / rs.length) * 100) : 0;
        return { w: { ...c, full_name: c.nombre_completo }, score, miss, isS: sl.some(s => s.id === c.id) };
    }).sort((a,b) => b.score - a.score);

    matchBodyCandidates.innerHTML = renderMatchGrid(scoredC, vacancy.id, 'IA EXTERNO');
  }

  function renderMatchGrid(list, vacId, type) {
    if (list.length === 0) return '<p style="padding:40px; text-align:center; color:var(--muted);">No se detectaron perfiles compatibles.</p>';
    
    return list.map(r => `
      <div class="stark-card" style="padding:15px; margin-bottom:10px; cursor:pointer; border: ${r.isS ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)'};" onclick="window.openPersonProfile('${r.w.id}', '${type}')">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
           <div>
              <strong style="color:var(--text); font-size:14px;">${r.w.full_name.toUpperCase()}</strong>
              <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">${r.w.cargo || r.w.profesion || 'Perfil Operativo'}</div>
           </div>
           <div style="text-align:right;">
              <span style="color:var(--accent); font-weight:900; font-size:16px;">${r.score}%</span>
              <div style="font-size:8px; color:var(--muted);">MATCH</div>
           </div>
        </div>
        <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
        
        ${r.miss.length ? `<div style="font-size:9px; color:#ff3264; margin-top:10px; background:rgba(255,50,100,0.05); padding:5px 8px; border-radius:4px;">GAPS DETECTADOS: ${r.miss.join(' • ')}</div>` : '<div style="font-size:9px; color:var(--ok); margin-top:10px;">[ COMPATIBILIDAD TOTAL ]</div>'}
        
        <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end;">
           ${!r.isS && vacId !== 'global' ? `<button onclick="event.stopPropagation(); window.starkShortlist('${vacId}','${r.w.id}','${escapeHtml(r.w.full_name)}','${type}',${r.score})" class="btn btn--mini primary">+ PRESELECCIONAR</button>` : `<span style="font-size:10px; font-weight:900; color:var(--accent);">[ SELECCIONADO ]</span>`}
        </div>
      </div>
    `).join('');
  }

  // --- PERSISTENCE ---
  window.starkShortlist = async function(vacId, pId, name, type, score) {
    try {
        const { data: v } = await window.supabase.from('vacancies').select('shortlisted_candidates').eq('id', vacId).single();
        let list = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates) : (v.shortlisted_candidates || []);
        if (!list.some(x => x.id === pId)) {
            list.push({ id: pId, name, type, score, added_at: new Date().toISOString() });
            await window.supabase.from('vacancies').update({ shortlisted_candidates: list }).eq('id', vacId);
            window.notificar?.(`[ ${name.toUpperCase()} ] INTEGRADO AL PROCESO`);
            loadTenders();
            const tid = $('#tenderId').value;
            if (tid) {
                const t = allTenders.find(x => x.id === tid);
                runMatchmaking(t);
            }
        }
    } catch(err) { console.error(err); }
  };

  async function renderDetectedVacancies() {
    if (!vacanciesList) return;
    vacanciesWrapper.style.display = detectedVacancies.length ? 'block' : 'none';
    vacanciesList.innerHTML = detectedVacancies.map((v, i) => `
      <div class="stark-card" style="padding:15px; margin-bottom:8px; border-left: 2px solid var(--accent); position:relative; display:flex; justify-content:space-between;">
        <div style="flex:1;">
           <input class="input" value="${v.title}" style="background:transparent; border:none; font-weight:900; color:var(--accent); padding:0; width:100%; border-bottom: 1px solid rgba(34,211,238,0.1); margin-bottom:5px;" onchange="detectedVacancies[${i}].title=this.value">
           <div style="font-size:9px; color:var(--muted);">${(v.requirements || []).join(' • ')}</div>
        </div>
        <div style="width:70px; text-align:right;">
           <div style="font-size:8px; color:var(--muted); margin-bottom:4px;">PUESTOS</div>
           <input type="number" class="input" value="${v.total_positions || 1}" min="1" style="height:25px; text-align:center; font-family:monospace; background:rgba(255,255,255,0.05);" onchange="detectedVacancies[${i}].total_positions=parseInt(this.value)">
           <button type="button" class="btn btn--mini" style="color:var(--danger); margin-top:5px;" onclick="window.remV(${i})">BORRAR</button>
        </div>
      </div>`).join('');
  }
  window.remV = async (i) => { detectedVacancies.splice(i, 1); await renderDetectedVacancies(); };

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = $('#tenderId').value;
    const name = $('#tenderName').value;
    const desc = $('#tenderDesc').value;
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

    const { data: tRes, error: tErr } = id ? 
        await window.supabase.from('tenders').update({ name, description: desc, requirements: reqs }).eq('id', id).select() :
        await window.supabase.from('tenders').insert({ name, description: desc, requirements: reqs }).select();

    if (tErr) return alert(tErr.message);
    const tId = id || tRes[0]?.id;
    if (detectedVacancies.length > 0) {
        if (id) await window.supabase.from('vacancies').delete().eq('tender_id', id);
        await window.supabase.from('vacancies').insert(detectedVacancies.map(v => ({ tender_id: tId, title: v.title, requirements: v.requirements, total_positions: v.total_positions || 1 })));
    }
    window.notificar?.("INTEGRIDAD DE DATOS SINCRONIZADA.");
    closeModal(tenderModal); loadTenders();
  };

  async function deleteTender(id) {
    if (!confirm('¿DESACTIVAR PROYECTO?')) return;
    await window.supabase.from('vacancies').delete().eq('tender_id', id);
    await window.supabase.from('tenders').delete().eq('id', id);
    loadTenders();
  }

  window.openPersonProfile = async function(id, type) {
    if ($('#scannerOverlay')) $('#scannerOverlay').style.display = 'flex';
    openModal(personProfileModal);
    try {
        const table = (type === 'AFK') ? 'workers' : 'candidates';
        const { data: p } = await window.supabase.from(table).select('*').eq('id', id).single();
        if (p) {
            $('#profileName').textContent = (p.full_name || p.nombre_completo || 'S / I').toUpperCase();
            $('#profileProfession').textContent = p.cargo || p.profesion || 'Perfil Operativo';
            $('#profileRut').textContent = p.rut || '-';
            $('#profileEmail').textContent = p.email || p.correo || '-';
            $('#profilePhone').textContent = p.phone || p.telefono || '-';
            $('#profileCvSummary').innerHTML = p.evaluacion_general || p.perfil_profesional || 'Análisis de inteligencia JARVIS completado.';
            $('#profileStatus').textContent = p.status || `NOTA: ${p.nota || 'S/N'}`;
            $('#profileEditBtn').onclick = () => window.location.href = (type === 'AFK') ? `worker.html?id=${id}` : `candidate.html?id=${id}`;
        }
    } catch(err) {} 
    setTimeout(() => { if($('#scannerOverlay')) $('#scannerOverlay').style.display = 'none'; }, 800);
  };

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.gap = '8px'; div.style.marginBottom = '5px';
    div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="this.parentElement.remove()">×</button>`;
    reqContainer.appendChild(div);
  }
  window.addReqInput = addReqInput;

  function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
})();
