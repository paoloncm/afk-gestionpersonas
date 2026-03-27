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

  // --- PROTOCOLO STARK: NORMALIZACIÓN Y TOKENIZACIÓN DE ALTA PRECISIÓN ---
  const starkNormalize = (text) => {
    if (!text) return [];
    const stopwords = ["de", "en", "contra", "la", "el", "del", "con", "y", "a", "o", "un", "una", "para", "los", "las"];
    
    // Normalización Agresiva (Tildes, Caracteres Especiales, Minúsculas)
    let clean = text.toString().toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
      .replace(/[^a-z0-9\s]/g, " "); // Solo letras, números y espacios
    
    return clean.split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.includes(word))
      .map(word => {
        // Lógica de Plurales Refinada
        let w = word;
        if (w.endsWith("es")) w = w.slice(0, -2);
        else if (w.endsWith("s")) w = w.slice(0, -1);
        
        // Stark Synonym Map (Relaciones de alto nivel)
        const synonyms = {
          "electronico": "electrico",
          "fuego": "incendio",
          "prevencion": "seguridad",
          "prevencionista": "seguridad",
          "vial": "transporte",
          "conductor": "operador"
        };
        
        return synonyms[w] || w;
      });
  };

  // Mantener por compatibilidad con otros fragmentos si existen
  function normalizeText(text) {
     const tokens = starkNormalize(text);
     return tokens.join(" ");
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

  const btnNewTender = $('#btnNewTender');
  if (btnNewTender) {
    btnNewTender.onclick = () => {
      tenderIdInput.value = '';
      tenderForm.reset();
      reqContainer.innerHTML = '';
      addReqInput();
      openModal(tenderModal);
    };
  }

  const btnAddReq = $('#btnAddReq');
  if (btnAddReq) {
    btnAddReq.onclick = () => addReqInput();
  }

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

    // Drag & Drop JARVIS (Igual que en documentos.html)
    ['dragenter', 'dragover'].forEach(ev => uploadZone.addEventListener(ev, e => {
      e.preventDefault();
      uploadZone.style.border = '2px dashed var(--accent)';
      uploadZone.style.background = 'rgba(34,211,238,0.1)';
    }));
    ['dragleave', 'drop'].forEach(ev => uploadZone.addEventListener(ev, e => {
      e.preventDefault();
      uploadZone.style.border = '1px dashed rgba(34,211,238,0.3)';
      uploadZone.style.background = 'rgba(255,255,255,0.02)';
    }));
    uploadZone.addEventListener('drop', e => {
       const file = e.dataTransfer.files[0];
       if (file) handleJarvisFile(file);
    });
  }

  if (pdfInput) {
    pdfInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleJarvisFile(file);
    };
  }

  async function handleJarvisFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
       return window.notificar?.("Por favor, sube un archivo PDF para análisis JARVIS", "warning");
    }

    uploadZone.style.display = 'none';
    scanningState.style.display = 'block';
    intelPreview.style.display = 'none';
    const intelDesc = $('#intelDesc');

    try {
      updateScanLog("JARVIS Core v7.5: Iniciando Protocolo de Análisis...");
      await new Promise(r => setTimeout(r, 600));
      
      const text = await extractTextFromPDF(file);
      extractedText = text;
      
      updateScanLog("[Protocolo Stark] Fase 1: Escaneo Estructural...");
      await new Promise(r => setTimeout(r, 800));
      
      updateScanLog("[Protocolo Stark] Fase 2: Análisis Semántico Deep-IA...");
      const aiData = await analyzeTenderDeepAI(text);
      
      if (intelDesc && aiData.description) {
         intelDesc.value = aiData.description;
      }
      
      renderDetectedReqs(aiData.vacancies || []);
      
      scanningState.style.display = 'none';
      intelPreview.style.display = 'block';
      updateScanLog("Análisis Estratégico Completado.");
    } catch (err) {
      console.error(err);
      window.notificar?.("Error en JARVIS Engine: " + err.message, "error");
      uploadZone.style.display = 'block';
      scanningState.style.display = 'none';
    }
  }

  async function analyzeTenderDeepAI(text) {
     const WEBHOOK = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
     try {
        const res = await fetch(WEBHOOK, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              message: `Analiza esta licitación y extrae una ESTRUCTURA JERÁRQUICA DE VACANTES:
              1) Un resumen técnico/estratégico (max 300 caracteres). 
              2) Una lista de VACANTES, donde cada vacante tiene un TÍTULO y una lista de REQUISITOS específicos.
              
              IMPORTANTE: Agrupa los requisitos técnicos y operativos bajo su vacante correspondiente.
              Responde estrictamente en formato JSON: 
              {
                "description": "...", 
                "vacancies": [
                  {"title": "Nombre Vacante 1", "requirements": ["Req 1", "Req 2"]},
                  {"title": "Nombre Vacante 2", "requirements": ["Req 3", "Req 4"]}
                ]
              }
              Texto: ${text.substring(0, 4000)}`,
              meta: { task: "tender_hierarchical_extraction", context: "Nivel God Industrias Stark" }
           })
        });
        const data = await res.json();
        let payload = Array.isArray(data) ? data[0] : data;
        let finalData = { description: "", vacancies: [] };

        const textResp = payload.output || payload.text || payload.reply || "";
        if (typeof textResp === 'string' && textResp.includes('{')) {
           try {
              const start = textResp.indexOf('{');
              const end = textResp.lastIndexOf('}') + 1;
              finalData = JSON.parse(textResp.substring(start, end));
           } catch(e) { console.warn("JSON Parse err", e); }
        }

        // Respaldo heurístico si la IA no entregó vacantes estructuradas
        if (!finalData.vacancies?.length) {
           const legacyReqs = await detectRequirementsHeuristic(text);
           finalData.vacancies = [{ title: "Perfiles Detectados", requirements: legacyReqs.map(r => r.label) }];
        }

        return {
           description: finalData.description || "",
           vacancies: finalData.vacancies || []
        };
     } catch (e) {
        return {
           description: "Error de conexión con el núcleo JARVIS. Se activó el respaldo local.",
           vacancies: [{ title: "Respaldo Local", requirements: (await detectRequirementsHeuristic(text)).map(r => r.label) }]
        };
     }
  }

  async function extractTextFromPDF(file) {
    const reader = new FileReader();
    const arrayBuffer = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // DISABLE WORKER: To avoid "Storage Blocked" errors in some browsers
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
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
      { id: 'fuego', label: 'Combate Incendios (OS10)', keywords: ['fuego', 'incendio', 'extintor', 'os10'] },
      { id: 'primeros_aux', label: 'Primeros Auxilios', keywords: ['auxilios', 'reanimacion', 'rcp'] }
    ];
    return catalog.filter(c => c.keywords.some(k => clean.includes(k)));
  }

  function renderDetectedReqs(vacancies) {
    intelReqs.innerHTML = vacancies.map((v, vIdx) => `
      <div class="card" style="padding:15px; border:1px solid rgba(34,211,238,0.2); background:rgba(255,255,255,0.02); margin-bottom:12px;">
         <div style="font-size:14px; font-weight:800; color:var(--accent); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>🛡️ ${v.title}</span>
            <input type="checkbox" checked class="vacancy-group-check" data-vidx="${vIdx}">
         </div>
         <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(v.requirements || []).map((r, rIdx) => `
               <div class="badge badge--dark" style="font-size:11px; display:flex; align-items:center; gap:5px;">
                  ${r}
                  <input type="checkbox" checked class="intel-check" data-vidx="${vIdx}" data-ridx="${rIdx}" data-label="${r}">
               </div>
            `).join('')}
         </div>
      </div>
    `).join('');
  }

  const btnImportIntel = $('#btnImportIntel');
  if (btnImportIntel) {
    btnImportIntel.onclick = () => {
      // Recolectar vacantes con sus requisitos seleccionados
      const vCards = Array.from(document.querySelectorAll('.vacancy-group-check:checked')).map(vc => {
        const vIdx = vc.dataset.vidx;
        const title = vc.closest('.card').querySelector('span').textContent.replace('🛡️ ', '');
        const requirements = Array.from(document.querySelectorAll(`.intel-check[data-vidx="${vIdx}"]:checked`)).map(i => i.dataset.label);
        return { title, requirements };
      }).filter(v => v.requirements.length > 0);

      const description = $('#intelDesc')?.value || "";
      
      tenderIdInput.value = '';
      tenderForm.reset();
      tenderNameInput.value = "Licitación Detectada " + new Date().toLocaleDateString();
      tenderDescInput.value = description;
      
      reqContainer.innerHTML = '';
      
      // NIVEL GOD: Almacenamos la estructura jerárquica
      // Para retrocompatibilidad y visualización, creamos inputs especiales si es necesario,
      // pero el guardado usará el JSON de vCards.
      vCards.forEach(v => {
        v.requirements.forEach(r => {
           addReqInput(`[${v.title}] ${r}`);
        });
      });
      
      closeModal(smartModal);
      openModal(tenderModal);
      window.notificar?.(`Importadas ${vCards.length} vacantes con sus requisitos`, "success");
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
      if (tendersBody) tendersBody.innerHTML = '<div style="padding: 40px; text-align: center;">No hay registros.</div>';
      return;
    }

    if (tendersBody) {
      tendersBody.innerHTML = filtered.map(t => {
        // Agrupar por vacante para el renderizado
        const vGroups = {};
        (t.requirements || []).forEach(r => {
           const m = r.match(/^\[(.*?)\]\s*(.*)$/);
           const v = m ? m[1] : "General";
           const l = m ? m[2] : r;
           if (!vGroups[v]) vGroups[v] = [];
           vGroups[v].push(l);
        });

        return `
          <div class="t-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); align-items: start; padding: 20px 0;">
            <div class="t-col-name" style="font-weight: 700; color: #fff;">${escapeHtml(t.name)}</div>
            <div class="t-col-desc" style="color: rgba(255,255,255,0.8); font-size: 13.5px; line-height:1.5;">${escapeHtml(t.description)}</div>
            <div class="t-col-reqs" style="display: flex; flex-direction: column; gap: 12px;">
              ${Object.keys(vGroups).slice(0, 3).map(v => `
                <div class="v-tag-group">
                   <div style="font-size:9px; text-transform:uppercase; color:var(--accent); font-weight:800; margin-bottom:4px; opacity:0.8;">${escapeHtml(v)}</div>
                   <div style="display:flex; gap:4px; flex-wrap:wrap;">
                      ${vGroups[v].slice(0, 4).map(req => `<span class="badge badge--info" style="font-size:10px; padding:2px 6px;">${escapeHtml(req)}</span>`).join('')}
                      ${vGroups[v].length > 4 ? `<span style="font-size:10px; opacity:0.5; align-self:center;">+${vGroups[v].length - 4}</span>` : ''}
                   </div>
                </div>
              `).join('')}
              ${Object.keys(vGroups).length > 3 ? `<div style="font-size:10px; color:var(--muted); font-style:italic;">+${Object.keys(vGroups).length - 3} vacantes más</div>` : ''}
            </div>
            <div class="t-col-actions" style="text-align: right; display: flex; gap: 6px; justify-content: flex-end; align-self: center;">
              <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}" style="padding: 8px 15px;">Evaluar</button>
              <button class="btn btn--mini btn-edit" data-id="${t.id}">✏️</button>
              <button class="btn btn--mini btn-delete" data-id="${t.id}" style="color:#f87171">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.btn-match').forEach(btn => btn.onclick = () => runMatchmaking(filtered.find(x => x.id === btn.dataset.id)));
      document.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => editTender(filtered.find(x => x.id === btn.dataset.id)));
      document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deleteTender(btn.dataset.id));
    }
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

  if (tenderForm) {
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
  }

  if (searchInput) {
    searchInput.oninput = () => renderTenders();
  }

  // --- LÓGICA DE MATCHMAKING (RESTORED & ENHANCED) ---
  let currentSource = 'workers';
  const btnMatchWorkers = $('#btnMatchWorkers');
  const btnMatchCandidates = $('#btnMatchCandidates');

  if (btnMatchWorkers) {
    btnMatchWorkers.onclick = () => { currentSource = 'workers'; btnMatchWorkers.classList.add('is-active'); btnMatchCandidates.classList.remove('is-active'); runMatchmaking(window.lastTender); };
  }
  if (btnMatchCandidates) {
    btnMatchCandidates.onclick = () => { currentSource = 'candidates'; btnMatchCandidates.classList.add('is-active'); btnMatchWorkers.classList.remove('is-active'); runMatchmaking(window.lastTender); };
  }

  async function runMatchmaking(tender) {
    if (!tender) return;
    window.lastTender = tender;
    if ($('#matchTitle')) $('#matchTitle').textContent = `Matchmaking JARVIS: ${tender.name}`;
    if (matchBody) matchBody.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <div class="scanning-spinner" style="width:40px; height:40px; border:3px solid var(--accent); border-top-color:transparent; border-radius:50%; margin:0 auto 20px; animation: spin 1s linear infinite;"></div>
        <p style="color:var(--accent); font-weight:600; letter-spacing:1px;">ORQUESTANDO INTELIGENCIA STARK...</p>
      </div>
    `;
    openModal(matchModal);
    try {
      if (currentSource === 'workers') await matchWorkers(tender);
      else await matchCandidates(tender);
    } catch (e) { if (matchBody) matchBody.innerHTML = `<p class="error">${e.message}</p>`; }
  }

  async function matchWorkers(tender) {
    const { data: ws } = await window.supabase.from('workers').select('*');
    const { data: cs } = await window.supabase.from('worker_credentials').select('*');
    const { data: ex } = await window.supabase.from('medical_exam_records').select('*');
    const normRut = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

    const rawReqs = tender.requirements || [];
    
    // NIVEL GOD: Agrupar requisitos por vacante si tienen el formato [Vacante]
    const vacancyGroups = {};
    rawReqs.forEach(r => {
      const match = r.match(/^\[(.*?)\]\s*(.*)$/);
      const vTitle = match ? match[1] : "General";
      const reqLabel = match ? match[2] : r;
      if (!vacancyGroups[vTitle]) vacancyGroups[vTitle] = [];
      vacancyGroups[vTitle].push(reqLabel);
    });

    const resultsByVacancy = {};

    Object.keys(vacancyGroups).forEach(vTitle => {
      const vReqs = vacancyGroups[vTitle];
      resultsByVacancy[vTitle] = ws.map(w => {
        const docs = [
          ...(cs || []).filter(c => c.worker_id === w.id || normRut(c.rut) === normRut(w.rut)), 
          ...(ex || []).filter(e => normRut(e.rut) === normRut(w.rut))
        ];
        const workerIntelTokens = [
          ...starkNormalize(w.full_name),
          ...starkNormalize(w.company_name),
          ...docs.flatMap(d => [...starkNormalize(d.credential_name), ...starkNormalize(d.exam_type)])
        ];
        
        const matched = vReqs.filter(req => {
          const reqTokens = starkNormalize(req);
          const intersection = reqTokens.filter(t => workerIntelTokens.includes(t));
          return (intersection.length > 0 && reqTokens.length <= 1) || 
                 (intersection.length >= 1 && reqTokens.some(rt => rt.length > 5 && workerIntelTokens.includes(rt))) ||
                 (intersection.length / reqTokens.length) >= 0.25;
        });

        // Match si el título de la vacante coincide o si calza requisitos
        const titleMatch = starkNormalize(vTitle).some(t => workerIntelTokens.includes(t));
        const finalMatched = matched;
        if (titleMatch && !finalMatched.includes(vTitle)) {
           // Si no hay requisitos que calzaran pero el título sí, le damos un boost
        }

        const score = vReqs.length > 0 ? (finalMatched.length / vReqs.length) * 100 : (titleMatch ? 100 : 0);
        
        return { name: w.full_name, id: w.rut, detail: w.company_name, allReqs: vReqs, matched: finalMatched, score, titleMatch };
      }).filter(r => r.score > 0 || r.titleMatch).sort((a,b) => b.score - a.score);
    });

    renderHierarchicalResults(resultsByVacancy);
  }

  async function matchCandidates(tender) {
    const { data: cand } = await window.supabase.from('candidates').select('*');
    if (!cand) return;

    const candIds = cand.map(c => c.id);
    const { data: docs } = await window.supabase.from('client_documents').select('*').in('metadata->candidate_id', candIds);
    const docIds = (docs || []).map(d => d.id);
    const { data: chunks } = await window.supabase.from('document_chunks').select('*').in('metadata->document_id', docIds);

    const rawReqs = tender.requirements || [];
    const vacancyGroups = {};
    rawReqs.forEach(r => {
      const match = r.match(/^\[(.*?)\]\s*(.*)$/);
      const vTitle = match ? match[1] : "General";
      const reqLabel = match ? match[2] : r;
      if (!vacancyGroups[vTitle]) vacancyGroups[vTitle] = [];
      vacancyGroups[vTitle].push(reqLabel);
    });

    const resultsByVacancy = {};

    Object.keys(vacancyGroups).forEach(vTitle => {
      const vReqs = vacancyGroups[vTitle];
      resultsByVacancy[vTitle] = cand.map(c => {
        const candidateDocs = (docs || []).filter(d => d.metadata?.candidate_id === c.id);
        const docIdsForCand = candidateDocs.map(d => d.id);
        const candidateChunks = (chunks || []).filter(ch => docIdsForCand.includes(ch.metadata?.document_id) || ch.metadata?.candidate_id === c.id);
        const deepContent = candidateChunks.map(ch => ch.content).join(" ");
        const candidateTokens = [
          ...starkNormalize(c.nombre_completo),
          ...starkNormalize(c.profesion),
          ...starkNormalize(c.cargo_a_desempenar),
          ...starkNormalize(c.nombre_tokens_clave),
          ...starkNormalize(deepContent)
        ];

        const matched = vReqs.filter(req => {
          const reqTokens = starkNormalize(req);
          const intersection = reqTokens.filter(t => candidateTokens.includes(t));
          return (intersection.length > 0 && reqTokens.length <= 1) || 
                 (intersection.length >= 1 && reqTokens.some(rt => rt.length > 5 && candidateTokens.includes(rt))) ||
                 (intersection.length / reqTokens.length) >= 0.25;
        });

        const titleTokens = starkNormalize(vTitle);
        const titleMatch = titleTokens.some(t => candidateTokens.includes(t));
        
        const score = vReqs.length > 0 ? (matched.length / vReqs.length) * 100 : (titleMatch ? 100 : 0);
        
        return { 
          name: c.nombre_completo, 
          id: c.profesion || 'Candidato', 
          idx: c.id,
          allReqs: vReqs,
          matched,
          isCandidate: true, 
          score,
          titleMatch
        };
      }).filter(r => r.score > 0 || r.titleMatch).sort((a,b) => b.score - a.score);
    });

    renderHierarchicalResults(resultsByVacancy);
  }

  const profileModal = $('#profileModal');

  function renderHierarchicalResults(groupedRes) {
    if (!matchBody) return;
    
    const vacancyTitles = Object.keys(groupedRes);
    const totalFound = vacancyTitles.reduce((acc, t) => acc + groupedRes[t].length, 0);

    if (totalFound === 0) {
       matchBody.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted);">No se encontraron perfiles con calce jerárquico.</div>';
       return;
    }

    matchBody.innerHTML = `
      <div style="margin-bottom:20px; padding:10px; background:rgba(34,211,238,0.05); border-radius:8px; border:1px solid rgba(34,211,238,0.1); font-size:12px; color:var(--accent); text-align:center; letter-spacing:1px;">
         📡 ESCANEO COMPLETO: ${totalFound} PERFILES DETECTADOS EN ${vacancyTitles.length} CAPAS
      </div>
      <div class="vacancy-accordion">
        ${vacancyTitles.map((vTitle, idx) => {
           const res = groupedRes[vTitle];
           if (res.length === 0) return '';
           
           return `
             <div class="vacancy-section" style="margin-bottom:15px; border: 1px solid rgba(255,255,255,0.05); border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.01);">
                <div class="vacancy-header" 
                     onclick="this.nextElementSibling.classList.toggle('is-collapsed'); this.querySelector('.toggle-icon').textContent = this.nextElementSibling.classList.contains('is-collapsed') ? '➕' : '➖'"
                     style="padding:15px 20px; background:rgba(255,255,255,0.03); cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition: background 0.3s;"
                     onmouseover="this.style.background='rgba(34,211,238,0.05)'"
                     onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                   <div style="font-size:15px; font-weight:800; color:var(--accent); display:flex; align-items:center; gap:12px;">
                      <span class="toggle-icon" style="font-size:10px; opacity:0.6;">➖</span>
                      🛡️ ${escapeHtml(vTitle)}
                      <span style="font-size:11px; font-weight:400; color:rgba(34,211,238,0.6); background:rgba(34,211,238,0.1); padding:2px 8px; border-radius:10px;">
                         ${res.length} Match
                      </span>
                   </div>
                   <div style="font-size:12px; opacity:0.5;">Click para expandir/contraer</div>
                </div>
                <div class="vacancy-content" style="padding:20px; transition: all 0.3s ease-out;">
                   <div class="match-grid">
                      ${res.slice(0, 15).map((r, rIdx) => {
                        const score = r.score || (r.titleMatch ? 50 : 0);
                        const color = score >= 80 ? 'var(--ok)' : (score >= 50 ? 'var(--accent)' : '#f59e0b');
                        
                        // ID temporal para el botón de detalles
                        const btnId = `btn-det-${idx}-${rIdx}`;
                        
                        return `
                          <div class="match-card">
                            <div class="match-card__header">
                              <div class="match-card__meta">
                                <h4>${escapeHtml(r.name)}</h4>
                                <span>${escapeHtml(r.id)}</span>
                              </div>
                              <div class="match-score-badge" style="color:${color}; border-color:${color}44; background:${color}11">
                                ${score.toFixed(0)}%
                              </div>
                            </div>
                            <div class="match-progress-container">
                              <div class="match-progress-bar" style="width: ${score}%; background: ${color};"></div>
                            </div>
                            <div class="match-card__status">
                              <div style="font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:5px; font-size:11px;">
                                Calce de Requisitos (${r.matched.length}/${r.allReqs.length})
                              </div>
                              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                                ${r.allReqs.map(req => {
                                  const isMatch = r.matched.includes(req);
                                  return `<span class="badge" style="font-size:9px; padding:2px 6px; opacity:${isMatch ? 1 : 0.3}; background:${isMatch ? 'rgba(34,211,238,0.2)' : 'transparent'}; border:1px solid ${isMatch ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}">${escapeHtml(req)}</span>`;
                                }).join('')}
                              </div>
                            </div>
                            <div style="display:flex; gap:8px; margin-top:auto;">
                              ${r.isCandidate ? `<a href="candidate.html?id=${encodeURIComponent(r.idx || r.id)}" class="btn btn--mini btn--primary" style="flex:1">Ver Perfil</a>` : ''}
                              <button class="btn btn--mini btn-show-prof" 
                                      data-vtitle="${escapeHtml(vTitle)}"
                                      data-payload='${JSON.stringify(r).replace(/'/g, "&apos;")}'
                                      style="flex:1">Detalles</button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                   </div>
                </div>
             </div>
           `;
        }).join('')}
      </div>
      <style>
        .vacancy-content.is-collapsed {
           display: none;
        }
        .vacancy-header:hover {
           border-bottom: 1px solid rgba(34,211,238,0.2);
        }
      </style>
    `;

    document.querySelectorAll('.btn-show-prof').forEach(btn => {
       btn.onclick = () => {
          const r = JSON.parse(btn.dataset.payload);
          const vTitle = btn.dataset.vtitle;
          showProfilePreview(r, vTitle);
       };
    });
  }

  function showProfilePreview(r, vTitle) {
     if (!profileModal) return;

     $('#profInitial').textContent = (r.name || "S").charAt(0).toUpperCase();
     $('#profName').textContent = r.name;
     $('#profTitle').textContent = r.id;
     $('#profMatchVacancy').textContent = vTitle;

     const strengths = r.matched.length > 0 ? r.matched : (r.titleMatch ? ["Título de Vacante coincide con perfil"] : ["Sin coincidencias explícitas"]);
     $('#profStrengths').innerHTML = strengths.map(s => `
        <div style="font-size:12px; color:var(--ok); display:flex; align-items:center; gap:8px;">
           <span style="font-size:14px;">⚡</span> ${s}
        </div>
     `).join('');

     const gaps = r.allReqs.filter(req => !r.matched.includes(req));
     $('#profGaps').innerHTML = gaps.length > 0 ? gaps.map(g => `
        <div style="font-size:12px; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:8px;">
           <span style="font-size:14px; opacity:0.5;">⭕</span> ${g}
        </div>
     `).join('') : '<div style="font-size:12px; color:var(--ok);">✅ Sin brechas críticas detectadas.</div>';

     $('#profReqChecklist').innerHTML = r.allReqs.map(req => {
        const isMatch = r.matched.includes(req);
        return `
           <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.02); border-radius:6px; border:1px solid ${isMatch ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)'}">
              <span style="font-size:13px; color:${isMatch ? '#fff' : 'rgba(255,255,255,0.5)'}">${req}</span>
              <span style="font-weight:800; color:${isMatch ? 'var(--ok)' : 'var(--muted)'}">${isMatch ? 'HABILITADO' : 'PENDIENTE'}</span>
           </div>
        `;
     }).join('');

     const link = $('#profFullLink');
     if (r.isCandidate) {
        link.href = `candidate.html?id=${encodeURIComponent(r.idx || r.id)}`;
        link.style.display = 'block';
     } else {
        link.style.display = 'none';
     }

     openModal(profileModal);
  }

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
