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
      
      renderDetectedReqs(aiData.requirements || []);
      
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
              message: `Analiza esta licitación y extrae: 
              1) Un resumen técnico/estratégico del proyecto (max 300 caracteres). 
              2) Una lista de vacantes o perfiles de personal requeridos. 
              IMPORTANTE: Los requisitos deben ser GENERALES y CATEGORIZADOS (labels cortos), no descripciones largas. 
              Ej: En lugar de "Técnicos certificados para dejar sistemas operativos y emitir informes", usa "Técnicos Certificados".
              Responde estrictamente en formato JSON: {"description": "...", "requirements": ["Perfil 1", "Perfil 2"]}. 
              Texto: ${text.substring(0, 4000)}`,
              meta: { task: "tender_deep_extraction", context: "Industrias Stark" }
           })
        });
        const data = await res.json();
        let payload = Array.isArray(data) ? data[0] : data;
        let finalData = { description: "", requirements: [] };

        // Intentar parsear si viene como string
        const textResp = payload.output || payload.text || payload.reply || "";
        if (typeof textResp === 'string' && textResp.includes('{')) {
           try {
              const start = textResp.indexOf('{');
              const end = textResp.lastIndexOf('}') + 1;
              finalData = JSON.parse(textResp.substring(start, end));
           } catch(e) { console.warn("JSON Parse err", e); }
        }

        // Si falló el parse o no tiene la estructura, usamos lo que haya
        if (!finalData.requirements?.length) {
           const reqs = await detectRequirementsHeuristic(text);
           finalData.requirements = reqs.map(r => r.label);
           if (!finalData.description) finalData.description = "Licitación analizada mediante motor heurístico Stark. Revise los requisitos detectados.";
        }

        return {
           description: finalData.description || "",
           requirements: (finalData.requirements || []).map(s => ({ label: s, id: s.toLowerCase().replace(/\s+/g, '_') }))
        };
     } catch (e) {
        updateScanLog("Enlace n8n offline o error de red. Activando Respaldo Heurístico...");
        const reqs = detectRequirementsHeuristic(text);
        return {
           description: "Error de conexión con el núcleo JARVIS. Se activó el respaldo local para detección de requisitos básicos.",
           requirements: reqs
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
      { id: 'fuego', label: 'Combate Incendios (OS10)', keywords: ['fuego', 'incendio', 'extintor', 'os10'] },
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

  const btnImportIntel = $('#btnImportIntel');
  if (btnImportIntel) {
    btnImportIntel.onclick = () => {
      const selected = Array.from(document.querySelectorAll('.intel-check:checked')).map(i => i.dataset.label);
      const description = $('#intelDesc')?.value || "";
      
      tenderIdInput.value = '';
      tenderForm.reset();
      tenderNameInput.value = "Licitación Detectada " + new Date().toLocaleDateString();
      tenderDescInput.value = description;
      
      reqContainer.innerHTML = '';
      selected.forEach(r => addReqInput(r));
      
      closeModal(smartModal);
      openModal(tenderModal);
      window.notificar?.(`Importados ${selected.length} requisitos y descripción de IA`, "success");
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
      tendersBody.innerHTML = filtered.map(t => `
        <div class="t-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); align-items: start;">
          <div class="t-col-name" style="font-weight: 700; color: #fff;">${escapeHtml(t.name)}</div>
          <div class="t-col-desc" style="color: rgba(255,255,255,0.8); font-size: 13.5px;">${escapeHtml(t.description)}</div>
          <div class="t-col-reqs" style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${(t.requirements || []).slice(0, 8).map(r => `<span class="badge badge--info" style="font-size:11px;">${escapeHtml(r)}</span>`).join('')}
            ${(t.requirements || []).length > 8 ? `<span class="badge" style="opacity:0.6">+${t.requirements.length - 8} más</span>` : ''}
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
    if (matchBody) matchBody.innerHTML = '<div style="padding:20px">Iniciando escaneo...</div>';
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
    const norm = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

    const results = ws.map(w => {
      const docs = [...(cs||[]).filter(c => c.worker_id === w.id || norm(c.rut) === norm(w.rut)), ...(ex||[]).filter(e => norm(e.rut) === norm(w.rut))];
      
      const matched = tender.requirements.filter(req => 
        docs.some(d => (normalizeText(d.credential_name)+normalizeText(d.exam_type)).includes(normalizeText(req)))
      );

      const score = matched.length > 0 ? 100 : 0;
      
      return { 
        name: w.full_name, 
        id: w.rut, 
        detail: w.company_name, 
        matched, 
        score 
      };
    }).filter(r => r.score > 0).sort((a,b) => b.matched.length - a.matched.length);

    renderMatchResults(results);
  }

  async function matchCandidates(tender) {
    const { data: cand } = await window.supabase.from('candidates').select('*');
    if (!cand) return;

    const results = cand.map(c => {
       const profileText = normalizeText(`
          ${c.profesion || ''} 
          ${c.cargo_a_desempenar || ''} 
          ${c.experiencia_general || ''} 
          ${c.experiencia_especifica || ''} 
          ${c.otras_experiencias || ''} 
          ${c.antecedentes_academicos || ''}
       `);
       
       const matched = tender.requirements.filter(req => {
          const reqNorm = normalizeText(req);
          return profileText.includes(reqNorm);
       });

       const score = matched.length > 0 ? 100 : 0;

       return { 
         name: c.nombre_completo, 
         id: c.profesion || 'Candidato', 
         detail: `Compatible con: ${matched.join(', ')}`, 
         matched, 
         isCandidate: true, 
         score 
       };
    }).filter(r => r.score > 0).sort((a,b) => b.matched.length - a.matched.length);

    renderMatchResults(results);
  }

  function renderMatchResults(res) {
    if (matchBody) {
      if (res.length === 0) {
        matchBody.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted);">No se encontraron perfiles con calce para las vacantes detectadas.</div>';
        return;
      }

      matchBody.innerHTML = `
        <div class="match-grid">
          ${res.slice(0, 15).map(r => {
            const score = r.score || 0;
            const color = 'var(--ok)';
            return `
              <div class="match-card">
                <div class="match-card__header">
                  <div class="match-card__meta">
                    <h4>${escapeHtml(r.name)}</h4>
                    <span>${escapeHtml(r.id)}</span>
                  </div>
                  <div class="match-score-badge" style="color:${color}; border-color:${color}44; background:${color}11">
                    APTO
                  </div>
                </div>

                <div class="match-progress-container">
                  <div class="match-progress-bar" style="width: 100%; background: ${color};"></div>
                </div>

                <div class="match-card__status">
                  <div style="font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                    🟢 Perfil para Vacante
                  </div>
                  <div style="color:var(--muted); font-size:11px; line-height:1.4;">
                    <strong>Disponible para:</strong><br>${r.matched.join(', ')}
                  </div>
                </div>

                <div style="display:flex; gap:8px; margin-top:auto;">
                  ${r.isCandidate ? `<a href="candidate.html?id=${encodeURIComponent(r.idx || r.id)}" class="btn btn--mini btn--primary" style="flex:1">Ver Perfil</a>` : ''}
                  <button class="btn btn--mini" style="flex:1">Detalles</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', loadTenders);
})();
