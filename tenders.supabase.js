// tenders.supabase.js - Lógica Stark Intelligence V8: RECONSTRUCCIÓN NIVEL GOD
(function () {
  const $ = (s) => document.querySelector(s);
  
  // UI - Dash & Modals
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
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
    b.onclick = () => { closeModal(tenderModal); closeModal(matchModal); };
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
    window.supabase.from('vacancies').select('*').eq('tender_id', t.id).then(({data}) => {
        detectedVacancies = data || [];
        renderDetectedVacancies();
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
    btnNewTender.onclick = () => {
      $('#tenderId').value = '';
      tenderForm.reset();
      reqContainer.innerHTML = '';
      detectedVacancies = [];
      renderDetectedVacancies();
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
      if (!text.trim()) throw new Error("ERROR: DOCUMENTO SIN CAPA DE TEXTO (IMAGE_ONLY)");

      radarText.textContent = "JARVIS ANALYZING REQS...";
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
     const WEBHOOK = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
     const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
             message: `ACTÚA COMO JARVIS (STARK INDUSTRIES):
             Analiza este texto de licitación y extrae la JERARQUÍA OPERATIVA.
             1. Resumen Ejecutivo (max 250 chars).
             2. Lista de Roles/Vacantes Críticas. Para cada una, extrae sus REQUISITOS TÉCNICOS ESPECÍFICOS (certificaciones, años exp, etc).
             
             FORMATO OBLIGATORIO (JSON ESTRICTO):
             {
               "description": "...",
               "vacancies": [
                 { "title": "Nombre del Cargo", "requirements": ["Req 1", "Req 2"] }
               ]
             }
             
             TEXTO A ANALIZAR:
             ${text.substring(0, 5000)}` 
        })
     });
     const data = await res.json();
     let payload = Array.isArray(data) ? data[0] : data;
     let raw = payload.output || payload.text || payload.reply || "";
     
     let final = { description: "", vacancies: [] };
     try {
       const sIdx = raw.indexOf('{');
       const eIdx = raw.lastIndexOf('}') + 1;
       final = JSON.parse(raw.substring(sIdx, eIdx));
     } catch (e) { console.error("Parse Error", e); }
     
     if (!final.vacancies?.length) {
        final.vacancies = [{ title: "PERFIL BASE CAPTURADO", requirements: ["Cumplimiento de bases técnicas"] }];
     }
     return final;
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
    $('#btnImportIntel').onclick = () => {
      const selectedIndices = Array.from(document.querySelectorAll('.scan-v-check:checked')).map(c => parseInt(c.dataset.vidx));
      const chosen = selectedIndices.map(idx => currentScanVacancies[idx]).filter(v => v);

      detectedVacancies = [...detectedVacancies, ...chosen];
      renderDetectedVacancies();
      
      if (intelDesc && $('#tenderDesc')) $('#tenderDesc').value = intelDesc.value;
      intelPreview.style.display = 'none';
      uploadZone.style.display = 'block';
      window.notificar?.("PROTOCOLO DE IMPORTACIÓN EXITOSO");
    };
  }

  function renderDetectedVacancies() {
    if (!vacanciesList) return;
    vacanciesWrapper.style.display = detectedVacancies.length ? 'block' : 'none';
    vacanciesList.innerHTML = detectedVacancies.map((v, i) => `
      <div class="stark-card" style="padding:15px; margin-bottom:12px; border-left: 3px solid var(--accent); position:relative;">
        <button type="button" class="btn btn--mini" style="position:absolute; top:10px; right:10px; color:var(--danger); font-weight:800;" onclick="window.remV(${i})">X</button>
        <div class="vacancy-pill" style="font-size:11px; font-weight:900; letter-spacing:1px;">[ ${v.title.toUpperCase()} ]</div>
        <div style="font-size:10px; color:var(--muted); margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">
          ${v.requirements.map(r => `<span style="background:rgba(34,211,238,0.1); border:1px solid rgba(34,211,238,0.3); padding:3px 8px; border-radius:12px; color:var(--text);">${r}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }
  window.remV = (i) => { detectedVacancies.splice(i, 1); renderDetectedVacancies(); };

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
    
    vacancySelector.innerHTML = active.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
    vacancySelector.onchange = () => evaluate(tender, active[vacancySelector.value]);
    evaluate(tender, active[0]);
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
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:4px; border-left:2px solid var(--accent);">
               <div>
                 <strong style="color:var(--text); font-size:12px;">${c.name.toUpperCase()}</strong>
                 <span style="font-size:10px; color:var(--muted); margin-left:8px;">[ ${c.type} ]</span>
               </div>
               <div style="display:flex; align-items:center; gap:10px;">
                 <span style="color:var(--accent); font-family:monospace; font-size:12px; font-weight:bold;">${c.score}%</span>
                 <button onclick="window.starkRemoveShortlist('${vacancy.id}', '${c.id}')" class="btn btn--mini" style="color:var(--danger); font-size:10px; padding:2px 6px;">X</button>
               </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    try {
      const { data: ws } = await window.supabase.from('workers').select('*');
      const { data: cs } = await window.supabase.from('worker_credentials').select('*');
      
      const scored = (ws || []).map(w => {
        const wCs = (cs || []).filter(c => c.worker_id === w.id);
        const miss = rs.filter(r => !wCs.some(c => normalizeText(c.credential_name).includes(normalizeText(r))));
        const score = rs.length ? Math.round(((rs.length - miss.length) / rs.length) * 100) : 0;
        return { w, score, miss };
      }).sort((a,b) => b.score - a.score);

      matchBodyWorkers.innerHTML = shortlistHTML + scored.map(r => {
        const isPreselected = shortlist.some(s => s.id === r.w.id);
        return `
        <div class="t-row stark-card" style="padding:15px; margin-bottom:8px; border: ${isPreselected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:var(--text); display:block; margin-bottom:4px;">${r.w.full_name}</strong>
              ${!isPreselected && vacancy.id !== 'global' ? `<button onclick="window.starkShortlist('${vacancy.id}','${r.w.id}','${escapeHtml(r.w.full_name)}','AFK',${r.score})" class="btn btn--mini btn--primary" style="padding:4px 8px; font-size:10px;">+ PRESELECCIONAR</button>` : `<span style="font-size:9px; color:var(--accent); font-weight:bold;">[ EN PROCESO ]</span>`}
            </div>
            <span style="font-family:monospace; color:var(--accent); font-weight:900; font-size:16px;">${r.score}%</span>
          </div>
          <div class="affinity-bar" style="margin-top:10px;"><div class="affinity-fill" style="width:${r.score}%"></div></div>
          ${r.miss.length ? `<div style="font-size:9px; color:#f43f5e; margin-top:8px;">MISSING: ${r.miss.join(' | ')}</div>` : ''}
        </div>
      `}).join('');

      matchBodyCandidates.innerHTML = '<div style="padding:40px; text-align:center;">TRACKING EXTERNAL AGENTS...</div>';
      const iaRes = await fetch('/api/match-tender-candidates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ tender_id: vacancy.id, tender_name: vacancy.title, requirements: rs })
      });
      const iaData = await iaRes.json();
      const m = iaData.matches || [];
      
      matchBodyCandidates.innerHTML = shortlistHTML + (m.length ? m.map(c => {
        const isPreselected = shortlist.some(s => s.id === c.id);
        return `
        <div class="t-row stark-card" style="padding:15px; margin-bottom:8px; border: ${isPreselected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <div>
               <strong style="color:var(--text); display:block; margin-bottom:4px;">${c.nombre_completo}</strong>
               ${!isPreselected && vacancy.id !== 'global' ? `<button onclick="window.starkShortlist('${vacancy.id}','${c.id}','${escapeHtml(c.nombre_completo)}','IA EXTERNO',${c.ai_match_score.toFixed(1)})" class="btn btn--mini btn--primary" style="padding:4px 8px; font-size:10px;">+ PRESELECCIONAR</button>` : `<span style="font-size:9px; color:var(--accent); font-weight:bold;">[ EN PROCESO ]</span>`}
             </div>
             <span style="font-family:monospace; color:var(--accent); font-weight:900; font-size:16px;">${c.ai_match_score.toFixed(1)}%</span>
          </div>
          <div class="affinity-bar" style="margin-top:10px;"><div class="affinity-fill" style="width:${c.ai_match_score}%"></div></div>
          <p style="font-size:10px; color:var(--muted); line-height:1.4; margin-top:10px;">${c.evaluacion_general}</p>
        </div>
      `}).join('') : '<p style="padding:30px; text-align:center; color:var(--muted);">No se detectaron perfiles compatibles.</p>');

    } catch (e) { console.error(e); }
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

  const escapeHtml = (u) => (u||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const normalizeText = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
