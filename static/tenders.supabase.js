// tenders.supabase.js - Lógica Stark Intelligence V8: RECONSTRUCCIÓN NIVEL GOD
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
  if (tabWorkers && tabCandidates) {
    tabWorkers.onclick = () => {
        matchBodyWorkers.style.display = 'block';
        matchBodyCandidates.style.display = 'none';
        tabWorkers.style.color = 'var(--accent)';
        tabWorkers.style.borderBottom = '2px solid var(--accent)';
        tabCandidates.style.color = 'var(--muted)';
        tabCandidates.style.borderBottom = '2px solid transparent';
    };
    tabCandidates.onclick = () => {
        matchBodyWorkers.style.display = 'none';
        matchBodyCandidates.style.display = 'block';
        tabCandidates.style.color = 'var(--accent)';
        tabCandidates.style.borderBottom = '2px solid var(--accent)';
        tabWorkers.style.color = 'var(--muted)';
        tabWorkers.style.borderBottom = '2px solid transparent';
    };
  }

  // --- DASHBOARD TACTICAL VIEW ---

  async function loadTenders() {
    try {
      if (!window.supabase || typeof window.supabase.from !== 'function') {
        console.warn("[Stark] DB Link logic failed, retrying...");
        return setTimeout(loadTenders, 500);
      }
      if (tendersBody) tendersBody.innerHTML = '<div style="padding:40px; text-align:center;">SINCRONIZANDO NÚCLEO...</div>';
      
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allTenders = data || [];
      renderTenders();
    } catch (err) { console.error('[Stark] Error loadTenders:', err); }
  }

  function renderTenders() {
    if (!tendersBody) return;
    const term = (searchInput?.value || "").toLowerCase();
    const filtered = allTenders.filter(t => (t.name||"").toLowerCase().includes(term) || (t.description||"").toLowerCase().includes(term));

    tendersBody.innerHTML = filtered.map(t => {
      const topReqs = (t.requirements || []).slice(0, 3).map(r => `<span class="badge" style="font-size:10px; border-color:rgba(34,211,238,0.2)">${r}</span>`).join('');
      return `
        <div class="t-row stark-card" style="margin-bottom:10px; padding: 18px 20px; display:flex; align-items: center; border: 1px solid rgba(255,255,255,0.05); transition:all 0.4s;" onclick="window.editTenderById('${t.id}')">
          <div style="flex: 0 0 25%;">
            <div style="font-weight: 800; color:var(--text); font-size:15px; letter-spacing:0.5px;">${escapeHtml(t.name)}</div>
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
            <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}" style="font-weight:900; box-shadow: 0 0 10px rgba(34,211,238,0.1);">[ OPERATIVO ]</button>
            <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:var(--danger); opacity:0.6; hover:opacity:1;">🗑️</button>
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
    
    detectedVacancies = [];
    window.supabase.from('vacancies').select('*').eq('tender_id', t.id).then(async ({data}) => {
        detectedVacancies = data || [];
        await renderDetectedVacancies();
    });
    openModal(tenderModal);
  };

  async function deleteTender(id) {
    if (!confirm('¿DESACTIVAR PROYECTO?')) return;
    await window.supabase.from('vacancies').delete().eq('tender_id', id);
    await window.supabase.from('tenders').delete().eq('id', id);
    loadTenders();
  }

  // --- STARK SCANNER V3 (RADAR) ---

  const btnNewTender = $('#btnNewTender');
  if (btnNewTender) {
    btnNewTender.onclick = async () => {
      $('#tenderId').value = '';
      tenderForm.reset();
      reqContainer.innerHTML = '';
      detectedVacancies = [];
      await renderDetectedVacancies();
      addReqInput();
      uploadZone.style.display = 'block';
      intelPreview.style.display = 'none';
      openModal(tenderModal);
    };
  }

  if (uploadZone && pdfInput) {
    uploadZone.onclick = () => pdfInput.click();
    pdfInput.onchange = (e) => { if(e.target.files[0]) handleStarkScan(e.target.files[0]); };
    uploadZone.ondragover = (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent)'; };
    uploadZone.ondragleave = () => { uploadZone.style.borderColor = 'rgba(34,211,238,0.3)'; };
    uploadZone.ondrop = (e) => { e.preventDefault(); if(e.dataTransfer.files[0]) handleStarkScan(e.dataTransfer.files[0]); };
  }

  async function handleStarkScan(file) {
    scannerOverlay.style.display = 'flex';
    radarText.textContent = "DECODIFICANDO DOCUMENTO...";
    try {
      const text = await extractTextFromPDF(file);
      if (!text.trim()) throw new Error("ERROR: DOCUMENTO SIN CAPA DE TEXTO (SOLO_IMAGEN)");

      radarText.textContent = "JARVIS ANALIZANDO REQUISITOS...";
      radarLog.textContent = "ENVIANDO DATOS A MATRIZ IA...";
      
      const aiData = await analyzeTenderStarkV3(text);
      currentScanVacancies = aiData.vacancies || [];
      
      if (intelDesc) intelDesc.value = aiData.description;
      renderScanPreview(currentScanVacancies);
      
      if (scannerOverlay) scannerOverlay.style.display = 'none';
      uploadZone.style.display = 'none';
      intelPreview.style.display = 'block';
    } catch (err) {
      console.error("[Stark Scan Failure]", err);
      window.notificar?.(err.message, "error");
      if (scannerOverlay) scannerOverlay.style.display = 'none';
    }
  }

  async function analyzeTenderStarkV3(text) {
     try {
       const res = await fetch('/api/analyze-tender', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text })
       });
       const data = await res.json();
       if (!data.ok) throw new Error(data.detail || "Error en extracción Stark");
       
       const analysis = data.analysis;
       // Map to internal vacancies format
       const vacancies = (analysis.roles || []).map(r => ({
         title: r.nombre,
         quantity: r.cantidad || 1,
         requirements: [...(r.requisitos || []), ...(r.certificaciones || []), r.experiencia_minima].filter(Boolean)
       }));

       return {
         description: analysis.tender_summary,
         global_risk: analysis.global_risk,
         vacancies: vacancies
       };
     } catch (err) {
       console.error("[Stark Analyze Error]", err);
       throw err;
     }
  }

  function renderScanPreview(vacs) {
    if (!intelReqs) return;
    intelReqs.innerHTML = vacs.map((v, i) => `
      <div class="stark-card" style="padding:12px; margin-bottom:10px; border:1px solid rgba(34,211,238,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent); font-size:13px;">${v.title.toUpperCase()}</strong>
          <input type="checkbox" checked class="scan-v-check" data-vidx="${i}" style="accent-color:var(--accent);">
        </div>
        <div style="font-size:10px; color:var(--muted); margin-top:8px; line-height:1.4;">${v.requirements.join(' • ')}</div>
      </div>
    `).join('');
  }

  if ($('#btnImportIntel')) {
    $('#btnImportIntel').onclick = async () => {
      const selectedIndices = Array.from(document.querySelectorAll('.scan-v-check:checked')).map(c => parseInt(c.dataset.vidx));
      const chosen = selectedIndices.map(idx => currentScanVacancies[idx]).filter(v => v);

      detectedVacancies = [...detectedVacancies, ...chosen];
      await renderDetectedVacancies();
      
      if (intelDesc && $('#tenderDesc')) $('#tenderDesc').value = intelDesc.value;
      intelPreview.style.display = 'none';
      uploadZone.style.display = 'block';
      window.notificar?.("PROTOCOLO DE IMPORTACIÓN EXITOSO");
    };
  }

  async function renderDetectedVacancies() {
    if (!vacanciesList) return;
    vacanciesWrapper.style.display = detectedVacancies.length ? 'block' : 'none';
    
    // Fetch once to calculate stats
    const { data: ws } = await window.supabase.from('workers').select('*');
    const { data: cs } = await window.supabase.from('candidates').select('*');
    const { data: creds } = await window.supabase.from('worker_credentials').select('*');

    vacanciesList.innerHTML = detectedVacancies.map((v, i) => {
      const rs = v.requirements || [];
      
      // Calculate Stats logic
      const workerScores = (ws || []).map(w => {
        const wCs = (creds || []).filter(c => c.worker_id === w.id);
        const miss = rs.filter(r => !wCs.some(c => normalizeText(c.credential_name).includes(normalizeText(r))));
        return rs.length ? Math.round(((rs.length - miss.length) / rs.length) * 100) : 0;
      });

      const candidateScores = (cs || []).map(c => {
         const p = normalizeText(c.profesion || "");
         const t = normalizeText(v.title || "");
         const matchTitle = p.includes(t) || t.includes(p) ? 70 : 0;
         const evalMatch = rs.filter(r => normalizeText(c.evaluacion_general || "").includes(normalizeText(r))).length;
         const bonus = rs.length ? (evalMatch / rs.length) * 30 : 0;
         return Math.min(100, matchTitle + bonus);
      });

      const allScores = [...workerScores, ...candidateScores];
      const itemsAbove50 = allScores.filter(s => s >= 50).length;
      const bestScore = allScores.length ? Math.max(...allScores) : 0;

      const currentShortlist = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates || '[]') : (v.shortlisted_candidates || []);
      const qty = v.quantity || 1;
      const coverage = Math.min(100, Math.round((currentShortlist.length / qty) * 100));

      return `
      <div class="stark-card" style="padding:15px; margin-bottom:12px; border-left: 3px solid ${coverage === 100 ? '#10b981' : 'var(--accent)'}; position:relative; display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="btn btn--mini" style="position:absolute; top:2px; right:2px; color:var(--danger); font-weight:800; background:none; border:none;" onclick="window.remV(${i})">×</button>
        <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <div class="vacancy-pill" style="font-size:11px; font-weight:900; letter-spacing:1px; margin:0;">[ ${v.title.toUpperCase()} ]</div>
                <span class="badge" style="font-size:9px; background:rgba(255,255,255,0.05);">${currentShortlist.length} / ${qty} CUBIERTO</span>
            </div>
            <div style="font-size:10px; color:var(--muted); display:flex; flex-wrap:wrap; gap:4px;">
              ${v.requirements.map(r => `<span style="background:rgba(34,211,238,0.05); border:1px solid rgba(34,211,238,0.2); padding:2px 6px; border-radius:4px; color:rgba(255,255,255,0.7);">${r}</span>`).join('')}
            </div>
        </div>
        <div style="text-align:right; min-width:100px;">
            <div style="display:flex; flex-direction:column; align-items:center;">
                <svg width="40" height="40" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"></circle>
                    <circle cx="18" cy="18" r="16" fill="none" stroke="${coverage === 100 ? '#10b981' : 'var(--accent)'}" stroke-width="3" stroke-dasharray="${bestScore}, 100" stroke-linecap="round"></circle>
                    <text x="18" y="20.5" fill="${coverage === 100 ? '#10b981' : 'var(--accent)'}" font-size="8" font-weight="900" text-anchor="middle" transform="rotate(90 18 18)" style="font-family:monospace;">${Math.round(bestScore)}%</text>
                </svg>
                <div style="font-size:9px; color:var(--muted); margin-top:4px;">${itemsAbove50} aptos</div>
            </div>
        </div>
      </div>
    `}).join('');
  }
  window.remV = async (i) => { detectedVacancies.splice(i, 1); await renderDetectedVacancies(); };

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    console.log("[Stark] Iniciando proceso de guardado...");
    const id = $('#tenderId').value;
    const name = $('#tenderName').value;
    const desc = $('#tenderDesc').value;
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

    const { data: tRes, error: tErr } = id ? 
        await window.supabase.from('tenders').update({ name, description: desc, requirements: reqs }).eq('id', id).select() :
        await window.supabase.from('tenders').insert({ name, description: desc, requirements: reqs }).select();

    if (tErr) {
        console.error("[Stark] Error guardando licitación:", tErr);
        alert("ERROR CRÍTICO AL GUARDAR LICITACIÓN: " + tErr.message);
        return;
    }
    
    let tId = id;
    if (!tId) {
       const resData = Array.isArray(tRes) ? tRes[0] : tRes;
       tId = resData?.id; 
    }
    
    if (!tId) {
        console.error("[Stark] Fallo catastrófico de ID.", tRes);
        alert("ERROR: No se detectó ID de licitación.");
        return;
    }
    
    if (detectedVacancies.length > 0) {
        if (id) await window.supabase.from('vacancies').delete().eq('tender_id', id);
        const vacData = detectedVacancies.map(v => ({ 
            tender_id: tId, 
            title: v.title, 
            requirements: v.requirements 
        }));
        const { error: vErr } = await window.supabase.from('vacancies').insert(vacData);
        if (vErr) {
            console.error("[Stark] ERROR INSERTANDO VACANTES:", vErr);
            alert("ALERTA: Vacantes fallaron: " + vErr.message);
        }
    }
    
    window.notificar?.("MISIÓN CUMPLIDA [V8]: SISTEMA SINCRONIZADO AL 100%");
    closeModal(tenderModal);
    loadTenders();
  };

  // --- MATCHMAKING HUD V3 ---

  async function runMatchmaking(tender) {
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    if (tabWorkers) tabWorkers.click();
    
    matchBodyWorkers.innerHTML = '<div style="padding:40px; text-align:center;">SINTONIZANDO SEÑAL BIOMÉTRICA...</div>';
    
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let active = vacs?.length ? vacs : [{ id: 'global', title: 'OPERACIÓN GLOBAL', requirements: tender.requirements || [] }];
    
    // Connect Auto-Fill button
    const btnAuto = $('#btnStarkAutoFill');
    if (btnAuto) {
        btnAuto.onclick = () => starkAutoAllocateTeam(tender, active);
    }

    vacancySelector.innerHTML = active.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
    vacancySelector.onchange = () => {
        evaluate(tender, active[vacancySelector.value]);
    };
    
    // Update Coverage HUD
    updateTeamStats(active);
    evaluate(tender, active[0]);
  }

  async function updateTeamStats(vacancies) {
      const totalRequested = vacancies.reduce((acc, v) => acc + (v.quantity || 1), 0);
      let totalAssigned = 0;
      const missing = [];

      vacancies.forEach(v => {
          let shortlist = [];
          try {
              shortlist = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates) : (v.shortlisted_candidates || []);
          } catch(e) {}
          
          totalAssigned += shortlist.length;
          const needed = (v.quantity || 1) - shortlist.length;
          if (needed > 0) missing.push(`${needed} ${v.title}`);
      });

      const coverage = totalRequested ? Math.round((totalAssigned / totalRequested) * 100) : 0;
      
      const pctEl = $('#coveragePct');
      const fillEl = $('#coverageFill');
      const statusEl = $('#teamStatusText');
      const missingEl = $('#missingRolesTags');
      const riskEl = $('#tenderRiskBadge');

      if (pctEl) pctEl.textContent = `${coverage}%`;
      if (fillEl) fillEl.style.width = `${coverage}%`;
      
      if (statusEl) {
          if (coverage === 100) statusEl.textContent = "EQUIPO COMPLETO: PROTOCOLO DE DESPLIEGUE LISTO.";
          else if (coverage > 0) statusEl.textContent = `COBERTURA PARCIAL. RECOPILANDO RECURSOS FALTANTES.`;
          else statusEl.textContent = "ANALIZANDO BRECHAS... EQUIPO EN ESTADO DE VACANTE.";
      }

      if (missingEl) {
          missingEl.innerHTML = missing.map(m => `<span class="badge" style="background:#f43f5e; color:#fff; border:none; font-size:9px;">FALTA: ${m.toUpperCase()}</span>`).join('');
      }

      if (riskEl) {
          let risk = "BAJO";
          let color = "#10b981";
          if (coverage < 50) { risk = "ALTO"; color = "#f43f5e"; }
          else if (coverage < 90) { risk = "MEDIO"; color = "#f59e0b"; }
          riskEl.textContent = `RIESGO: ${risk}`;
          riskEl.style.borderColor = color;
          riskEl.style.color = color;
      }
  }

  async function starkAutoAllocateTeam(tender, vacancies) {
      window.notificar?.("INICIANDO PROTOCOLO AUTOMÁTICO DE ASIGNACIÓN...", "info");
      
      for (const v of vacancies) {
          if (v.id === 'global') continue;
          
          let shortlist = [];
          try {
              shortlist = (typeof v.shortlisted_candidates === 'string') ? JSON.parse(v.shortlisted_candidates) : (v.shortlisted_candidates || []);
          } catch(e) {}

          const needed = (v.quantity || 1) - shortlist.length;
          if (needed <= 0) continue;

          // Search logic (Simplified high-match auto-approval)
          const { data: candidates } = await window.supabase.from('candidates').select('*');
          const rs = v.requirements || [];
          
          const highMatches = (candidates || []).map(c => {
              // Basic match score logic (can be expanded to use the embedding logic)
              const profMatch = normalizeText(c.profesion || "").includes(normalizeText(v.title)) ? 60 : 0;
              const evalMatch = rs.filter(r => normalizeText(c.evaluacion_general || "").includes(normalizeText(r))).length;
              const score = Math.min(100, profMatch + (rs.length ? (evalMatch / rs.length) * 40 : 0));
              return { ...c, score };
          })
          .filter(c => c.score >= 80 && !shortlist.some(s => s.id === c.id))
          .sort((a,b) => b.score - a.score)
          .slice(0, needed);

          if (highMatches.length > 0) {
              const newList = [...shortlist, ...highMatches.map(c => ({
                  id: c.id,
                  name: c.nombre_completo,
                  type: 'CANDIDATO IA',
                  score: c.score
              }))];
              
              await window.supabase.from('vacancies').update({ shortlisted_candidates: JSON.stringify(newList) }).eq('id', v.id);
              window.notificar?.(`AUTO-ASIGNADO: ${highMatches.length} perfiles para ${v.title}`, "success");
          }
      }
      
      window.notificar?.("PROTOCOLO FINALIZADO. REINICIANDO HUD...", "success");
      // Refresh the tender vacancies to get updated data
      const { data: updatedVacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
      updateTeamStats(updatedVacs);
      evaluate(tender, updatedVacs[vacancySelector.value]);
  }

  async function evaluate(tender, vacancy) {
    const rs = vacancy.requirements || [];
    
    // Check if Vacancy has shortlisted candidates
    let shortlist = [];
    try {
        if (typeof vacancy.shortlisted_candidates === 'string') {
            shortlist = JSON.parse(vacancy.shortlisted_candidates);
        } else if (Array.isArray(vacancy.shortlisted_candidates)) {
            shortlist = vacancy.shortlisted_candidates;
        }
    } catch(e) {}

     const shortlistHTML = shortlist.length > 0 ? `
      <div class="stark-card" style="margin-bottom: 20px; padding: 15px; border: 1px solid var(--accent); background: rgba(34,211,238,0.05);">
        <div style="color:var(--accent); font-weight:800; font-size:12px; margin-bottom:10px; text-transform:uppercase;">
           ⚡ CANDIDATOS EN PROCESO DE SELECCIÓN (${shortlist.length})
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${shortlist.map((c, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:4px; border-left:2px solid var(--accent); cursor:pointer;" onclick="window.openPersonProfile('${c.id}', '${c.type}')">
               <div>
                 <strong style="color:var(--text); font-size:12px;">${c.name.toUpperCase()}</strong>
                 <span style="font-size:10px; color:var(--muted); margin-left:8px;">[ ${c.type} ]</span>
               </div>
               <div style="display:flex; align-items:center; gap:10px;">
                 <span style="color:var(--accent); font-family:monospace; font-size:12px; font-weight:bold;">${c.score}%</span>
                 <button onclick="event.stopPropagation(); window.starkRemoveShortlist('${vacancy.id}', '${c.id}')" class="btn btn--mini" style="color:var(--danger); font-size:10px; padding:2px 6px;">X</button>
               </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    try {
      console.log(`[Stark] Iniciando Match: Vacante="${vacancy.title}" Reqs=[${rs.join(', ')}]`);
      const { data: ws } = await window.supabase.from('workers').select('*');
      const { data: cs } = await window.supabase.from('worker_credentials').select('*');
      console.log(`[Stark] Datos Recuperados: Workers=${ws?.length || 0} Credentials=${cs?.length || 0}`);
      
      const scored = (ws || []).map(w => {
        const wCs = (cs || []).filter(c => c.worker_id === w.id);
        const matched = rs.filter(r => wCs.some(c => normalizeText(c.credential_name).includes(normalizeText(r))));
        const miss = rs.filter(r => !matched.includes(r));
        const score = rs.length ? Math.round((matched.length / rs.length) * 100) : 0;
        return { w, score, matched, miss };
      }).sort((a,b) => b.score - a.score);

      matchBodyWorkers.innerHTML = shortlistHTML + (scored.length ? scored.map(r => {
        const isPreselected = shortlist.some(s => s.id === r.w.id);
        const dashArray = (r.score / 100) * 100.5; // Aproximación para el círculo SVG
        
        return `
        <div class="t-row stark-card" style="padding:20px; margin-bottom:12px; cursor:pointer; border: ${isPreselected ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)'};" onclick="window.openPersonProfile('${r.w.id}', 'AFK')">
          <div class="scan-line"></div>
          <div style="display:flex; justify-content:space-between; align-items:center; position:relative; z-index:2;">
            <div style="display:flex; gap:15px; align-items:center;">
               <div style="position:relative;">
                  <svg width="50" height="50" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(34,211,238,0.1)" stroke-width="2"></circle>
                    <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="${dashArray} 100" transform="rotate(-90 18 18)" style="transition: stroke-dasharray 1s ease;"></circle>
                    <text x="18" y="20.5" fill="var(--accent)" font-size="8" font-weight="900" text-anchor="middle" style="font-family:'JetBrains Mono', monospace;">${r.score}%</text>
                  </svg>
               </div>
               <div>
                  <div class="hud-tag" style="margin-bottom:5px;">SISTE_ID: ${r.w.id.substring(0,4)}</div>
                  <strong style="color:var(--text); font-size:16px; letter-spacing:0.5px;">${r.w.full_name.toUpperCase()}</strong>
                  <div style="font-size:11px; color:var(--muted); margin-top:4px;">STATUS: ${r.w.status || 'ACTIVE_OPERATIVE'}</div>
               </div>
            </div>
            
            <div style="text-align:right;">
                ${!isPreselected && vacancy.id !== 'global' ? `<button onclick="event.stopPropagation(); window.starkShortlist('${vacancy.id}','${r.w.id}','${escapeHtml(r.w.full_name)}','AFK',${r.score})" class="btn btn--mini btn--primary" style="padding:6px 12px; font-weight:800; letter-spacing:1px;">+ DESPLEGAR</button>` : `<div class="hud-tag" style="background:var(--accent); color:#000;">EN_PROCESO</div>`}
            </div>
          </div>
          
          <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
             ${r.w.position ? `<span class="hud-tag">[ CARGO: ${r.w.position.toUpperCase()} ]</span>` : ''}
             ${r.w.company_name ? `<span class="hud-tag">[ UNIDAD: ${r.w.company_name.toUpperCase()} ]</span>` : ''}
          </div>

          ${r.miss.length || r.matched.length ? `
            <div style="margin-top:12px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:9px; color:var(--accent); font-family:monospace; cursor:pointer; font-weight:800; border:1px solid rgba(34,211,238,0.3); padding:2px 8px; border-radius:4px;" onclick="event.stopPropagation(); const d=this.parentElement.nextElementSibling; d.style.display=d.style.display==='none'?'block':'none'; this.innerHTML = d.style.display==='none' ? '➔ VER ANÁLISIS DE CAPACIDADES' : '✖ CERRAR ANÁLISIS';">➔ VER ANÁLISIS DE CAPACIDADES</span>
                </div>
                <div class="analysis-detail" style="display:none; margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; font-size:10px;">
                        <div>
                            <div style="color:#00ff64; margin-bottom:8px; font-weight:900; letter-spacing:0.5px;">[ REQUISITOS_CUMPLIDOS ]</div>
                            ${r.matched.length ? r.matched.map(m => `<div style="color:var(--text); opacity:0.9; margin-bottom:3px;">✅ ${m.toUpperCase()}</div>`).join('') : '<div style="color:var(--muted); font-style:italic;">Ningún requisito detectado.</div>'}
                        </div>
                        <div>
                            <div style="color:#f43f5e; margin-bottom:8px; font-weight:900; letter-spacing:0.5px;">[ BRECHA_OPERATIVA ]</div>
                            ${r.miss.length ? r.miss.map(m => `<div style="color:#f43f5e; margin-bottom:3px;">❌ ${m.toUpperCase()}</div>`).join('') : '<div style="color:#00ff64;">Sin brechas detectadas.</div>'}
                        </div>
                    </div>
                </div>
            </div>
          ` : ''}
        </div>
      `}).join('') : '<p style="padding:30px; text-align:center; color:var(--muted); font-size:12px;">No se detectaron operarios AFK para este perfil.</p>');

      matchBodyCandidates.innerHTML = '<div style="padding:40px; text-align:center;">ESCANEO DE ESPACIO VECTORIAL...</div>';
      
      // ... (continúa lógica de candidatos)
      // (Para brevedad, aplicaré el mismo estilo táctico a los candidatos en el siguiente paso o en esta misma llamada si es posible)

      // Nota: Estoy pausando aquí para asegurar que los workers se renderizan bien antes de aplicar lo mismo a candidatos.

      
      // Stark Optimization: Session Cache & Fast Fallback
      if (!window._starkCache) window._starkCache = {};
      const cacheKey = `v_${vacancy.id}_${rs.join('_')}`;

      let queryVector = window._starkCache[cacheKey] || null;
      let usedFallback = false;

      if (!queryVector) {
          try {
              // 5s Timeout for Vector Search
              queryVector = await Promise.race([
                  getEmbedding(`${vacancy.title} ${rs.join(' ')}`),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
              ]);
              if (queryVector) window._starkCache[cacheKey] = queryVector;
          } catch (te) {
              console.warn("[Stark] Vector Latency Spike - Rapid Keyword Fallback Active.");
              usedFallback = true;
          }
      }

      const { data: candidates } = await window.supabase.from('candidates').select('id, nombre_completo, profesion, evaluacion_general, experiencia_general, experiencia_especifica, match_explicacion, cv_embedding');
      console.log(`[Stark] BBDD Matcher: ${candidates?.length || 0} perfiles localizados.`);
      
      const m = (candidates || []).map(c => {
         // --- START STARK SCORING PROTOCOL ---
         let finalScore = 0;
         let isVectorMatch = false;

         // 1. Text Normalization (Aggressive)
         const clean = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g, " ").trim();
         
         const pClean = clean(c.profesion || "");
         const tClean = clean(vacancy.title || "");
         const evClean = clean((c.evaluacion_general || "") + " " + (c.experiencia_general || ""));
         
         const tWords = tClean.split(/\s+/).filter(w => w.length >= 3);
         const rsClean = rs.map(r => clean(r));

         // 2. Keyword Match (TITLE)
         let titleScore = 0;
         if (tClean && pClean) {
            if (pClean.includes(tClean) || tClean.includes(pClean)) {
                titleScore = 70; // Direct match
            } else if (tWords.length > 0) {
                const matches = tWords.filter(w => pClean.includes(w)).length;
                titleScore = (matches / tWords.length) * 50; 
            }
         }

         // 3. Requirement Match (BONUS - Keyword Based)
         let reqScore = 0;
         if (rsClean.length > 0) {
             let totalMatchPct = 0;
             rsClean.forEach(req => {
                 const reqKeywords = req.split(/\s+/).filter(w => w.length >= 3);
                 if (reqKeywords.length > 0) {
                     const hits = reqKeywords.filter(kw => evClean.includes(kw)).length;
                     totalMatchPct += (hits / reqKeywords.length);
                 }
             });
             reqScore = (totalMatchPct / rsClean.length) * 35; // 35% Weight for specialized reqs
         }

         const keywordTotal = Math.min(100, titleScore + reqScore);

         // 4. Vector Match (INTELLIGENCE)
         let semanticScore = 0;
         if (queryVector && c.cv_embedding) {
            try {
                const vCand = (typeof c.cv_embedding === 'string') ? JSON.parse(c.cv_embedding) : c.cv_embedding;
                if (Array.isArray(vCand) && vCand.length === queryVector.length) {
                    semanticScore = cosineSimilarity(queryVector, vCand) * 100;
                    if (semanticScore > 10) isVectorMatch = true; 
                }
            } catch(e) {}
         }

         // 5. Final Hybrid Blend
         // If we have vectors, 70/30. If not, 100% keyword.
         if (isVectorMatch) {
             finalScore = (semanticScore * 0.7) + (keywordTotal * 0.3);
         } else {
             finalScore = keywordTotal;
         }

         // Security Fallback: If title contains a direct word from vacancy, ensure at least 15%
         if (finalScore < 15 && tWords.some(w => pClean.includes(w))) finalScore = 15;

                   // Intelligence Matching Details
          const matchedByIA = rsClean.filter(r => pClean.includes(r) || evClean.includes(r));
          const missByIA = rsClean.filter(r => !matchedByIA.includes(r));

          return { ...c, ai_match_score: finalScore, isVector: isVectorMatch, matched: matchedByIA, miss: missByIA };
      }).sort((a,b) => b.ai_match_score - a.ai_match_score);
      
      matchBodyCandidates.innerHTML = shortlistHTML + (m.length ? m.map(c => {
        const isPreselected = shortlist.some(s => s.id === c.id);
        const scoreVal = c.ai_match_score || 0;
        const dashArray = (scoreVal / 100) * 100.5;

        // Extraction of professional highlights (sites/faenas) with robust fallback
        const rawHighlights = c.experiencia_especifica || c.experiencia_general || c.experiencia || "";
        const highlights = rawHighlights.split('\n').filter(l => l.trim()).slice(0, 2);
        
        return `
        <div class="t-row stark-card" style="padding:20px; margin-bottom:12px; cursor:pointer; border: ${isPreselected ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)'};" onclick="window.openPersonProfile('${c.id}', 'IA EXTERNO')">
          <div class="scan-line"></div>
          <div style="display:flex; justify-content:space-between; align-items:center; position:relative; z-index:2;">
            <div style="display:flex; gap:15px; align-items:center;">
               <div style="position:relative;">
                  <svg width="50" height="50" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(34,211,238,0.1)" stroke-width="2"></circle>
                    <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" stroke-opacity="${scoreVal > 50 ? 1 : 0.4}" stroke-width="2.5" stroke-dasharray="${dashArray} 100" transform="rotate(-90 18 18)" style="transition: stroke-dasharray 1.5s ease;"></circle>
                    <text x="18" y="20.5" fill="var(--accent)" font-size="8" font-weight="900" text-anchor="middle" style="font-family:'JetBrains Mono', monospace;">${Math.round(scoreVal)}%</text>
                  </svg>
               </div>
               <div>
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                     <div class="hud-tag">ID_CAND: ${c.id.substring(0,4)}</div>
                     ${c.isVector ? '<span class="hud-tag" style="background:rgba(168,85,247,0.1); border-color:rgba(168,85,247,0.3); color:#a855f7;">VECTOR_IA</span>' : ''}
                  </div>
                  <strong style="color:var(--text); font-size:16px; letter-spacing:0.5px;">${c.nombre_completo.toUpperCase()}</strong>
                  <div style="font-size:11px; color:var(--muted); margin-top:4px;">PROPUESTA: ${c.profesion || 'PERFIL_PENDIENTE'}</div>
               </div>
            </div>
            
            <div style="text-align:right;">
                ${!isPreselected && vacancy.id !== 'global' ? `<button onclick="event.stopPropagation(); window.starkShortlist('${vacancy.id}','${c.id}','${escapeHtml(c.nombre_completo)}','IA EXTERNO',${scoreVal.toFixed(1)})" class="btn btn--mini btn--primary" style="padding:6px 12px; font-weight:800; letter-spacing:1px; background:linear-gradient(135deg, var(--accent), var(--primary)); border:none;">+ PRESELECCIONAR</button>` : `<div class="hud-tag" style="background:var(--accent); color:#000; font-weight:bold;">RECLUTADO</div>`}
            </div>
          </div>
          
          <!-- Historial y Evaluación Rápida -->
          <div style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px; margin-bottom:12px;">
             <div>
                <div style="font-size:9px; color:var(--accent); font-family:monospace; margin-bottom:5px; opacity:0.7;">HISTORIAL_CRÍTICO:</div>
                <div style="font-size:11px; color:var(--text); line-height:1.4;">${highlights.length ? highlights.map(h => `• ${h}`).join('<br>') : 'Analizando trayectoria...'}</div>
             </div>
             <div style="text-align:right;">
                <div style="font-size:9px; color:var(--accent); font-family:monospace; margin-bottom:5px; opacity:0.7;">PROPOSICIÓN_DE_VALOR:</div>
                <p style="font-size:10px; color:var(--muted); line-height:1.4;">${c.evaluacion_general ? c.evaluacion_general.substring(0, 100) + '...' : 'Análisis táctico completado.'}</p>
             </div>
          </div>

          <!-- Desglose de Inteligencia (Cosas que tiene y que le faltan) -->
          <div style="border-top:1px dashed rgba(255,255,255,0.08); padding-top:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:9px; color:var(--accent); font-family:monospace; cursor:pointer; font-weight:800; border:1px solid rgba(34,211,238,0.3); padding:2px 8px; border-radius:4px;" onclick="event.stopPropagation(); const d=this.parentElement.nextElementSibling; d.style.display=d.style.display==='none'?'block':'none'; this.innerHTML = d.style.display==='none' ? '➔ VER ANÁLISIS DE BRECHAS' : '✖ CERRAR ANÁLISIS';">➔ VER ANÁLISIS DE BRECHAS</span>
              </div>
              <div class="analysis-detail" style="display:none; margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; font-size:10px;">
                      <div>
                          <div style="color:#00ff64; margin-bottom:8px; font-weight:900; letter-spacing:0.5px;">[ REQUISITOS_CUMPLIDOS ]</div>
                          ${c.matched && c.matched.length ? c.matched.map(m => `<div style="color:var(--text); opacity:0.9; margin-bottom:3px;">✅ ${m.toUpperCase()}</div>`).join('') : '<div style="color:var(--muted); font-style:italic;">Evaluando potencial técnico...</div>'}
                      </div>
                      <div>
                          <div style="color:#f43f5e; margin-bottom:8px; font-weight:900; letter-spacing:0.5px;">[ BRECHAS_DETECTADAS ]</div>
                          ${c.miss && c.miss.length ? c.miss.map(m => `<div style="color:#f43f5e; margin-bottom:3px;">❌ ${m.toUpperCase()}</div>`).join('') : '<div style="color:#00ff64;">Cubre todos los criterios del perfil.</div>'}
                      </div>
                  </div>
                  ${c.match_explicacion ? `
                    <div style="margin-top:15px; font-size:11px; color:rgba(255,255,255,0.7); border-top:1px solid rgba(255,255,255,0.05); padding-top:12px; line-height:1.5; font-style:italic;">
                        <span style="color:var(--accent); font-weight:900; font-style:normal;">TACTICAL_INSIGHT:</span> "${c.match_explicacion}"
                    </div>
                  ` : ''}
              </div>
          </div>


        </div>
      `}).join('') : '<p style="padding:40px; text-align:center; color:var(--muted); font-size:12px;">JARVIS: Sin perfiles en el mercado externo.<br><small>Sugerencia: Ampliar criterios.</small></p>');


    } catch (e) { 
        console.error("[Stark] Fallo en Evaluación:", e);
        window.notificar?.("Error en motor matchmaking.", "error");
    }
  }

  // --- STARK PIPELINE PROTOCOL ---
  window.starkShortlist = async function(vacId, personId, personName, type, score) {
      $('#matchTitle').textContent = "AÑADIENDO A SELECCIÓN...";
      try {
          const { data: vCurrent } = await window.supabase.from('vacancies').select('shortlisted_candidates').eq('id', vacId).single();
          let currentList = [];
          if(vCurrent && vCurrent.shortlisted_candidates) {
              if (typeof vCurrent.shortlisted_candidates === 'string') currentList = JSON.parse(vCurrent.shortlisted_candidates);
              else currentList = vCurrent.shortlisted_candidates;
          }
          if(!currentList.some(c => c.id === personId)) {
              currentList.push({ id: personId, name: personName, type: type, score: score, added_at: new Date().toISOString() });
              const { error } = await window.supabase.from('vacancies').update({ shortlisted_candidates: currentList }).eq('id', vacId);
              if (error) throw error;
              window.notificar?.(`[ ${personName.toUpperCase()} ] EN PROCESO DE SELECCIÓN`);
          }
          const tenderId = $('#tenderId').value || allTenders.find(t => t.id === document.querySelector('.btn-match[data-id]')?.dataset?.id)?.id;
          if(tenderId) {
             const t = allTenders.find(x => x.id === tenderId);
             if(t) runMatchmaking(t); else loadTenders();
          } else loadTenders(); closeModal(matchModal); 
      } catch(err) {
          alert("ERROR: Ejecuta el script SQL para añadir la columna 'shortlisted_candidates'.\nDetalle: " + err.message);
          $('#matchTitle').textContent = "Aptitud Licitación";
      }
  };

  window.starkRemoveShortlist = async function(vacId, personId) {
      $('#matchTitle').textContent = "REMOVIENDO...";
      try {
          const { data: vCurrent } = await window.supabase.from('vacancies').select('shortlisted_candidates').eq('id', vacId).single();
          let currentList = [];
          if(vCurrent && vCurrent.shortlisted_candidates) {
              if (typeof vCurrent.shortlisted_candidates === 'string') currentList = JSON.parse(vCurrent.shortlisted_candidates);
              else currentList = vCurrent.shortlisted_candidates;
          }
          currentList = currentList.filter(c => c.id !== personId);
          await window.supabase.from('vacancies').update({ shortlisted_candidates: currentList }).eq('id', vacId);
          window.notificar?.("CANDIDATO DESCARTADO DE LA SELECCIÓN");
          
          const tenderId = $('#tenderId').value || allTenders.find(t => t.id === document.querySelector('.btn-match[data-id]')?.dataset?.id)?.id;
          if(tenderId) {
             const t = allTenders.find(x => x.id === tenderId);
             if(t) runMatchmaking(t); else loadTenders();
          } else loadTenders(); closeModal(matchModal);
      } catch(err) { console.error(err); }
  };

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.className = 'grid-2'; div.style.gap = '8px';
    div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required><button type="button" class="btn btn--mini btn-del-req" style="color:var(--danger)">×</button>`;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    reqContainer.appendChild(div);
  }

  async function extractTextFromPDF(file) {
    console.log("[Scanner] Iniciando extracción de texto para:", file.name);
    const reader = new FileReader();
    const ab = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("Fibras de PDF.js no cargadas en el sistema.");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument({ data: ab, disableWorker: true });
    const pdf = await loadingTask.promise;
    let t = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
       const p = await pdf.getPage(i);
       const c = await p.getTextContent();
       t += c.items.map(item => item.str).join(" ") + "\n";
    }
    return t;
  }

  // --- STARK BIOMETRIC PROTOCOL ---
  window.openPersonProfile = async function(id, type) {
      openModal(personProfileModal);
      $('#profileScanner').style.display = 'flex';
      
      try {
          let person = null;
          if (type === 'AFK') {
              const { data } = await window.supabase.from('workers').select('*').eq('id', id).single();
              person = data;
              if (person) {
                  $('#profileType').textContent = '[ OPERARIO AFK ]';
                  $('#profileName').textContent = person.full_name.toUpperCase();
                  $('#profileRut').textContent = person.rut || '-';
                  $('#profileProfession').textContent = person.position || 'Operativo AFK';
                  $('#profileCompany').textContent = person.company_name || 'AFK RRHH';
                  $('#profileEmail').textContent = person.email || '-';
                  $('#profilePhone').textContent = person.phone || '-';
                  $('#profileCvSummary').innerHTML = `<p style="color:var(--muted); font-style:italic;">Accediendo a base de datos de cumplimiento AFK... No se detecta resumen de CV IA para este operario activo. Sin embargo, su estatus es: ${person.status}.</p>`;
                   $('#profileAcademic').textContent = person.academic_info || 'Información académica no centralizada.';
                   $('#profileStatus').textContent = `● ${person.status || 'HABILITADO'}`;
                   $('#profileStatus').style.color = (person.status === 'Bloqueado') ? 'var(--danger)' : 'var(--ok)';
                   const expEl = $('#profileExp');
                   if (expEl) expEl.textContent = (person.experiencia_total || '0') + ' años';
                   $('#profileEditBtn').onclick = () => window.location.href = `worker.html?id=${id}`;
               }
           } else {
               const { data } = await window.supabase.from('candidates').select('*').eq('id', id).single();
               person = data;
               if (person) {
                   $('#profileType').textContent = '[ CANDIDATO EXTERNO IA ]';
                   $('#profileName').textContent = (person.nombre_completo || 'SIN NOMBRE').toUpperCase();
                   $('#profileRut').textContent = person.rut || '-';
                   $('#profileProfession').textContent = person.profesion || 'Candidato Externo';
                   $('#profileCompany').textContent = 'FUERZA EXTERNA';
                   $('#profileEmail').textContent = person.correo || '-';
                   $('#profilePhone').textContent = person.telefono || '-';
                   const expEl = $('#profileExp');
                   if (expEl) expEl.textContent = (person.experiencia_total || '0') + ' años';
                   $('#profileCvSummary').innerHTML = `
                       <div style="color:var(--accent); font-weight:800; margin-bottom:10px;">EVALUACIÓN IA:</div>
                       <p>${person.evaluacion_general || 'Sin evaluación detallada.'}</p>
                       <div style="color:var(--accent); font-weight:800; margin:15px 0 10px;">RESUMEN DE EXPERIENCIA:</div>
                       <p>${person.experiencia_general || 'Pendiente de análisis exhaustivo.'}</p>
                   `;
                   $('#profileAcademic').textContent = person.antecedentes_academicos || 'No se detectaron registros educativos.';
                   $('#profileStatus').textContent = `● ÍNDICE DE MÉRITO: ${person.nota || '5.0'}`;
                   $('#profileStatus').style.color = 'var(--accent)';
                   $('#profileEditBtn').onclick = () => window.location.href = `candidate.html?id=${id}`;
               }
           }
       } catch (err) { 
           console.error("[Stark] Biometric Sync Error:", err); 
       } finally {
           setTimeout(() => { 
                const scanner = $('#profileScanner');
                if (scanner) scanner.style.display = 'none'; 
           }, 800);
       }
  };

  // --- VECTOR SEARCH CORE (STARK V12) ---
  async function getEmbedding(text) {
    const WEBHOOK = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `VECTORIZE: ${text}` })
      });
      const data = await res.json();
      const payload = Array.isArray(data) ? data[0] : data;
      const raw = payload.output || payload.text || payload.reply || "";
      
      // Detect 1536-dim vector in JSON or raw
      if (Array.isArray(payload.embedding)) return payload.embedding;
      const sIdx = raw.indexOf('[');
      const eIdx = raw.lastIndexOf(']') + 1;
      if (sIdx !== -1) return JSON.parse(raw.substring(sIdx, eIdx));
      return null;
    } catch (e) { console.warn("[Vector Engine] Error vectorizing:", e); return null; }
  }

  function cosineSimilarity(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dot = 0, mA = 0, mB = 0;
    for (let i = 0; i < v1.length; i++) {
       dot += v1[i] * v2[i];
       mA += v1[i] * v1[i];
       mB += v2[i] * v2[i];
    }
    return dot / (Math.sqrt(mA) * Math.sqrt(mB));
  }

  const escapeHtml = (u) => (u||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const normalizeText = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
