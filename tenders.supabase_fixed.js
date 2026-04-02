// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores (Protocolo Stark v7.5)

(function () {
  const $ = (s) => document.querySelector(s);
  const tendersList = $('#tendersList');
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const matchBody = $('#matchBody');
  const tenderIdInput = $('#tenderId');
  const tenderNameInput = $('#tenderName');
  const tenderDescInput = $('#tenderDesc');

  function normalizeText(text) {
    if (!text) return '';
    return text.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  // --- GESTIÓN DE INTERFAZ (RESTORED) ---
  function openModal(m) { if (m) m.classList.add('is-open'); }
  function closeModal(m) { if (m) m.classList.remove('is-open'); }

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { 
      closeModal(tenderModal); 
      closeModal(matchModal); 
      closeModal($('#smartModal')); 
    };
  });

  $('#btnNewTender').onclick = () => {
    tenderIdInput.value = '';
    tenderForm.reset();
    reqContainer.innerHTML = '';
    addReqInput();
    openModal(tenderModal);
  };

  $('#btnAddReq').onclick = () => addReqInput();

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.className = 'grid-2';
    div.style.gap = '8px';
    div.style.marginBottom = '8px';
    div.innerHTML = `
      <input class="input req-input" value="${val}" placeholder="Ej: Altura Física" required>
      <button type="button" class="btn btn--mini btn-del-req" style="color:#f87171">X</button>
    `;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    reqContainer.appendChild(div);
  }

  const tendersBody = $('#tendersBody');
  const searchInput = $('#searchTender');
  let allTenders = [];

  // --- JARVIS INTELLIGENCE (AI & OCR) ---
  const smartModal = $('#smartModal');
  const pdfInput = $('#pdfInput');
  const uploadZone = $('#uploadZone');
  const scanningState = $('#scanningState');
  const intelPreview = $('#intelPreview');
  const intelReqs = $('#intelReqs');
  const scanLog = $('#scanLog');

  let extractedText = "";

  if ($('#btnSmartTender')) {
    $('#btnSmartTender').onclick = () => openModal(smartModal);
  }

  if (uploadZone) {
    uploadZone.onclick = () => pdfInput.click();
  }

  if (pdfInput) {
    pdfInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      uploadZone.style.display = 'none';
      scanningState.style.display = 'block';
      intelPreview.style.display = 'none';

      try {
        updateScanLog("JARVIS Core v7.5: Iniciando Protocolo de Análisis...");
        await new Promise(r => setTimeout(r, 600));
        
        const text = await extractTextFromPDF(file);
        extractedText = text;
        
        updateScanLog("[Protocolo Stark] Fase 1: Escaneo Estructural...");
        await new Promise(r => setTimeout(r, 1000));
        
        updateScanLog("[Protocolo Stark] Fase 2: Análisis Semántico...");
        const aiReqs = await analyzeTenderDeepAI(text);
        
        renderDetectedReqs(aiReqs);
        
        scanningState.style.display = 'none';
        intelPreview.style.display = 'block';
        updateScanLog("Análisis Estratégico Completado.");
      } catch (err) {
        console.error(err);
        window.notificar?.("Error en JARVIS Engine: " + err.message, "error");
        uploadZone.style.display = 'block';
        scanningState.style.display = 'none';
      }
    };
  }

  async function analyzeTenderDeepAI(text) {
     const WEBHOOK = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
     try {
        const res = await fetch(WEBHOOK, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              message: `Analiza esta licitación y extrae requisitos de personal. Responde solo con nombres separados por comas. Texto: ${text.substring(0, 3000)}`,
              meta: { task: "tender_extraction", context: "Industrias Stark" }
           })
        });
        const data = await res.json();
        let raw = Array.isArray(data) ? (data[0]?.output || data[0]?.text || "") : (data.output || data.text || data.reply || "");
        if (raw && raw.length > 5) {
           return raw.split(',').map(s => ({ label: s.trim().replace(/^[^a-zA-ZáéíóúÁÉÍÓÚ]+/, ''), id: s.trim().toLowerCase() }));
        }
     } catch (e) {
        updateScanLog("Enlace n8n offline. Activando Algoritmos Heurísticos Stark...");
     }
     return detectRequirementsHeuristic(text);
  }

  async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
       updateScanLog(`Analizando página ${i} de ${pdf.numPages}...`);
       const page = await pdf.getPage(i);
       const content = await page.getTextContent();
       fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText;
  }

  function updateScanLog(msg) { if (scanLog) scanLog.textContent = `> ${msg}`; }

  function detectRequirementsHeuristic(text) {
    const clean = normalizeText(text);
    const catalog = [
      { id: 'altura', label: 'Altura Física (>1.8m)', keywords: ['altura', 'desnivel', 'caida', '1.80'] },
      { id: 'psico', label: 'Psicosensométrico Riguroso', keywords: ['psico', 'sensometrico', 'conductores', 'vifp'] },
      { id: 'lic_b', label: 'Licencia Clase B', keywords: ['licencia', 'clase b', 'vehiculo liviano'] },
      { id: 'lic_a2', label: 'Licencia Profesional A2', keywords: ['clase a2', 'ambulancia', 'transporte'] },
      { id: 'confinado', label: 'Espacios Confinados', keywords: ['confinado', 'silice', 'tunel'] },
      { id: 'ruido', label: 'Protocolo Prexor (Ruido)', keywords: ['ruido', 'auditivo', 'prexor'] },
      { id: 'fuego', label: 'Combate Incendios (OS10)', keywords: ['fuego', 'incendio', 'os10'] },
      { id: 'primeros_aux', label: 'Primeros Auxilios', keywords: ['auxilios', 'reanimacion', 'rcp'] }
    ];
    return catalog.filter(c => c.keywords.some(k => clean.includes(k)));
  }

  function renderDetectedReqs(reqs) {
    intelReqs.innerHTML = reqs.map(r => `
      <div class="card" style="padding:10px; border:1px solid rgba(34,211,238,0.2); background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;">
         <span style="font-size:12px; font-weight:600;">${r.label}</span>
         <input type="checkbox" checked class="intel-check" data-label="${r.label}">
      </div>
    `).join('');
  }

  if ($('#btnImportIntel')) {
    $('#btnImportIntel').onclick = () => {
      const selected = Array.from(document.querySelectorAll('.intel-check:checked')).map(i => i.dataset.label);
      tenderIdInput.value = '';
      tenderForm.reset();
      tenderNameInput.value = "Licitación Detectada " + new Date().toLocaleDateString();
      reqContainer.innerHTML = '';
      selected.forEach(r => addReqInput(r));
      closeModal(smartModal);
      openModal(tenderModal);
      window.notificar?.(`Importados ${selected.length} requisitos de IA`, "success");
    };
  }

  // --- LÓGICA DE BASE DE DATOS (RESTORED) ---
  async function loadTenders() {
    try {
      if (tendersBody) {
        tendersBody.innerHTML = '<div style="padding: 40px; text-align: center;">Cargando...</div>';
      }
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allTenders = data || [];
      renderTenders();
    } catch (err) {
      console.error(err);
      if (tendersBody) tendersBody.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  function renderTenders() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = allTenders.filter(t => (t.name+t.description+(t.requirements||[]).join(" ")).toLowerCase().includes(searchTerm));

    if (!filtered.length) {
      tendersBody.innerHTML = '<div style="padding: 40px; text-align: center;">No hay registros.</div>';
      return;
    }

    tendersBody.innerHTML = filtered.map(t => `
      <div class="t-row" style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: start;">
        <div class="t-col-name" style="font-weight: 600;">${escapeHtml(t.name)}</div>
        <div class="t-col-desc" style="color: var(--muted); font-size: 13px; max-width: 300px;">${escapeHtml(t.description)}</div>
        <div class="t-col-reqs" style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${(t.requirements || []).slice(0, 3).map(r => `<span class="badge" style="background:rgba(255,255,255,0.1)">${escapeHtml(r)}</span>`).join('')}
        </div>
        <div class="t-col-actions" style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
          <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">Evaluar</button>
          <button class="btn btn--mini btn-edit" data-id="${t.id}">✏️</button>
          <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:#f87171">🗑️</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = () => runMatchmaking(filtered.find(x => x.id === btn.dataset.id)));
    document.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => editTender(filtered.find(x => x.id === btn.dataset.id)));
    document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deleteTender(btn.dataset.id));
  }

  function escapeHtml(u) { return (u||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); }

  async function deleteTender(id) {
    if (!confirm('¿Eliminar licitación?')) return;
    const { error } = await window.supabase.from('tenders').delete().eq('id', id);
    if (error) window.notificar?.(error.message, 'error');
    else loadTenders();
  }

  function editTender(tender) {
    tenderIdInput.value = tender.id;
    tenderNameInput.value = tender.name;
    tenderDescInput.value = tender.description || '';
    reqContainer.innerHTML = '';
    (tender.requirements || []).forEach(r => addReqInput(r));
    if (!(tender.requirements||[]).length) addReqInput();
    openModal(tenderModal);
  }

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = tenderIdInput.value;
    const name = tenderNameInput.value;
    const description = tenderDescInput.value;
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);
    let res = id ? await window.supabase.from('tenders').update({ name, description, requirements: reqs }).eq('id', id)
                  : await window.supabase.from('tenders').insert({ name, description, requirements: reqs });
    if (res.error) window.notificar?.(res.error.message, 'error');
    else { window.notificar?.('Éxito', 'success'); closeModal(tenderModal); loadTenders(); }
  };

  // --- LÓGICA DE MATCHMAKING (RESTORED & ENHANCED) ---
  let currentSource = 'workers';
  $('#btnMatchWorkers').onclick = () => { currentSource = 'workers'; $('#btnMatchWorkers').classList.add('is-active'); $('#btnMatchCandidates').classList.remove('is-active'); runMatchmaking(window.lastTender); };
  $('#btnMatchCandidates').onclick = () => { currentSource = 'candidates'; $('#btnMatchCandidates').classList.add('is-active'); $('#btnMatchWorkers').classList.remove('is-active'); runMatchmaking(window.lastTender); };

  async function runMatchmaking(tender) {
    if (!tender) return;
    window.lastTender = tender;
    $('#matchTitle').textContent = `Matchmaking JARVIS: ${tender.name}`;
    matchBody.innerHTML = '<div style="padding:20px">Iniciando escaneo...</div>';
    openModal(matchModal);
    try {
      if (currentSource === 'workers') await matchWorkers(tender);
      else await matchCandidates(tender);
    } catch (e) { matchBody.innerHTML = `<p class="error">${e.message}</p>`; }
  }

  async function matchWorkers(tender) {
    const { data: ws } = await window.supabase.from('workers').select('*');
    const { data: cs } = await window.supabase.from('worker_credentials').select('*');
    const { data: ex } = await window.supabase.from('medical_exam_records').select('*');
    const norm = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

    const results = ws.map(w => {
      const docs = [...(cs||[]).filter(c => c.worker_id === w.id || norm(c.rut) === norm(w.rut)), ...(ex||[]).filter(e => norm(e.rut) === norm(w.rut))];
      const missing = tender.requirements.filter(req => !docs.some(d => (normalizeText(d.credential_name)+normalizeText(d.exam_type)).includes(normalizeText(req))));
      return { name: w.full_name, id: w.rut, detail: w.company_name, missing };
    }).sort((a,b) => a.missing.length - b.missing.length);
    renderMatchResults(results);
  }

  async function matchCandidates(tender) {
    const { data: cand } = await window.supabase.from('candidates').select('*');
    const results = (cand||[]).map(c => {
       const skills = normalizeText((c.profesion || "") + " " + (c.experiencia_especifica || ""));
       const missing = tender.requirements.filter(req => !skills.includes(normalizeText(req)));
       const score = Math.round(100 - (missing.length * (100 / (tender.requirements.length || 1))));
       return { name: c.nombre_completo, id: c.profesion || 'Candidato', detail: `Calce IA: ${score}%`, missing, isCandidate:true, score };
    }).sort((a,b) => b.score - a.score);
    renderMatchResults(results);
  }

  function renderMatchResults(res) {
    matchBody.innerHTML = res.slice(0, 15).map(r => `
      <div class="t-row">
        <div class="t-col-name"><strong>${escapeHtml(r.name)}</strong><br><small>${escapeHtml(r.id)}</small></div>
        <div class="t-col-prof">${r.missing.length === 0 ? '🟢 CALCE ALTO' : '🔴 NO APTO'}</div>
        <div class="t-col-status">${r.missing.length ? 'Falta: '+r.missing.join(', ') : '✓ Perfil Compatible'}</div>
        <div class="t-col-actions">${r.isCandidate ? '<button class="btn btn--mini">Ver CV</button>' : ''}</div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
