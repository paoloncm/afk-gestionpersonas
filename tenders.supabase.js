// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores (STARK COMPANY V2)
(function () {
  const $ = (s) => document.querySelector(s);
  
  // Elementos UI principales
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const tenderIdInput = $('#tenderId');
  const tenderNameInput = $('#tenderName');
  const tenderDescInput = $('#tenderDesc');
  const tendersBody = $('#tendersBody');
  const searchInput = $('#searchTender');

  const tabWorkers = $('#tabWorkers');
  const tabCandidates = $('#tabCandidates');
  const matchBodyWorkers = $('#matchBodyWorkers');
  const matchBodyCandidates = $('#matchBodyCandidates');
  const vacancySelector = $('#vacancySelector');

  const pdfInput = $('#pdfInput');
  const uploadZone = $('#uploadZone');
  const scanningState = $('#scanningState');
  const intelPreview = $('#intelPreview');
  const intelReqs = $('#intelReqs');
  const scanLog = $('#scanLog');
  const intelDesc = $('#intelDesc');

  const vacanciesWrapper = $('#vacanciesWrapper');
  const vacanciesList = $('#vacanciesList');

  let allTenders = [];
  let detectedVacancies = [];
  let currentScanVacancies = [];

  // --- NAVEGACIÓN Y MODALES ---

  function openModal(m) { if(m) m.classList.add('is-open'); }
  function closeModal(m) { if(m) m.classList.remove('is-open'); }

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { closeModal(tenderModal); closeModal(matchModal); };
  });

  const btnNewTender = $('#btnNewTender');
  if (btnNewTender) {
    btnNewTender.onclick = () => {
      tenderIdInput.value = '';
      tenderForm.reset();
      reqContainer.innerHTML = '';
      detectedVacancies = [];
      if (vacanciesWrapper) vacanciesWrapper.style.display = 'none';
      addReqInput();
      if (uploadZone) uploadZone.style.display = 'block';
      if (scanningState) scanningState.style.display = 'none';
      if (intelPreview) intelPreview.style.display = 'none';
      openModal(tenderModal);
    };
  }

  const btnAddReq = $('#btnAddReq');
  if (btnAddReq) btnAddReq.onclick = () => addReqInput();

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.className = 'grid-2';
    div.style.gap = '8px';
    div.innerHTML = `
      <input class="input req-input" value="${val}" placeholder="Ej: Altura Física" required>
      <button type="button" class="btn btn--mini btn-del-req" style="color:#f87171">X</button>
    `;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    if (reqContainer) reqContainer.appendChild(div);
  }

  if (tabWorkers && tabCandidates) {
    tabWorkers.onclick = () => {
      tabWorkers.style.color = "var(--accent)";
      tabWorkers.style.borderColor = "var(--accent)";
      tabCandidates.style.color = "var(--muted)";
      tabCandidates.style.borderColor = "transparent";
      if (matchBodyWorkers) matchBodyWorkers.style.display = "block";
      if (matchBodyCandidates) matchBodyCandidates.style.display = "none";
    };
    tabCandidates.onclick = () => {
      tabCandidates.style.color = "var(--accent)";
      tabCandidates.style.borderColor = "var(--accent)";
      tabWorkers.style.color = "var(--muted)";
      tabWorkers.style.borderColor = "transparent";
      if (matchBodyWorkers) matchBodyWorkers.style.display = "none";
      if (matchBodyCandidates) matchBodyCandidates.style.display = "block";
    };
  }

  // --- LÓGICA DE DATOS ---

  async function loadTenders() {
    try {
      if (!window.supabase || typeof window.supabase.from !== 'function') {
        console.warn("[Stark] Supabase not ready, retrying...");
        setTimeout(loadTenders, 500); return;
      }
      if (tendersBody) tendersBody.innerHTML = '<div style="padding:40px; text-align:center;">Sincronizando con Base de Datos...</div>';
      
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allTenders = data || [];
      renderTenders();
    } catch (err) {
      console.error('[Stark] Error loadTenders:', err);
    }
  }

  function renderTenders() {
    if (!tendersBody) return;
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = allTenders.filter(t => (t.name||"").toLowerCase().includes(searchTerm) || (t.description||"").toLowerCase().includes(searchTerm));

    tendersBody.innerHTML = filtered.map(t => `
      <div class="t-row stark-card" style="margin-bottom:8px; padding: 15px 20px; display:flex; align-items: center; border: 1px solid rgba(255,255,255,0.05); cursor:pointer;">
        <div style="flex: 1;" onclick="window.editTenderById('${t.id}')">
          <div style="font-weight: 800; color:var(--text); font-size:16px; letter-spacing:0.5px;">${escapeHtml(t.name)}</div>
          <div style="color: var(--muted); font-size: 12px; margin-top:4px;">${escapeHtml(t.description || 'Sin descripción')}</div>
        </div>
        <div style="flex: 0 0 180px; display: flex; gap:10px; justify-content: flex-end;">
          <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}" style="font-weight:800; border:1px solid var(--accent);">[ OPERATIVO ]</button>
          <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:var(--danger)">🗑️</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); runMatchmaking(filtered.find(x => x.id === btn.dataset.id)); });
    document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteTender(btn.dataset.id); });
  }

  window.editTenderById = (id) => {
    const t = allTenders.find(x => x.id === id);
    if (t) editTender(t);
  };

  async function deleteTender(id) {
    if (!confirm('¿Eliminar licitación?')) return;
    await window.supabase.from('tenders').delete().eq('id', id);
    loadTenders();
  }

  async function editTender(tender) {
    tenderIdInput.value = tender.id;
    tenderNameInput.value = tender.name;
    tenderDescInput.value = tender.description || '';
    reqContainer.innerHTML = '';
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    detectedVacancies = vacs || [];
    renderDetectedVacancies();
    (tender.requirements || []).forEach(r => addReqInput(r));
    if (!tender.requirements?.length) addReqInput();
    openModal(tenderModal);
  }

  if (tenderForm) {
    tenderForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = tenderIdInput.value;
        const name = tenderNameInput.value;
        const description = tenderDescInput.value;
        const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

        console.log("[Stark] Guardando Licitación Principal...");
        let res;
        if (id) {
          res = await window.supabase.from('tenders').update({ name, description, requirements: reqs }).eq('id', id).select();
        } else {
          res = await window.supabase.from('tenders').insert({ name, description, requirements: reqs }).select();
        }

        const tenderId = id || (res.data ? res.data[0].id : null);
        if (!tenderId) return window.notificar?.("Error guardando cabecera", "error");

        if (detectedVacancies.length > 0) {
            console.log("[Stark] Sincronizando Vacantes Jerárquicas...", detectedVacancies);
            if (id) await window.supabase.from('vacancies').delete().eq('tender_id', id);
            const toInsert = detectedVacancies.map(v => ({
                tender_id: tenderId,
                title: v.title,
                requirements: v.requirements,
                quantity: v.quantity || 1
            }));
            await window.supabase.from('vacancies').insert(toInsert);
        }

        window.notificar?.('Protocolo Completado');
        closeModal(tenderModal);
        loadTenders();
    };
  }

  // --- SCANNER IA ---

  if (uploadZone && pdfInput) {
    uploadZone.onclick = () => pdfInput.click();
    ['dragenter', 'dragover'].forEach(ev => uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent)'; }));
    ['dragleave', 'drop'].forEach(ev => uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.style.borderColor = 'rgba(34,211,238,0.3)'; }));
    uploadZone.addEventListener('drop', e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleJarvisFile(file); });
    pdfInput.onchange = (e) => { const file = e.target.files[0]; if (file) handleJarvisFile(file); };
  }

  async function handleJarvisFile(file) {
    if (uploadZone) uploadZone.style.display = 'none';
    if (scanningState) scanningState.style.display = 'block';
    if (intelPreview) intelPreview.style.display = 'none';
    try {
      updateScanLog("Inyectando Protocolo de Extracción...");
      const text = await extractTextFromPDF(file);
      if (!text.trim()) throw new Error("Documento sin texto legible (OCR requerido).");
      
      updateScanLog("Consultando Matriz Operativa JARVIS...");
      const aiData = await analyzeTenderDeepAI(text);
      
      currentScanVacancies = aiData.vacancies || [];
      if (intelDesc) intelDesc.value = aiData.description;
      renderScanPreview(currentScanVacancies);
      
      if (scanningState) scanningState.style.display = 'none';
      if (intelPreview) intelPreview.style.display = 'block';
    } catch (err) {
      window.notificar?.(err.message, "error");
      if (uploadZone) uploadZone.style.display = 'block';
      if (scanningState) scanningState.style.display = 'none';
    }
  }

  async function analyzeTenderDeepAI(text) {
     const WEBHOOK = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
     const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Analizar licitación y extraer vacantes (JSON): ${text.substring(0, 4500)}` })
     });
     const data = await res.json();
     let payload = Array.isArray(data) ? data[0] : data;
     let textResp = payload.output || payload.text || payload.reply || "";
     let finalData = { description: "", vacancies: [] };
     try {
       const start = textResp.indexOf('{');
       const end = textResp.lastIndexOf('}') + 1;
       finalData = JSON.parse(textResp.substring(start, end));
     } catch(e) { console.error("[Scanner] Parse fail", e); }
     
     if (!finalData.vacancies?.length) {
        finalData.vacancies = [{ title: "Perfil Base Detectado", requirements: ["Cumplimiento de bases"] }];
     }
     return finalData;
  }

  function renderScanPreview(vacs) {
    if (!intelReqs) return;
    intelReqs.innerHTML = vacs.map((v, i) => `
      <div class="stark-card" style="padding:15px; margin-bottom:10px; border-left: 2px solid var(--accent);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--accent); font-size:14px;">${v.title}</strong>
          <input type="checkbox" checked class="scan-v-check" data-vidx="${i}">
        </div>
        <div style="font-size:11px; margin-top:8px; color:var(--muted);">${v.requirements.join(' • ')}</div>
      </div>
    `).join('');
  }

  if ($('#btnImportIntel')) {
    $('#btnImportIntel').onclick = () => {
      const selected = Array.from(document.querySelectorAll('.scan-v-check:checked')).map(chk => currentScanVacancies[parseInt(chk.dataset.vidx)]).filter(v => v);
      detectedVacancies = [...detectedVacancies, ...selected];
      renderDetectedVacancies();
      if (intelDesc && tenderDescInput) tenderDescInput.value = intelDesc.value;
      if (intelPreview) intelPreview.style.display = 'none';
      if (uploadZone) uploadZone.style.display = 'block';
      window.notificar?.("Datos Importados");
    };
  }

  function renderDetectedVacancies() {
    if (!vacanciesList) return;
    vacanciesWrapper.style.display = detectedVacancies.length ? 'block' : 'none';
    vacanciesList.innerHTML = detectedVacancies.map((v, idx) => `
        <div class="stark-card" style="padding:12px; margin-bottom:8px; border: 1px solid rgba(34,211,238,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="vacancy-pill">${v.title}</span>
                <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer;" onclick="window.removeV(${idx})">×</button>
            </div>
            <div style="font-size:10px; color:var(--muted); margin-top:5px;">Reqs: ${v.requirements.length}</div>
        </div>
    `).join('');
  }

  window.removeV = (idx) => { detectedVacancies.splice(idx, 1); renderDetectedVacancies(); };

  async function extractTextFromPDF(file) {
    const reader = new FileReader();
    const arrayBuffer = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsArrayBuffer(file); });
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
    let fullText = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
       const page = await pdf.getPage(i);
       const content = await page.getTextContent();
       fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText;
  }

  function updateScanLog(msg) { if (scanLog) scanLog.textContent = `> ${msg}`; }

  // --- MATCHMAKING HUD ---

  async function runMatchmaking(tender) {
    if ($('#matchTitle')) $('#matchTitle').textContent = `OP: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    const { data: vacancies } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let activeVacs = vacancies?.length ? vacancies : [{ id: 'global', title: 'PERFIL GLOBAL', requirements: tender.requirements || [] }];
    if (vacancySelector) {
        vacancySelector.style.background = "rgba(0,0,0,0.8)";
        vacancySelector.style.border = "2px solid var(--accent)";
        vacancySelector.style.color = "var(--accent)";
        vacancySelector.style.fontWeight = "800";
        vacancySelector.innerHTML = activeVacs.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
        vacancySelector.onchange = () => evaluateVacancy(tender, activeVacs[vacancySelector.value]);
    }
    evaluateVacancy(tender, activeVacs[0]);
  }

  async function evaluateVacancy(tender, vacancy) {
    if (tabWorkers) tabWorkers.click();
    matchBodyWorkers.innerHTML = '<div style="padding:40px; text-align:center;"><div class="loader" style="margin:0 auto 15px;"></div>INICIANDO ESCANEO DE PERSONAL...</div>';
    matchBodyCandidates.innerHTML = '<div style="padding:40px; text-align:center;"><div class="loader" style="margin:0 auto 15px;"></div>CONECTANDO CON SATÉLITE IA...</div>';
    
    const reqs = vacancy.requirements || [];
    try {
      const { data: workers } = await window.supabase.from('workers').select('*');
      const { data: creds } = await window.supabase.from('worker_credentials').select('*');
      
      const results = (workers || []).map(w => {
        const myDocs = (creds || []).filter(c => c.worker_id === w.id);
        const missing = reqs.filter(r => !myDocs.some(d => normalizeText(d.credential_name).includes(normalizeText(r))));
        const score = reqs.length ? Math.round(((reqs.length - missing.length) / reqs.length) * 100) : 0;
        return { worker: w, score, missing };
      }).sort((a, b) => b.score - a.score);

      matchBodyWorkers.innerHTML = results.map(r => `
        <div class="t-row stark-card" style="padding: 18px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <strong style="color:var(--text); font-size:15px;">${r.worker.full_name}</strong>
              <div class="vacancy-pill" style="margin-top:4px; font-size:9px;">ESTADO: ${r.score === 100 ? '✓ APTO' : '⚠ EN EVALUACIÓN'}</div>
            </div>
            <div style="font-weight:900; font-size:18px; color:var(--accent); font-family:monospace;">${r.score}%</div>
          </div>
          <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%; box-shadow: 0 0 10px var(--accent);"></div></div>
          ${r.missing.length ? `<div style="font-size:10px; color:#f43f5e; margin-top:10px; font-weight:700;">⚠ FALTAN: ${r.missing.join(' • ')}</div>` : ''}
        </div>
      `).join('');

      const iaResp = await fetch('/api/match-tender-candidates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ tender_id: vacancy.id, tender_name: vacancy.title, requirements: reqs })
      });
      const iaData = await iaResp.json();
      const cands = iaData.matches || [];
      matchBodyCandidates.innerHTML = cands.length ? cands.map(c => `
        <div class="t-row stark-card" style="padding: 18px; margin-bottom: 10px;">
           <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--text);">${c.nombre_completo}</strong>
              <div style="font-weight:900; color:var(--accent);">${c.ai_match_score.toFixed(1)}%</div>
           </div>
           <div class="affinity-bar"><div class="affinity-fill" style="width:${c.ai_match_score}%"></div></div>
           <p style="font-size:11px; margin-top:12px; color:var(--muted); line-height:1.6;">${c.evaluacion_general}</p>
        </div>
      `).join('') : '<p style="padding:40px; color:var(--muted); text-align:center;">Ningún perfil externo supera el umbral táctico.</p>';
    } catch(e) { console.error(e); }
  }

  function escapeHtml(u) { return (u||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function normalizeText(t) { return (t||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
