// tenders.supabase.js - Lógica Stark Intelligence V8: RECONSTRUCCIÓN FINAL ESTABLE
(function () {
  const $ = (s) => document.querySelector(s);
  
  // Stark Utility: Robust Text Normalization
  const normalizeText = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g, " ").trim();

  // UI - Dash & Modals
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const personProfileModal = $('#personProfileModal');
  const viewTenderModal = $('#viewTenderModal');
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
    b.onclick = () => { 
      closeModal(tenderModal); 
      closeModal(matchModal); 
      closeModal(personProfileModal); 
      closeModal(viewTenderModal);
    };
  });

  // Tab Switch HUD
  if (tabWorkers && tabCandidates) {
    const sw = () => {
        matchBodyWorkers.style.display = 'block';
        matchBodyCandidates.style.display = 'none';
        tabWorkers.style.color = 'var(--accent)';
        tabWorkers.style.borderBottom = '2px solid var(--accent)';
        tabCandidates.style.color = 'var(--muted)';
        tabCandidates.style.borderBottom = '2px solid transparent';
    };
    const sc = () => {
        matchBodyWorkers.style.display = 'none';
        matchBodyCandidates.style.display = 'block';
        tabCandidates.style.color = 'var(--accent)';
        tabCandidates.style.borderBottom = '2px solid var(--accent)';
        tabWorkers.style.color = 'var(--muted)';
        tabWorkers.style.borderBottom = '2px solid transparent';
    };
    tabWorkers.onclick = sw;
    tabCandidates.onclick = sc;
  }

  // --- DASHBOARD TACTICAL VIEW ---

  async function loadTenders() {
    try {
      if (!window.supabase || typeof window.supabase.from !== 'function') {
        return setTimeout(loadTenders, 500);
      }
      if (tendersBody) tendersBody.innerHTML = '<div style="padding:40px; text-align:center;">SINCRONIZANDO NÚCLEO...</div>';
      
      const { data: tenders } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      const { data: allVacs } = await window.supabase.from('vacancies').select('*');

      allTenders = (tenders || []).map(t => {
          const tVacs = (allVacs || []).filter(v => v.tender_id === t.id);
          const totalRequested = tVacs.reduce((acc, v) => acc + (v.quantity || 1), 0);
          let totalAssigned = 0;
          tVacs.forEach(v => {
              try {
                  const sl = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates||'[]') : (v.shortlisted_candidates || []);
                  totalAssigned += sl.length;
              } catch(e) {}
          });

          const coverage = totalRequested ? Math.round((totalAssigned / totalRequested) * 100) : 0;
          let risk = coverage < 50 ? 'ALTO' : (coverage < 90 ? 'MEDIO' : 'BAJO');
          return { ...t, vacancies: tVacs, coverage, risk };
      });
      renderTenders();
    } catch (err) { console.error(err); }
  }

  function renderTenders() {
    if (!tendersBody) return;
    const term = (searchInput?.value || "").toLowerCase();
    const filtered = allTenders.filter(t => (t.name||"").toLowerCase().includes(term));

    tendersBody.innerHTML = filtered.map(t => {
      const riskColor = t.risk === "ALTO" ? "#f43f5e" : (t.risk === "MEDIO" ? "#f59e0b" : "#10b981");
      const coverageColor = t.coverage === 100 ? "#10b981" : "var(--accent)";

      return `
        <div class="t-row stark-card" style="margin-bottom:10px; padding: 18px 20px; display:flex; align-items: center; border: 1px solid rgba(255,255,255,0.05); border-left: 3px solid ${coverageColor}; cursor:pointer;" onclick="window.editTenderById('${t.id}')">
          <div style="flex: 0 0 25%;">
            <div style="font-weight: 800; color:var(--accent); font-size:15px; text-decoration:underline;" onclick="event.stopPropagation(); window.starkViewTender('${t.id}')">
                ${escapeHtml(t.name)}
            </div>
            <div style="margin-top:5px; font-size:9px; color:${riskColor}; font-weight:900;">RIESGO_${t.risk}</div>
          </div>
          <div style="flex: 1; padding-right:15px; font-size:11px; opacity:0.7;">${escapeHtml(t.description || '')}</div>
          <div style="flex: 0 0 15%; text-align:center;">
             <div style="font-size:14px; font-weight:900; color:${coverageColor}">${t.coverage}%</div>
             <div style="height:3px; background:rgba(255,255,255,0.1); border-radius:3px; width:60px; margin:4px auto;"><div style="width:${t.coverage}%; background:${coverageColor}; height:100%;"></div></div>
          </div>
          <div style="flex: 0 0 160px; display: flex; gap:8px; justify-content: flex-end;">
            <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">[ OPERATIVO ]</button>
            <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:var(--danger)">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); runMatchmaking(filtered.find(x => x.id === btn.dataset.id)); });
    document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteTender(btn.dataset.id); });
  }

  if (searchInput) searchInput.oninput = renderTenders;

  window.editTenderById = (id) => {
    const t = allTenders.find(x => x.id === id);
    if (!t) return;
    $('#tenderId').value = t.id;
    $('#tenderName').value = t.name;
    $('#tenderDesc').value = t.description || '';
    reqContainer.innerHTML = '';
    (t.requirements || []).forEach(r => addReqInput(r));
    if (!t.requirements?.length) addReqInput();
    window.supabase.from('vacancies').select('*').eq('tender_id', t.id).then(({data}) => {
        detectedVacancies = data || [];
        renderDetectedVacancies();
    });
    if (uploadZone) uploadZone.style.display = 'block';
    if (intelPreview) intelPreview.style.display = 'none';
    openModal(tenderModal);
  };

  window.starkViewTender = async (id) => {
    const t = allTenders.find(x => x.id === id);
    if (!t) return;
    $('#viewTenderTitle').innerText = t.name;
    $('#viewTenderSummary').innerText = t.description || 'Sin resumen estratégico.';
    $('#viewTenderCoverage').innerText = `${t.coverage || 0}%`;
    $('#viewTenderDate').innerText = `Sincronizado: ${new Date(t.created_at).toLocaleDateString()}`;
    $('#viewTenderReqs').innerHTML = (t.requirements || []).map(r => `<span class="badge">${r}</span>`).join('') || '-';
    
    const teamDiv = $('#viewTenderTeam');
    teamDiv.innerHTML = '<div style="padding:20px; text-align:center;">Cargando...</div>';
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', t.id);
    if (!vacs || vacs.length === 0) teamDiv.innerHTML = '<p>No vacancies.</p>';
    else {
        teamDiv.innerHTML = vacs.map(v => {
            const sl = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates) : (v.shortlisted_candidates || []);
            const names = sl.map(c => `
                <div style="cursor:pointer; margin-bottom:4px; font-size:11px;" onclick="window.openPersonProfile('${c.id}', '${(c.type||'').includes('IA')?'IA':'AFK'}', ${c.score}, '${v.title}')">
                   ✓ <span style="text-decoration:underline;">${c.name}</span> (${c.score}%)
                </div>`).join('') || '<span style="color:var(--danger)">FALTA_PERSONAL</span>';
            return `<div style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="font-weight:900; font-size:12px; color:var(--accent);">${v.title.toUpperCase()} [${sl.length}/${v.quantity||1}]</div>
                <div style="margin-top:5px; padding-left:10px;">${names}</div>
            </div>`;
        }).join('');
    }
    openModal($('#viewTenderModal'));
  };

  async function deleteTender(id) {
    if (!confirm('¿DESACTIVAR?')) return;
    await window.supabase.from('vacancies').delete().eq('tender_id', id);
    await window.supabase.from('tenders').delete().eq('id', id);
    loadTenders();
  }

  const btnNewTender = $('#btnNewTender');
  if (btnNewTender) btnNewTender.onclick = () => {
    $('#tenderId').value = '';
    tenderForm.reset();
    reqContainer.innerHTML = '';
    detectedVacancies = [];
    renderDetectedVacancies();
    addReqInput();
    if (uploadZone) uploadZone.style.display = 'block';
    if (intelPreview) intelPreview.style.display = 'none';
    openModal(tenderModal);
  };

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = $('#tenderId').value;
    const name = $('#tenderName').value;
    const desc = $('#tenderDesc').value;
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

    const { data: tRes, error: tErr } = id ? 
        await window.supabase.from('tenders').update({ name, description: desc, requirements: reqs }).eq('id', id).select() :
        await window.supabase.from('tenders').insert({ name, description: desc, requirements: reqs }).select();

    if (tErr) return console.error(tErr);
    
    let tId = id || (Array.isArray(tRes) ? tRes[0].id : tRes.id);
    
    if (detectedVacancies.length > 0) {
        if (id) await window.supabase.from('vacancies').delete().eq('tender_id', tId);
        const vacData = detectedVacancies.map(v => ({ 
            tender_id: tId, 
            title: v.title, 
            quantity: parseInt(v.quantity || 1) || 1,
            requirements: v.requirements || [] 
        }));
        await window.supabase.from('vacancies').insert(vacData);
    }
    
    window.notificar?.("MISIÓN SINCRONIZADA", "success");
    closeModal(tenderModal);
    loadTenders();
  };

  async function updateTeamStats(vacancies) {
      const totalRequested = (vacancies||[]).reduce((acc, v) => acc + (v.quantity || 1), 0);
      let totalAssigned = 0;
      const missing = [];
      (vacancies||[]).forEach(v => {
          let sl = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates||'[]') : (v.shortlisted_candidates || []);
          totalAssigned += sl.length;
          const left = (v.quantity || 1) - sl.length;
          if (left > 0) missing.push(`${left} ${v.title}`);
      });
      const coverage = totalRequested ? Math.round((totalAssigned / totalRequested) * 100) : 0;
      if ($('#coveragePct')) $('#coveragePct').textContent = `${coverage}%`;
      if ($('#coverageFill')) $('#coverageFill').style.width = `${coverage}%`;
      if ($('#teamStatusText')) $('#teamStatusText').textContent = coverage === 100 ? "DESPLIEGE_LISTO" : "ESTADO_DE_VACANTE";
      if ($('#missingRolesTags')) $('#missingRolesTags').innerHTML = missing.map(m => `<span class="badge" style="background:#f43f5e; border:none;">FALTA: ${m.toUpperCase()}</span>`).join('');
      if ($('#tenderRiskBadge')) {
          const risk = coverage < 50 ? 'ALTO' : (coverage < 90 ? 'MEDIO' : 'BAJO');
          $('#tenderRiskBadge').textContent = `RIESGO: ${risk}`;
          $('#tenderRiskBadge').style.borderColor = coverage < 50 ? '#f43f5e' : '#10b981';
          $('#tenderRiskBadge').style.color = coverage < 50 ? '#f43f5e' : '#10b981';
      }
  }

  async function starkAutoAllocateTeam(tender, vacancies) {
      window.notificar?.("INICIANDO PROTOCOLO DE ASIGNACIÓN ÚNICA...", "info");
      const { data: allCandidates } = await window.supabase.from('candidates').select('*');
      const { data: allWorkers } = await window.supabase.from('workers').select('*').eq('status', 'Habilitado');
      let globallyAssignedIds = new Set();
      
      const { data: tenderVacs } = await window.supabase.from('vacancies').select('shortlisted_candidates').eq('tender_id', tender.id);
      tenderVacs?.forEach(tv => {
          try {
              let sl = (typeof tv.shortlisted_candidates === 'string') ? JSON.parse(tv.shortlisted_candidates||'[]') : (tv.shortlisted_candidates || []);
              sl.forEach(c => globallyAssignedIds.add(c.id));
          } catch(e) {}
      });

      for (const v of (vacancies || [])) {
          if (v.id === 'global') continue;
          let shortlist = [];
          try { shortlist = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates||'[]') : (v.shortlisted_candidates || []); } catch(e) {}
          let needed = (v.quantity || 1) - shortlist.length;
          if (needed <= 0) continue;

          const pool = [
              ...(allCandidates || []).map(c => ({ ...c, type: 'IA EXTERNO' })),
              ...(allWorkers || []).map(w => ({ ...w, id: w.id, nombre_completo: w.full_name, profesion: w.position, type: 'AFK' }))
          ].filter(p => !globallyAssignedIds.has(p.id));

          const scored = pool.map(c => {
              const normProf = normalizeText(c.profesion || "");
              const normTitle = normalizeText(v.title || "");
              const titleHit = normProf.includes(normTitle) || normTitle.includes(normProf);
              let score = titleHit ? 40 : 0;
              (v.requirements || []).forEach(req => {
                  const ev = normalizeText(c.evaluacion_general || "") + " " + normalizeText(c.experiencia_general || "");
                  if (ev.includes(normalizeText(req))) score += 15;
              });
              return { ...c, score: Math.min(100, score) };
          }).filter(c => c.score > 0).sort((a,b) => b.score - a.score);

          const toAdd = scored.slice(0, needed);
          if (toAdd.length > 0) {
              toAdd.forEach(c => {
                  shortlist.push({ id: c.id, name: c.nombre_completo, type: c.type, score: c.score, added_at: new Date().toISOString() });
                  globallyAssignedIds.add(c.id);
              });
              await window.supabase.from('vacancies').update({ shortlisted_candidates: shortlist }).eq('id', v.id);
          }
      }
      loadTenders(); closeModal(matchModal); 
      window.notificar?.("EQUIPO ASIGNADO SIN DUPLICADOS.", "success");
  }

  async function evaluate(tender, vacancy) {
    const rs = vacancy.requirements || [];
    let shortlist = [];
    try {
        if (typeof vacancy.shortlisted_candidates === 'string') shortlist = JSON.parse(vacancy.shortlisted_candidates||'[]');
        else shortlist = vacancy.shortlisted_candidates || [];
    } catch(e) {}

    const shortlistHTML = shortlist.length > 0 ? `
      <div class="stark-card" style="margin-bottom: 20px; padding: 15px; border: 1px solid var(--accent); background: rgba(34,211,238,0.05);">
        <div style="color:var(--accent); font-weight:800; font-size:12px; margin-bottom:10px;">⚡ EN SELECCIÓN (${shortlist.length})</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${shortlist.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:4px; border-left:2px solid var(--accent);">
               <div style="cursor:pointer;" onclick="window.openPersonProfile('${c.id}', '${c.type}')">
                 <strong style="font-size:12px;">${c.name.toUpperCase()}</strong>
                 <span style="font-size:10px; color:var(--muted); margin-left:8px;">[${c.score}%]</span>
               </div>
               <button onclick="window.starkRemoveShortlist('${vacancy.id}', '${c.id}')" class="btn btn--mini" style="color:var(--danger)">X</button>
            </div>
          `).join('')}
        </div>
      </div>` : '';

    try {
      const { data: ws } = await window.supabase.from('workers').select('*');
      const { data: cs } = await window.supabase.from('worker_credentials').select('*');
      const scored = (ws || []).map(w => {
         const wCs = (cs || []).filter(c => c.worker_id === w.id);
         const matched = rs.filter(r => wCs.some(c => normalizeText(c.credential_name).includes(normalizeText(r))));
         const score = rs.length ? Math.round((matched.length / rs.length) * 100) : 0;
         return { w, score, matched };
      }).sort((a,b) => b.score - a.score);

      matchBodyWorkers.innerHTML = shortlistHTML + (scored.length ? scored.map(r => {
        const isPreselected = shortlist.some(s => s.id === r.w.id);
        return `<div class="t-row stark-card" style="padding:15px; margin-bottom:10px; border: ${isPreselected ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div onclick="window.openPersonProfile('${r.w.id}', 'AFK')">
               <strong style="color:var(--text); font-size:14px;">${r.w.full_name.toUpperCase()}</strong>
               <div style="font-size:10px; color:var(--accent);">${r.score}% MATCH</div>
            </div>
            ${!isPreselected && vacancy.id !== 'global' ? `<button onclick="window.starkShortlist('${vacancy.id}','${r.w.id}','${escapeHtml(r.w.full_name)}','AFK',${r.score})" class="btn btn--mini btn--primary">+ ASIGNAR</button>` : ''}
          </div>
        </div>`;
      }).join('') : '<p>No data.</p>');

      const { data: candidates } = await window.supabase.from('candidates').select('*');
      const m = (candidates || []).map(c => {
         const p = normalizeText(c.profesion || "");
         const t = normalizeText(vacancy.title || "");
         const titleHit = p.includes(t) || t.includes(p);
         let score = titleHit ? 40 : 0;
         (vacancy.requirements || []).forEach(req => {
            if (normalizeText(c.evaluacion_general || "").includes(normalizeText(req))) score += 10;
         });
         return { ...c, ai_match_score: Math.min(100, score) };
      }).sort((a,b) => b.ai_match_score - a.ai_match_score).filter(c => c.ai_match_score > 0);

      matchBodyCandidates.innerHTML = shortlistHTML + (m.length ? m.map(c => {
        const isPre = shortlist.some(s => s.id === c.id);
        return `<div class="t-row stark-card" style="padding:15px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <div onclick="window.openPersonProfile('${c.id}', 'IA EXTERNO')">
                <strong style="font-size:14px;">${c.nombre_completo.toUpperCase()}</strong>
                <div style="font-size:10px; color:var(--accent);">${Math.round(c.ai_match_score)}% AI_MATCH</div>
             </div>
             ${!isPre && vacancy.id !== 'global' ? `<button onclick="window.starkShortlist('${vacancy.id}','${c.id}','${escapeHtml(c.nombre_completo)}','IA EXTERNO',${Math.round(c.ai_match_score)})" class="btn btn--mini btn--primary">+ IA_PICK</button>` : ''}
          </div>
        </div>`;
      }).join('') : '<p>No candidates.</p>');
    } catch(e) { console.error(e); }
  }

  window.starkShortlist = async function(vacId, personId, personName, type, score) {
      try {
          const { data: vCurrent } = await window.supabase.from('vacancies').select('shortlisted_candidates').eq('id', vacId).single();
          let currentList = (typeof vCurrent?.shortlisted_candidates === 'string') ? JSON.parse(vCurrent.shortlisted_candidates||'[]') : (vCurrent?.shortlisted_candidates || []);
          if(!currentList.some(c => c.id === personId)) {
              currentList.push({ id: personId, name: personName, type: type, score: score, added_at: new Date().toISOString() });
              await window.supabase.from('vacancies').update({ shortlisted_candidates: currentList }).eq('id', vacId);
              window.notificar?.(`[ ${personName.toUpperCase()} ] ASIGNADO`);
          }
          loadTenders(); closeModal(matchModal); 
      } catch(err) { console.error(err); }
  };

  window.starkRemoveShortlist = async function(vacId, personId) {
      try {
          const { data: vCurrent } = await window.supabase.from('vacancies').select('shortlisted_candidates').eq('id', vacId).single();
          let list = (typeof vCurrent?.shortlisted_candidates === 'string') ? JSON.parse(vCurrent.shortlisted_candidates||'[]') : (vCurrent?.shortlisted_candidates || []);
          list = list.filter(c => c.id !== personId);
          await window.supabase.from('vacancies').update({ shortlisted_candidates: list }).eq('id', vacId);
          window.notificar?.("REMOCIÓN COMPLETADA");
          loadTenders(); closeModal(matchModal);
      } catch(err) { console.error(err); }
  };

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.className = 'grid-2'; div.style.gap = '8px';
    div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required><button type="button" class="btn btn--mini btn-del-req" style="color:var(--danger)">×</button>`;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    reqContainer.appendChild(div);
  }

  function renderDetectedVacancies() {
    if (!vacanciesList) return;
    vacanciesWrapper.style.display = (detectedVacancies||[]).length ? 'block' : 'none';
    const list = detectedVacancies || [];
    vacanciesList.innerHTML = list.map((v, i) => `
      <div class="stark-card" style="padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:900; font-size:11px; color:var(--accent);">[ ${v.title.toUpperCase()} ]</div>
          <div style="font-size:9px; opacity:0.6;">DOTA: ${v.quantity || 1}</div>
        </div>
        <button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="window.remV(${i})">×</button>
      </div>`).join('');
  }
  window.remV = (i) => { detectedVacancies.splice(i, 1); renderDetectedVacancies(); };

  // --- STARK SCANNER V3 (RESTORED) ---
  if (uploadZone && pdfInput) {
    uploadZone.onclick = () => pdfInput.click();
    pdfInput.onchange = (e) => { if (e.target.files[0]) handleStarkScan(e.target.files[0]); };
    uploadZone.ondragover = (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent)'; };
    uploadZone.ondragleave = () => { uploadZone.style.borderColor = 'rgba(34,211,238,0.3)'; };
    uploadZone.ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleStarkScan(e.dataTransfer.files[0]); };
  }

  async function handleStarkScan(file) {
    if (scannerOverlay) scannerOverlay.style.display = 'flex';
    if (radarText) radarText.textContent = "DECODIFICANDO DOCUMENTO...";
    try {
      const text = await extractTextFromPDF(file);
      if (!text.trim()) throw new Error("ERROR: DOCUMENTO SIN CAPA DE TEXTO");

      if (radarText) radarText.textContent = "JARVIS ANALIZANDO REQUISITOS...";
      const aiData = await analyzeTenderStarkV3(text);
      currentScanVacancies = aiData.vacancies || [];
      
      if (intelDesc) intelDesc.value = aiData.description;
      renderScanPreview(currentScanVacancies);
      
      if (scannerOverlay) scannerOverlay.style.display = 'none';
      if (uploadZone) uploadZone.style.display = 'none';
      if (intelPreview) intelPreview.style.display = 'block';
    } catch (err) {
      console.error(err);
      window.notificar?.(err.message, "error");
      if (scannerOverlay) scannerOverlay.style.display = 'none';
    }
  }

  async function analyzeTenderStarkV3(text) {
     const res = await fetch('/api/analyze-tender', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ text })
     });
     const data = await res.json();
     if (!data.ok) throw new Error(data.detail || "Error en extracción");
     const analysis = data.analysis;
     const vacancies = (analysis.roles || []).map(r => ({
       title: r.nombre,
       quantity: r.cantidad || 1,
       requirements: [...(r.requisitos || []), ...(r.certificaciones || [])].filter(Boolean)
     }));
     return { description: analysis.tender_summary, vacancies: vacancies };
  }

  function renderScanPreview(vacs) {
    if (!intelReqs) return;
    intelReqs.innerHTML = vacs.map((v, i) => `
      <div class="stark-card" style="padding:10px; margin-bottom:10px; border:1px solid rgba(34,211,238,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent); font-size:12px;">${v.title.toUpperCase()}</strong>
          <input type="checkbox" checked class="scan-v-check" data-vidx="${i}">
        </div>
        <div style="font-size:10px; opacity:0.7;">${v.requirements.join(' • ')}</div>
      </div>
    `).join('');
  }

  if ($('#btnImportIntel')) {
    $('#btnImportIntel').onclick = () => {
      const selected = Array.from(document.querySelectorAll('.scan-v-check:checked')).map(c => currentScanVacancies[parseInt(c.dataset.vidx)]);
      detectedVacancies = [...detectedVacancies, ...selected];
      renderDetectedVacancies();
      if (intelDesc && $('#tenderDesc')) $('#tenderDesc').value = intelDesc.value;
      if (intelPreview) intelPreview.style.display = 'none';
      if (uploadZone) uploadZone.style.display = 'block';
      window.notificar?.("IMPORTACIÓN EXITOSA", "success");
    };
  }

  async function extractTextFromPDF(file) {
    const reader = new FileReader();
    const ab = await new Promise((resolve) => { reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(file); });
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: ab, disableWorker: true }).promise;
    let t = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
       const p = await pdf.getPage(i);
       const c = await p.getTextContent();
       t += c.items.map(item => item.str).join(" ") + "\n";
    }
    return t;
  }

  async function runMatchmaking(tender) {
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    if (tabWorkers) tabWorkers.click();
    matchBodyWorkers.innerHTML = '<div style="padding:40px; text-align:center;">SINTONIZANDO SEÑAL BIOMÉTRICA...</div>';
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let active = vacs?.length ? vacs : [{ id: 'global', title: 'OPERACIÓN GLOBAL', requirements: tender.requirements || [] }];
    const btnAuto = $('#btnStarkAutoFill');
    if (btnAuto) btnAuto.onclick = () => starkAutoAllocateTeam(tender, active);
    vacancySelector.innerHTML = active.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
    vacancySelector.onchange = () => evaluate(tender, active[vacancySelector.value]);
    updateTeamStats(active); evaluate(tender, active[0]);
  }

  window.openPersonProfile = async function(id, type, matchScore = null, matchRole = null) {
      openModal(personProfileModal);
      $('#profileScanner').style.display = 'flex';
      const existingMatch = $('#starkMatchReport'); if (existingMatch) existingMatch.remove();
      try {
          const table = type.includes('IA') ? 'candidates' : 'workers';
          const { data: person } = await window.supabase.from(table).select('*').eq('id', id).single();
          if (person) {
              $('#profileName').textContent = (person.full_name || person.nombre_completo || 'SIN NOMBRE').toUpperCase();
              $('#profileRut').textContent = person.rut || '-';
              $('#profileProfession').textContent = person.position || person.profesion || 'Perfil AFK';
              $('#profileEmail').textContent = person.email || person.correo || '-';
              $('#profilePhone').textContent = person.phone || person.telefono || '-';
              $('#profileStatus').textContent = person.status || 'OPERATIVO';
              $('#profileCvSummary').innerHTML = person.evaluacion_general || person.experiencia_general || 'Ficha estratégica local.';
              $('#profileEditBtn').onclick = () => window.location.href = `${type.includes('IA')?'candidate':'worker'}.html?id=${id}`;
              if (matchScore) injectMatchReport(matchScore, matchRole);
          }
      } catch (err) { console.error(err); } 
      finally { setTimeout(() => { if($('#profileScanner')) $('#profileScanner').style.display = 'none'; }, 600); }
  };

  function injectMatchReport(score, role) {
      const modalBody = document.querySelector('#personProfileModal .modal__body');
      const r = document.createElement('div');
      r.id = 'starkMatchReport'; r.style.gridColumn = '1 / -1'; r.style.background = 'rgba(34,211,238,0.08)';
      r.style.padding = '15px'; r.style.borderRadius = '8px'; r.style.border = '1px solid var(--accent)';
      const msg = score > 80 ? "Alta coincidencia." : (score > 50 ? "Compatible." : "Asignación crítica.");
      r.innerHTML = `<div style="display:flex; align-items:center; gap:20px;">
          <div><div style="font-size:9px; opacity:0.6;">SCORE</div><div style="font-size:24px; font-weight:900; color:var(--accent);">${Math.round(score)}%</div></div>
          <div><div style="font-size:11px; font-weight:900;">OBJETIVO: ${role.toUpperCase()}</div><div style="font-size:12px; font-style:italic;">"${msg}"</div></div>
      </div>`;
      modalBody.prepend(r);
  }

  const escapeHtml = (u) => (u||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  document.addEventListener('DOMContentLoaded', loadTenders);
})();
