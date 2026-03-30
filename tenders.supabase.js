// tenders.supabase.js - Lógica Stark Intelligence V3: Reconstrucción Total
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

  // --- DASHBOARD TACTICAL VIEW ---

  async function loadTenders() {
    try {
      if (!window.supabase || typeof window.supabase.from !== 'function') {
        process.stdout.write("[Stark] DB Link logic failed, retrying...");
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
    
    // Carga de vacantes
    detectedVacancies = [];
    window.supabase.from('vacancies').select('*').eq('tender_id', t.id).then(({data}) => {
        detectedVacancies = data || [];
        renderDetectedVacancies();
    });
    
    openModal(tenderModal);
  };

  async function deleteTender(id) {
    if (!confirm('¿DESACTIVAR PROYECTO?')) return;
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
      $('#scanningState').style.display = 'none';
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
            message: `EXTRAE VACANTES Y REQUISITOS (ESTRICTO JSON):
            1. Resumen breve (max 300 chars).
            2. Lista de vacantes, cucha una con "title" y array de "requirements".
            
            FORMATO: {"description": "...", "vacancies": [{"title": "...", "requirements": ["..."]}]}
            TEXTO: ${text.substring(0, 4800)}` 
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
      <div class="stark-card" style="padding:10px; margin-bottom:8px; border-left: 2px solid var(--accent); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="vacancy-pill" style="font-size:9px;">${v.title}</div>
          <div style="font-size:9px; color:var(--muted); margin-top:4px;">REQ_COUNT: ${v.requirements.length}</div>
        </div>
        <button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="window.remV(${i})">×</button>
      </div>
    `).join('');
  }
  window.remV = (i) => { detectedVacancies.splice(i, 1); renderDetectedVacancies(); };

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = $('#tenderId').value;
    const name = $('#tenderName').value;
    const desc = $('#tenderDesc').value;
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

    const { data: tRes, error } = id ? 
        await window.supabase.from('tenders').update({ name, description: desc, requirements: reqs }).eq('id', id).select() :
        await window.supabase.from('tenders').insert({ name, description: desc, requirements: reqs }).select();

    if (error) return window.notificar?.(error.message, "error");
    const tId = id || (tRes && tRes[0] ? tRes[0].id : null);

    if (detectedVacancies.length && tId) {
        if (id) await window.supabase.from('vacancies').delete().eq('tender_id', id);
        const vacData = detectedVacancies.map(v => ({ tender_id: tId, title: v.title, requirements: v.requirements }));
        await window.supabase.from('vacancies').insert(vacData);
    }
    
    window.notificar?.("SISTEMA ACTUALIZADO");
    closeModal(tenderModal);
    loadTenders();
  };

  // --- MATCHMAKING HUD V3 ---

  async function runMatchmaking(tender) {
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    
    matchBodyWorkers.innerHTML = '<div style="padding:40px; text-align:center;">SINTONIZANDO SEÑAL BIOMÉTRICA...</div>';
    
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let active = vacs?.length ? vacs : [{ id: 'global', title: 'OPERACIÓN GLOBAL', requirements: tender.requirements || [] }];
    
    vacancySelector.innerHTML = active.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
    vacancySelector.onchange = () => evaluate(tender, active[vacancySelector.value]);
    evaluate(tender, active[0]);
  }

  async function evaluate(tender, vacancy) {
    if (tabWorkers) tabWorkers.click();
    const rs = vacancy.requirements || [];
    
    try {
      const { data: ws } = await window.supabase.from('workers').select('*');
      const { data: cs } = await window.supabase.from('worker_credentials').select('*');
      
      const scored = (ws || []).map(w => {
        const wCs = (cs || []).filter(c => c.worker_id === w.id);
        const miss = rs.filter(r => !wCs.some(c => normalizeText(c.credential_name).includes(normalizeText(r))));
        const score = rs.length ? Math.round(((rs.length - miss.length) / rs.length) * 100) : 0;
        return { w, score, miss };
      }).sort((a,b) => b.score - a.score);

      matchBodyWorkers.innerHTML = scored.map(r => `
        <div class="t-row stark-card" style="padding:15px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between;">
            <strong style="color:var(--text);">${r.w.full_name}</strong>
            <span style="font-family:monospace; color:var(--accent); font-weight:900;">${r.score}%</span>
          </div>
          <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
          ${r.miss.length ? `<div style="font-size:9px; color:#f43f5e; margin-top:8px;">MISSING: ${r.miss.join(' | ')}</div>` : ''}
        </div>
      `).join('');

      // IA CANDIDATES
      matchBodyCandidates.innerHTML = '<div style="padding:40px; text-align:center;">TRACKING EXTERNAL AGENTS...</div>';
      const iaRes = await fetch('/api/match-tender-candidates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ tender_id: vacancy.id, tender_name: vacancy.title, requirements: rs })
      });
      const iaData = await iaRes.json();
      const m = iaData.matches || [];
      matchBodyCandidates.innerHTML = m.length ? m.map(c => `
        <div class="t-row stark-card" style="padding:15px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <strong>${c.nombre_completo}</strong>
             <span style="color:var(--accent); font-weight:900;">${c.ai_match_score.toFixed(1)}%</span>
          </div>
          <div class="affinity-bar"><div class="affinity-fill" style="width:${c.ai_match_score}%"></div></div>
          <p style="font-size:10px; color:var(--muted); line-height:1.4; margin-top:10px;">${c.evaluacion_general}</p>
        </div>
      `).join('') : '<p style="padding:30px; text-align:center; color:var(--muted);">No se detectaron perfiles compatibles.</p>';

    } catch (e) { console.error(e); }
  }

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.className = 'grid-2'; div.style.gap = '8px';
    div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required><button type="button" class="btn btn--mini btn-del-req" style="color:var(--danger)">×</button>`;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    reqContainer.appendChild(div);
  }

  async function extractTextFromPDF(file) {
    const reader = new FileReader();
    const ab = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsArrayBuffer(file); });
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

  const escapeHtml = (u) => (u||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const normalizeText = (t) => (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
