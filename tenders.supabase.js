// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores (STARK COMPANY EDITION)
(function () {
  const $ = (s) => document.querySelector(s);
  
  // Elementos UI principales
  const tendersList = $('#tendersList');
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const tenderIdInput = $('#tenderId');
  const tenderNameInput = $('#tenderName');
  const tenderDescInput = $('#tenderDesc');
  const tendersBody = $('#tendersBody');
  const searchInput = $('#searchTender');

  // Elementos de Matchmaking y Tabs
  const tabWorkers = $('#tabWorkers');
  const tabCandidates = $('#tabCandidates');
  const matchBodyWorkers = $('#matchBodyWorkers') || $('#matchBody');
  const matchBodyCandidates = $('#matchBodyCandidates');
  const vacancySelector = $('#vacancySelector');

  // Elementos del Scanner IA (JARVIS)
  const pdfInput = $('#pdfInput');
  const uploadZone = $('#uploadZone');
  const scanningState = $('#scanningState');
  const intelPreview = $('#intelPreview');
  const intelReqs = $('#intelReqs');
  const scanLog = $('#scanLog');
  const intelDesc = $('#intelDesc');

  // Nuevos elementos Stark Company
  const vacanciesWrapper = $('#vacanciesWrapper');
  const vacanciesList = $('#vacanciesList');

  let allTenders = [];
  let detectedVacancies = [];

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
      // Reset scanner UI
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

  // Set up Tabs Matchmaking
  if (tabWorkers && tabCandidates) {
    tabWorkers.onclick = () => {
      tabWorkers.style.color = "var(--text)";
      tabWorkers.style.borderColor = "var(--primary)";
      tabCandidates.style.color = "var(--muted)";
      tabCandidates.style.borderColor = "transparent";
      if (matchBodyWorkers) matchBodyWorkers.style.display = "block";
      if (matchBodyCandidates) matchBodyCandidates.style.display = "none";
    };
    
    tabCandidates.onclick = () => {
      tabCandidates.style.color = "var(--text)";
      tabCandidates.style.borderColor = "var(--primary)";
      tabWorkers.style.color = "var(--muted)";
      tabWorkers.style.borderColor = "transparent";
      if (matchBodyWorkers) matchBodyWorkers.style.display = "none";
      if (matchBodyCandidates) matchBodyCandidates.style.display = "block";
    };
  }

  // --- LÓGICA DE DATOS (Tenders) ---

  async function loadTenders() {
    try {
      if (!window.supabase || typeof window.supabase.from !== 'function') {
        console.warn("Supabase client not ready, loadTenders deferred");
        setTimeout(loadTenders, 500);
        return;
      }

      if (tendersBody) {
        tendersBody.innerHTML = Array(3).fill(0).map(() => `
          <div class="t-row" style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="t-col-name"><div class="skeleton skeleton-text" style="width:150px"></div></div>
            <div class="t-col-desc"><div class="skeleton skeleton-text" style="width:100%"></div></div>
            <div class="t-col-reqs"><div class="skeleton skeleton-badge"></div></div>
          </div>
        `).join('');
      }

      const { data, error } = await window.supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      allTenders = data || [];
      renderTenders();
    } catch (err) {
      console.error('Error cargando licitaciones:', err);
      if (tendersBody) tendersBody.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">Error: ${err.message}</div>`;
    }
  }

  function renderTenders() {
    if (!tendersBody) return;
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const filteredTenders = allTenders.filter(t => {
      const nom = (t.name || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      return nom.includes(searchTerm) || desc.includes(searchTerm);
    });

    if (filteredTenders.length === 0) {
      tendersBody.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted);">${allTenders.length === 0 ? "No hay licitaciones." : "Sin resultados."}</div>`;
      return;
    }

    tendersBody.innerHTML = filteredTenders.map(t => `
      <div class="t-row stark-card" style="margin-bottom:8px; padding: 14px 18px; display:flex; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
        <div style="flex: 1;">
          <div style="font-weight: 700; color:var(--text); font-size:15px; margin-bottom:4px;">${escapeHtml(t.name)}</div>
          <div style="color: var(--muted); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
            ${escapeHtml(t.description || 'Sin descripción')}
          </div>
        </div>
        <div style="flex: 0 0 180px; display: flex; gap:6px; justify-content: flex-end;">
          <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">OPERATIVO</button>
          <button class="btn btn--mini btn-edit" data-id="${t.id}">✏️</button>
          <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:#f87171">🗑️</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = () => runMatchmaking(filteredTenders.find(x => x.id === btn.dataset.id)));
    document.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => editTender(filteredTenders.find(x => x.id === btn.dataset.id)));
    document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deleteTender(btn.dataset.id));
  }

  if (searchInput) searchInput.addEventListener('input', renderTenders);

  function escapeHtml(unsafe) {
    return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function normalizeText(text) {
    return (text || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  async function deleteTender(id) {
    if (!confirm('¿Eliminar licitación?')) return;
    const { error } = await window.supabase.from('tenders').delete().eq('id', id);
    if (error) window.notificar?.(error.message, 'error');
    else { window.notificar?.('Licitación eliminada'); loadTenders(); }
  }

  async function editTender(tender) {
    tenderIdInput.value = tender.id;
    tenderNameInput.value = tender.name;
    tenderDescInput.value = tender.description || '';
    reqContainer.innerHTML = '';
    
    // Cargar vacantes reales
    const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    detectedVacancies = vacs || [];
    renderDetectedVacancies();

    if (tender.requirements?.length) tender.requirements.forEach(r => addReqInput(r));
    else addReqInput();
    
    openModal(tenderModal);
  }

  if (tenderForm) {
    tenderForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = tenderIdInput.value;
        const name = tenderNameInput.value;
        const description = tenderDescInput.value;
        const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

        let res;
        if (id) {
          res = await window.supabase.from('tenders').update({ name, description, requirements: reqs }).eq('id', id).select();
        } else {
          res = await window.supabase.from('tenders').insert({ name, description, requirements: reqs }).select();
        }

        if (res.error) {
            window.notificar?.(res.error.message, 'error');
            return;
        }

        const tenderId = id || res.data[0].id;
        
        // Guardar Vacantes
        if (detectedVacancies.length > 0) {
            // Eliminar viejas si es edición
            if (id) await window.supabase.from('vacancies').delete().eq('tender_id', id);
            
            const toInsert = detectedVacancies.map(v => ({
                tender_id: tenderId,
                title: v.title,
                requirements: v.requirements,
                quantity: v.quantity || 1
            }));
            await window.supabase.from('vacancies').insert(toInsert);
        }

        window.notificar?.('Protocolo Stark: Datos Guardados');
        closeModal(tenderModal);
        loadTenders();
    };
  }

  // --- SCANNER IA (JARVIS) ---

  if (uploadZone && pdfInput) {
    uploadZone.onclick = () => pdfInput.click();
    pdfInput.onchange = (e) => { const file = e.target.files[0]; if (file) handleJarvisFile(file); };
  }

  async function handleJarvisFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return window.notificar?.("PDF Requerido", "warning");

    if (uploadZone) uploadZone.style.display = 'none';
    if (scanningState) scanningState.style.display = 'block';
    
    try {
      updateScanLog("Iniciando Transmisión de Datos...");
      const text = await extractTextFromPDF(file);
      updateScanLog("Decodificando Requisitos con JARVIS...");
      const aiData = await analyzeTenderDeepAI(text);
      
      if (intelDesc) intelDesc.value = aiData.description;
      renderScanPreview(aiData.vacancies || []);
      
      if (scanningState) scanningState.style.display = 'none';
      if (intelPreview) intelPreview.style.display = 'block';
    } catch (err) {
      window.notificar?.("Error JARVIS: " + err.message, "error");
      if (uploadZone) uploadZone.style.display = 'block';
      if (scanningState) scanningState.style.display = 'none';
    }
  }

  function renderScanPreview(vacancies) {
    if (!intelReqs) return;
    intelReqs.innerHTML = vacancies.map((v, vIdx) => `
      <div class="card stark-card" style="padding:12px; margin-bottom:8px;">
         <div style="font-size:13px; font-weight:800; color:var(--accent); display:flex; justify-content:space-between;">
            <span>${v.title}</span>
            <input type="checkbox" checked class="scan-v-check" data-vidx="${vIdx}">
         </div>
         <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">
            ${(v.requirements || []).map(r => `<span class="badge" style="font-size:10px">${r}</span>`).join('')}
         </div>
      </div>
    `).join('');
  }

  if ($('#btnImportIntel')) {
    $('#btnImportIntel').onclick = () => {
        // En lugar de meter todo a requirements de tender, llenamos detectedVacancies
        const selected = Array.from(document.querySelectorAll('.scan-v-check:checked')).map(chk => {
            const vIdx = chk.dataset.vidx;
            // Re-obtener los datos del preview (esto es simplificado, en un app real usaríamos el objeto original)
            const card = chk.closest('.stark-card');
            const title = card.querySelector('span').textContent;
            const requirements = Array.from(card.querySelectorAll('.badge')).map(b => b.textContent);
            return { title, requirements, quantity: 1 };
        });

        detectedVacancies = selected;
        renderDetectedVacancies();
        
        if (intelDesc && tenderDescInput) tenderDescInput.value = intelDesc.value;
        if (intelPreview) intelPreview.style.display = 'none';
        if (uploadZone) uploadZone.style.display = 'block';
        window.notificar?.("Importación completada");
    };
  }

  function renderDetectedVacancies() {
    if (!vacanciesList || !vacanciesWrapper) return;
    if (detectedVacancies.length === 0) {
        vacanciesWrapper.style.display = 'none';
        return;
    }
    vacanciesWrapper.style.display = 'block';
    vacanciesList.innerHTML = detectedVacancies.map((v, idx) => `
        <div class="stark-card" style="padding:10px; border-left: 3px solid var(--accent);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--text); font-size:13px;">${v.title}</strong>
                <button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="window.removeDetectedVacancy(${idx})">×</button>
            </div>
            <div style="font-size:11px; color:var(--muted); margin-top:4px;">${v.requirements.length} requerimientos detectados</div>
        </div>
    `).join('');
  }

  window.removeDetectedVacancy = (idx) => {
    detectedVacancies.splice(idx, 1);
    renderDetectedVacancies();
  };

  async function analyzeTenderDeepAI(text) {
     const WEBHOOK = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
     const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Extrae vacantes y requisitos: ${text.substring(0, 4000)}` })
     });
     const data = await res.json();
     let payload = Array.isArray(data) ? data[0] : data;
     let textResp = payload.output || payload.text || payload.reply || "";
     let finalData = { description: "", vacancies: [] };
     try {
       const start = textResp.indexOf('{');
       const end = textResp.lastIndexOf('}') + 1;
       finalData = JSON.parse(textResp.substring(start, end));
     } catch(e) { console.error("Parse fail", e); }
     return finalData;
  }

  async function extractTextFromPDF(file) {
    const reader = new FileReader();
    const arrayBuffer = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsArrayBuffer(file); });
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
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

  // --- MATCHMAKING STARK COMPANY ---

  async function runMatchmaking(tender) {
    if ($('#matchTitle')) $('#matchTitle').textContent = `OPERACIÓN: ${tender.name.toUpperCase()}`;
    openModal(matchModal);
    
    const { data: vacancies } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
    let activeVacs = vacancies?.length ? vacancies : [{ id: 'global', title: 'Global', requirements: tender.requirements || [] }];
    
    if (vacancySelector) {
        vacancySelector.innerHTML = activeVacs.map((v, i) => `<option value="${i}">${v.title}</option>`).join('');
        vacancySelector.onchange = () => evaluateVacancy(tender, activeVacs[vacancySelector.value]);
    }
    evaluateVacancy(tender, activeVacs[0]);
  }

  async function evaluateVacancy(tender, vacancy) {
    if (tabWorkers) tabWorkers.click();
    matchBodyWorkers.innerHTML = '<p style="padding:20px;">Escaneando biometría y registros...</p>';
    matchBodyCandidates.innerHTML = '<p style="padding:20px;">Lanzando satélites de búsqueda...</p>';
    
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
        <div class="t-row stark-card" style="padding: 16px; margin-bottom: 8px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <strong style="color:var(--text);">${r.worker.full_name}</strong>
              <div class="vacancy-pill" style="margin-top:2px;">${r.score === 100 ? '✓ APTO PARA OPERACIÓN' : '⚠ REVISIÓN REQUERIDA'}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:800; color:${r.score === 100 ? 'var(--ok)' : 'var(--accent)'}">${r.score}%</div>
            </div>
          </div>
          <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
          ${r.missing.length ? `<div style="font-size:10px; color:#f87171; margin-top:8px;">Falta: ${r.missing.join(', ')}</div>` : ''}
        </div>
      `).join('');

      // IA Match
      const iaResp = await fetch('/api/match-tender-candidates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ tender_id: vacancy.id, tender_name: vacancy.title, requirements: reqs })
      });
      const iaData = await iaResp.json();
      const cands = iaData.matches || [];
      matchBodyCandidates.innerHTML = cands.length ? cands.map(c => `
        <div class="t-row stark-card" style="padding: 16px; margin-bottom: 8px;">
           <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--text);">${c.nombre_completo}</strong>
              <div style="font-weight:800; color:var(--accent);">${c.ai_match_score.toFixed(1)}%</div>
           </div>
           <div class="affinity-bar"><div class="affinity-fill" style="width:${c.ai_match_score}%"></div></div>
           <p style="font-size:11px; margin-top:10px; color:var(--muted); line-height:1.4;">${c.evaluacion_general}</p>
        </div>
      `).join('') : '<p style="padding:40px; color:var(--muted); text-align:center;">Ningún perfil externo supera el umbral.</p>';

    } catch(e) { console.error(e); }
  }

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
