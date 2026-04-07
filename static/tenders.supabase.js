// tenders.supabase.js - Lógica Stark Intelligence V14: RESUMEN EJECUTIVO & LLENADO
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

  // UI - Scanner V3 (Radar)
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

  // UI - Matchmaking HUD
  const tabWorkers = $('#tabWorkers');
  const tabCandidates = $('#tabCandidates');
  const matchBodyWorkers = $('#matchBodyWorkers');
  const matchBodyCandidates = $('#matchBodyCandidates');
  const vacancySelector = $('#vacancySelector');

  // State
  let allTenders = [];
  let detectedVacancies = [];
  let currentScanVacancies = [];

  const openModal = (m) => m?.classList.add('is-open');
  const closeModal = (m) => m?.classList.remove('is-open');

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { closeModal(tenderModal); closeModal(matchModal); closeModal(personProfileModal); };
  });

  // Tab Switch HUD
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

  // --- DASHBOARD TACTICAL VIEW ---

  async function loadTenders() {
    try {
      if (!window.supabase) return setTimeout(loadTenders, 500);
      if (tendersBody) tendersBody.innerHTML = '<div style="padding:40px; text-align:center; color:var(--accent);">SINCRONIZANDO NÚCLEO STARK...</div>';
      
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allTenders = data || [];
      renderTenders();
    } catch (err) { console.error('[Stark] Error loadTenders:', err); }
  }
  loadTenders();

  function renderTenders() {
    if (!tendersBody) return;
    const term = (searchInput?.value || "").toLowerCase();
    const filtered = allTenders.filter(t => (t.name||"").toLowerCase().includes(term) || (t.description||"").toLowerCase().includes(term));

    tendersBody.innerHTML = filtered.map(t => {
      const topReqs = (t.requirements || []).slice(0, 3).map(r => `<span class="badge" style="font-size:10px; border-color:rgba(34,211,238,0.2)">${r}</span>`).join('');
      return `
        <div class="t-row stark-card" style="margin-bottom:10px; padding: 18px 20px; display:flex; align-items: center; border: 1px solid rgba(255,255,255,0.05); transition:all 0.4s;">
          <div style="flex: 0 0 25%;">
            <div style="font-weight: 800; color:var(--text); font-size:15px; letter-spacing:0.5px; cursor:pointer;" onclick="window.editTenderById('${t.id}', 'intel')">
               <span style="color:var(--accent)">[</span> ${escapeHtml(t.name)} <span style="color:var(--accent)">]</span>
            </div>
          </div>
          <div style="flex: 0 0 35%; padding-right:15px;">
            <div style="color: var(--muted); font-size: 11px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height:1.4;">
              ${escapeHtml(t.description || 'Sin descripción estratégica')}
            </div>
          </div>
          <div style="flex: 1; display:flex; flex-wrap:wrap; gap:5px;">
            ${topReqs || '<span style="color:rgba(255,255,255,0.1); font-size:10px;">SIN REQUISITOS CAPTURADOS</span>'}
          </div>
          <div style="flex: 0 0 150px; display: flex; gap:8px; justify-content: flex-end;">
            <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">[ OPERATIVO ]</button>
            <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:var(--danger); opacity:0.6;">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); runMatchmaking(filtered.find(x => x.id === btn.dataset.id)); });
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
    if (!t.requirements?.length) addReqInput();
    
    window.supabase.from('vacancies').select('*').eq('tender_id', t.id).then(async ({data}) => {
        detectedVacancies = data || [];
        await renderDetectedVacancies();
        if (startTab === 'intel') updateIntelTab(t.id);
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

    if (infoDiv) infoDiv.textContent = tender?.description || "Sin descripción estratégica capturada.";

    try {
      const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
      const { data: candidates } = await window.supabase.from('candidates').select('*');
      const { data: workers } = await window.supabase.from('workers').select('*, worker_credentials(*)');

      if (!vacs || vacs.length === 0) {
          intelList.innerHTML = '<p style="text-align:center; padding:20px;">Sin vacantes detectadas para analizar.</p>';
          return;
      }

      let totalGlobalFulfillment = 0;
      let totalGlobalPositions = 0;
      let filledPositions = 0;

      const normalize = (t) => (t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const results = vacs.map(v => {
          const rs = v.requirements || [];
          const pos = v.total_positions || 1;
          totalGlobalPositions += pos;

          // Shortlist logic (Fulfillment/Llenado)
          let sl = [];
          try { sl = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates) : (v.shortlisted_candidates || []); } catch(e) {}
          const currentFilled = sl.length;
          filledPositions += Math.min(pos, currentFilled);
          const fillPct = Math.round((currentFilled / pos) * 100);

          // Top Match logic (Aptitud)
          const allPeople = [
              ...(candidates || []).map(c => ({ name: c.nombre_completo, txt: `${c.profesion} ${c.evaluacion_general}`, type: 'CANDIDATO' })),
              ...(workers || []).map(w => ({ name: w.nombre_completo, txt: `${w.cargo} ${w.perfil_profesional} ${w.worker_credentials.map(cr => cr.credential_name).join(' ')}`, type: 'OPERATIVO' }))
          ];

          let bestScore = 0;
          allPeople.forEach(p => {
              const pTxt = normalize(p.txt);
              const matches = rs.filter(r => pTxt.includes(normalize(r))).length;
              const score = rs.length ? Math.round((matches / rs.length) * 100) : 0;
              if (score > bestScore) bestScore = score;
          });

          totalGlobalFulfillment += bestScore;

          return `
            <div class="stark-card" style="padding:15px; border-left: 3px solid ${fillPct >= 100 ? 'var(--ok)' : 'var(--accent)'};">
               <div style="display:flex; justify-content:space-between; align-items:start;">
                  <div style="flex:1;">
                    <div style="font-size:10px; color:var(--accent); font-weight:900;">[ ${v.title.toUpperCase()} ]</div>
                    <div style="font-size:13px; font-weight:700; margin:5px 0;">${currentFilled} / ${pos} PUESTOS CUBIERTOS</div>
                    <div style="font-size:10px; color:var(--muted); text-transform:uppercase;">Aptitud del Mercado: ${bestScore}%</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:18px; font-weight:900; color:${fillPct >= 100 ? 'var(--ok)' : 'var(--accent)'}">${fillPct}%</div>
                    <div style="font-size:9px; color:var(--muted);">LLENADO</div>
                  </div>
               </div>
               <div class="affinity-bar" style="height:3px; margin-top:10px;"><div class="affinity-fill" style="width:${fillPct}%"></div></div>
            </div>
          `;
      });

      const avgFulfillment = Math.round((filledPositions / totalGlobalPositions) * 100);
      totalScoreText.textContent = `${avgFulfillment}%`;
      totalProgressCircle.setAttribute('stroke-dasharray', `${avgFulfillment}, 100`);
      intelList.innerHTML = results.join('');

    } catch (err) {
      console.error("[Stark Intel Failure]", err);
      intelList.innerHTML = '<p style="color:var(--danger);">Error al procesar cumplimiento.</p>';
    }
  }

  async function renderDetectedVacancies() {
    if (!vacanciesList) return;
    vacanciesWrapper.style.display = detectedVacancies.length ? 'block' : 'none';
    
    vacanciesList.innerHTML = detectedVacancies.map((v, i) => {
      const rs = v.requirements || [];
      return `
      <div class="stark-card" style="padding:15px; margin-bottom:8px; border-left: 2px solid var(--accent); position:relative;">
        <button type="button" class="btn btn--mini" style="position:absolute; top:2px; right:2px; color:var(--danger); background:none; border:none;" onclick="window.remV(${i})">×</button>
        <div style="display:flex; justify-content:space-between; gap:20px;">
           <div style="flex:1;">
              <input class="input v-title-input" value="${v.title}" placeholder="Título de Vacante" style="font-weight:900; color:var(--accent); background:transparent; border:none; padding:0; font-size:12px; width:100%;" onchange="detectedVacancies[${i}].title=this.value">
              <div style="font-size:9px; color:var(--muted); margin-top:8px;">${rs.join(' • ')}</div>
           </div>
           <div style="width:100px;">
              <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Puestos</div>
              <input type="number" class="input v-pos-input" value="${v.total_positions || 1}" min="1" style="height:30px; font-family:monospace; font-weight:900; background:rgba(255,255,255,0.05);" onchange="detectedVacancies[${i}].total_positions=parseInt(this.value)">
           </div>
        </div>
      </div>
      `;
    }).join('');
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

    if (tErr) return alert("Error al guardar: " + tErr.message);
    
    let tId = id || tRes[0]?.id;
    if (detectedVacancies.length > 0) {
        if (id) await window.supabase.from('vacancies').delete().eq('tender_id', id);
        const vacData = detectedVacancies.map(v => ({ 
            tender_id: tId, 
            title: v.title, 
            requirements: v.requirements,
            total_positions: v.total_positions || 1
        }));
        await window.supabase.from('vacancies').insert(vacData);
    }
    
    window.notificar?.("MISIÓN CUMPLIDA: SISTEMA SINCRONIZADO");
    closeModal(tenderModal);
    loadTenders();
  };

  // --- MATCHMAKING HUD V3 ---
  async function runMatchmaking(tender) {
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let active = vacs?.length ? vacs : [{ id: 'global', title: 'OPERACIÓN GLOBAL', requirements: tender.requirements || [] }];
    vacancySelector.innerHTML = active.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
    vacancySelector.onchange = () => evaluate(tender, active[vacancySelector.value]);
    evaluate(tender, active[0]);
  }

  async function evaluate(tender, vacancy) {
    if ($('#tabWorkers')) $('#tabWorkers').click();
    const rs = vacancy.requirements || [];
    let shortlist = [];
    try { shortlist = (typeof vacancy.shortlisted_candidates === 'string') ? JSON.parse(vacancy.shortlisted_candidates) : (vacancy.shortlisted_candidates || []); } catch(e) {}

    const { data: ws } = await window.supabase.from('workers').select('*');
    const { data: cs } = await window.supabase.from('worker_credentials').select('*');
    const { data: candidates } = await window.supabase.from('candidates').select('*');

    const nw = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

    const scoredW = (ws || []).map(w => {
        const wCs = (cs || []).filter(c => c.worker_id === w.id);
        const miss = rs.filter(r => !wCs.some(c => nw(c.credential_name).includes(nw(r))));
        const score = rs.length ? Math.round(((rs.length - miss.length) / rs.length) * 100) : 0;
        return { w, score, miss };
    }).sort((a,b) => b.score - a.score);

    matchBodyWorkers.innerHTML = scoredW.map(r => `
        <div class="stark-card" style="padding:15px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${r.w.full_name}</strong>
            <span style="color:var(--accent); font-weight:900;">${r.score}%</span>
          </div>
          <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
        </div>`).join('');

    matchBodyCandidates.innerHTML = (candidates || []).map(c => `
        <div class="stark-card" style="padding:15px; margin-bottom:8px;">
          <strong style="color:var(--accent)">${c.nombre_completo}</strong>
          <p style="font-size:10px; color:var(--muted); margin-top:5px;">${c.evaluacion_general?.substring(0,100)}...</p>
        </div>`).join('');
  }

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.gap = '8px'; div.style.marginBottom = '5px';
    div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini btn-del-req" style="color:var(--danger)">×</button>`;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    reqContainer.appendChild(div);
  }
  window.addReqInput = addReqInput;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
