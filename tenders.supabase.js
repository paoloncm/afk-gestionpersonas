// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores
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

  let allTenders = [];
  let extractedText = "";

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
        console.error("Supabase client not ready");
        setTimeout(loadTenders, 500); // Reintentar si no está listo
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

      if (error) {
        if (tendersBody) tendersBody.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">${error.message}</div>`;
        return;
      }

      allTenders = data || [];
      renderTenders();
    } catch (err) {
      console.error('Error cargando licitaciones:', err);
      if (tendersBody) {
        tendersBody.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">Error: ${err.message}</div>`;
      }
    }
  }

  function renderTenders() {
    if (!tendersBody) return;
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    
    const filteredTenders = allTenders.filter(t => {
      const nom = (t.name || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const reqs = (t.requirements || []).join(" ").toLowerCase();
      return nom.includes(searchTerm) || desc.includes(searchTerm) || reqs.includes(searchTerm);
    });

    if (filteredTenders.length === 0) {
      tendersBody.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--muted);">
          ${allTenders.length === 0 ? "No has creado ninguna licitación todavía." : "No se encontraron licitaciones para tu búsqueda."}
        </div>
      `;
      return;
    }

    tendersBody.innerHTML = filteredTenders.map(t => `
      <div class="t-row" style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: start;">
        <div class="t-col-name" style="font-weight: 600;">${escapeHtml(t.name)}</div>
        <div class="t-col-desc" style="color: var(--muted); font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(t.description || 'Sin descripción')}
        </div>
        <div class="t-col-reqs" style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${(t.requirements || []).slice(0, 3).map(r => `<span class="badge" style="background:rgba(255,255,255,0.1)">${escapeHtml(r)}</span>`).join('')}
          ${(t.requirements || []).length > 3 ? `<span class="badge" style="background:rgba(255,255,255,0.05)">+${t.requirements.length - 3}</span>` : ''}
        </div>
        <div class="t-col-actions" style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
          <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">Evaluar</button>
          <button class="btn btn--mini btn-edit" data-id="${t.id}" title="Editar">✏️</button>
          <button class="btn btn--mini btn-delete" data-id="${t.id}" title="Eliminar" style="color:#f87171">🗑️</button>
        </div>
      </div>
    `).join('');

    // Eventos
    document.querySelectorAll('.btn-match').forEach(btn => {
      btn.onclick = () => runMatchmaking(filteredTenders.find(x => x.id === btn.dataset.id));
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => editTender(filteredTenders.find(x => x.id === btn.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.onclick = () => deleteTender(btn.dataset.id);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTenders();
    });
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  function normalizeText(text) {
    if (!text) return '';
    return text.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  async function deleteTender(id) {
    if (!confirm('¿Estás seguro de eliminar esta licitación?')) return;
    const { error } = await window.supabase.from('tenders').delete().eq('id', id);
    if (error) window.notificar?.(error.message, 'error');
    else {
      window.notificar?.('Licitación eliminada', 'success');
      loadTenders();
    }
  }

  function editTender(tender) {
    if (!tenderIdInput) return;
    tenderIdInput.value = tender.id;
    tenderNameInput.value = tender.name;
    tenderDescInput.value = tender.description || '';
    reqContainer.innerHTML = '';
    if (tender.requirements && tender.requirements.length > 0) {
      tender.requirements.forEach(r => addReqInput(r));
    } else {
      addReqInput();
    }
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
        res = await window.supabase.from('tenders').update({
            name, description, requirements: reqs
        }).eq('id', id);
        } else {
        res = await window.supabase.from('tenders').insert({
            name, description, requirements: reqs
        });
        }

        if (res.error) window.notificar?.(res.error.message, 'error');
        else {
        window.notificar?.('Cambios guardados correctamente', 'success');
        closeModal(tenderModal);
        loadTenders();
        }
    };
  }

  // --- SCANNERR IA (JARVIS) ---

  if (uploadZone && pdfInput) {
    uploadZone.onclick = () => pdfInput.click();

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

    pdfInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleJarvisFile(file);
    };
  }

  async function handleJarvisFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
       return window.notificar?.("Por favor, sube un archivo PDF para análisis JARVIS", "warning");
    }

    if (uploadZone) uploadZone.style.display = 'none';
    if (scanningState) scanningState.style.display = 'block';
    if (intelPreview) intelPreview.style.display = 'none';

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
      
      if (scanningState) scanningState.style.display = 'none';
      if (intelPreview) intelPreview.style.display = 'block';
      updateScanLog("Análisis Estratégico Completado.");
    } catch (err) {
      console.error(err);
      window.notificar?.("Error en JARVIS Engine: " + err.message, "error");
      if (uploadZone) uploadZone.style.display = 'block';
      if (scanningState) scanningState.style.display = 'none';
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

    // Use window.pdfjsLib directly from the CDN
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!pdfjsLib) throw new Error("Motor PDF.js no cargado. Reintenta en unos segundos.");
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
    if (!intelReqs) return;
    intelReqs.innerHTML = vacancies.map((v, vIdx) => `
      <div class="card" style="padding:15px; border:1px solid rgba(34,211,238,0.2); background:rgba(255,255,255,0.02); margin-bottom:12px;">
         <div style="font-size:14px; font-weight:800; color:var(--accent); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>✅ ${v.title}</span>
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
      const vCards = Array.from(document.querySelectorAll('.vacancy-group-check:checked')).map(vc => {
        const vIdx = vc.dataset.vidx;
        const title = vc.closest('.card').querySelector('span').textContent.replace('✅ ', '');
        const requirements = Array.from(document.querySelectorAll(`.intel-check[data-vidx="${vIdx}"]:checked`)).map(i => i.dataset.label);
        return { title, requirements };
      }).filter(v => v.requirements.length > 0);

      const description = intelDesc?.value || "";
      
      if (tenderIdInput) tenderIdInput.value = '';
      if (tenderForm) tenderForm.reset();
      if (tenderNameInput) tenderNameInput.value = "Licitación Detectada " + new Date().toLocaleDateString();
      if (tenderDescInput) tenderDescInput.value = description;
      
      if (reqContainer) reqContainer.innerHTML = '';
      
      vCards.forEach(v => {
        v.requirements.forEach(r => {
           addReqInput(`[${v.title}] ${r}`);
        });
      });
    };
  }

  // --- MATCHMAKING PER-VACANCY ---

  async function runMatchmaking(tender) {
    if ($('#matchTitle')) $('#matchTitle').textContent = `Aptitud para: ${tender.name}`;
    openModal(matchModal);
    
    if (vacancySelector) {
        vacancySelector.innerHTML = '<option value="">Cargando vacantes...</option>';
        vacancySelector.disabled = true;
    }

    const { data: vacancies, error: vErr } = await window.supabase.from('vacancies')
        .select('*')
        .eq('tender_id', tender.id)
        .order('created_at', { ascending: true });
        
    let activeVacancies = [];
    if (!vErr && vacancies && vacancies.length > 0) {
        activeVacancies = vacancies;
    } else {
        activeVacancies = [{
            id: 'global',
            title: 'Perfil Global de la Licitación',
            quantity: 1,
            requirements: tender.requirements || []
        }];
    }
    
    if (vacancySelector) {
        vacancySelector.innerHTML = '';
        activeVacancies.forEach((v, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = `${v.title} (${v.quantity} cupo${v.quantity > 1 ? 's' : ''})`;
            vacancySelector.appendChild(opt);
        });
        vacancySelector.disabled = false;
        vacancySelector.onchange = () => evaluateVacancy(tender, activeVacancies[vacancySelector.value]);
    }
    
    evaluateVacancy(tender, activeVacancies[0]);
  }

  async function evaluateVacancy(tender, vacancy) {
    if (tabWorkers) tabWorkers.click();
    
    if (matchBodyWorkers) matchBodyWorkers.innerHTML = '<p style="padding:20px; color:var(--text);">Calculando compatibilidad estricta...</p>';
    if (matchBodyCandidates) matchBodyCandidates.innerHTML = '<p style="padding:20px; color:var(--text);">Iniciando búsqueda semántica...</p>';
    
    const vacReqs = vacancy.requirements || [];

    try {
      const { data: workers, error: wErr } = await window.supabase.from('workers').select('*');
      if (wErr) throw wErr;

      const [ { data: creds }, { data: exams } ] = await Promise.all([
        window.supabase.from('worker_credentials').select('*'),
        window.supabase.from('medical_exam_records').select('*')
      ]);

      const normalize = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

      const results = workers.map(w => {
        const wRutNormalized = normalize(w.rut);
        const myDocs = [
          ...(creds || []).filter(c => c.worker_id === w.id || normalize(c.rut) === wRutNormalized),
          ...(exams || []).filter(e => normalize(e.rut) === wRutNormalized)
        ];
        const missing = [];
        const expired = [];
        const today = new Date();

        vacReqs.forEach(req => {
          const reqNorm = normalizeText(req);
          const found = myDocs.find(d => {
            const nameNorm = normalizeText(d.credential_name);
            const typeNorm = normalizeText(d.exam_type);
            const catNorm = normalizeText(d.credential_category);
            return nameNorm.includes(reqNorm) || typeNorm.includes(reqNorm) || catNorm.includes(reqNorm);
          });
          if (!found) missing.push(req);
          else if (found.expiry_date && new Date(found.expiry_date) < today) expired.push(req);
        });

        return { worker: w, isApto: (missing.length === 0 && expired.length === 0), missing, expired };
      });

      if (matchBodyWorkers) {
          matchBodyWorkers.innerHTML = results.map(r => `
            <div class="t-row" style="display: flex; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: stretch; gap: 15px;">
              <div class="t-col-name" style="flex: 0 0 200px;">
                <strong style="display:block; margin-bottom:4px;">${r.worker.full_name}</strong>
                <span style="font-size:11px; color:var(--muted)">${r.worker.rut}</span>
              </div>
              <div class="t-col-prof" style="flex: 0 0 100px; display:flex; align-items:start;">
                <span class="badge ${r.isApto ? 'badge--success' : 'badge--danger'}" style="margin-top:2px;">
                  ${r.isApto ? 'APTO' : 'NO APTO'}
                </span>
              </div>
              <div class="t-col-status" style="flex: 1; font-size:12px;">
                ${r.isApto ? '✓ Cumple requisitos' : (r.missing.length ? 'Faltan: ' + r.missing.join(', ') : '')}
              </div>
            </div>
          `).join('');
      }

    } catch (err) {
      if (matchBodyWorkers) matchBodyWorkers.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
    
    // IA Matching
    if (!matchBodyCandidates) return;
    try {
        const resp = await fetch('/api/match-tender-candidates', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                tender_id: tender.id || 'global',
                tender_name: (tender.name || 'Licitación') + ' - ' + vacancy.title,
                requirements: vacReqs
            })
        });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.detail);
        const cands = data.matches || [];
        
        if (cands.length === 0) {
            matchBodyCandidates.innerHTML = '<p style="padding:40px; color:var(--muted); text-align:center;">Ningún candidato supera el umbral.</p>';
        } else {
            matchBodyCandidates.innerHTML = cands.map(c => `
                <div class="t-row" style="display: flex; padding: 18px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: start; gap: 20px;">
                  <div style="flex: 0 0 250px;">
                    <a href="candidate.html?id=${c.id}" target="_blank" style="color:var(--text); font-weight:700;">${escapeHtml(c.nombre_completo)}</a>
                    <div style="font-size:11px; color:var(--primary);">${c.ai_match_score.toFixed(1)}% AFINIDAD</div>
                  </div>
                  <div style="flex: 1; font-size:12px; color:var(--muted);">${escapeHtml(c.evaluacion_general || 'Sin resumen')}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        matchBodyCandidates.innerHTML = `<p class="error">Error Match IA: ${err.message}</p>`;
    }
  }

  // INITIAL LOAD
  document.addEventListener('DOMContentLoaded', () => {
    loadTenders();
  });

})();
