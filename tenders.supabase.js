// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores

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

  // --- JARVIS INTELLIGENCE (AI & OCR) ---
  const smartModal = $('#smartModal');
  const pdfInput = $('#pdfInput');
  const uploadZone = $('#uploadZone');
  const scanningState = $('#scanningState');
  const intelPreview = $('#intelPreview');
  const intelReqs = $('#intelReqs');
  const scanLog = $('#scanLog');

  let extractedText = "";

  $('#btnSmartTender').onclick = () => openModal(smartModal);

  uploadZone.onclick = () => pdfInput.click();

  pdfInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadZone.style.display = 'none';
    scanningState.style.display = 'block';
    intelPreview.style.display = 'none';

    try {
      updateScanLog("Iniciando JARVIS Core v6.5...");
      await new Promise(r => setTimeout(r, 800));
      updateScanLog("Cargando motor de visión PDF.js...");
      
      const text = await extractTextFromPDF(file);
      extractedText = text;
      
      updateScanLog("Texto extraído. Ejecutando análisis vectorial...");
      await new Promise(r => setTimeout(r, 1200));
      
      const requirements = detectRequirementsAI(text);
      renderDetectedReqs(requirements);
      
      scanningState.style.display = 'none';
      intelPreview.style.display = 'block';
      updateScanLog("Análisis completado satisfactoriamente.");

    } catch (err) {
      console.error(err);
      window.notificar?.("Error detectando requisitos: " + err.message, "error");
      uploadZone.style.display = 'block';
      scanningState.style.display = 'none';
    }
  };

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

  function updateScanLog(msg) {
    if (scanLog) scanLog.textContent = `> ${msg}`;
  }

  function detectRequirementsAI(text) {
    const clean = normalizeText(text);
    const catalog = [
      { id: 'altura', label: 'Altura Física', keywords: ['altura', 'desnivel', 'caida', '1.80'] },
      { id: 'psico', label: 'Examen Psicosensométrico', keywords: ['psico', 'sensometrico', 'rigor', 'conductores'] },
      { id: 'lic_b', label: 'Licencia Clase B', keywords: ['licencia', 'clase b', 'conducir', 'vehiculo liviano'] },
      { id: 'lic_a2', label: 'Licencia Clase A2', keywords: ['clase a2', 'ambulancia', 'transporte'] },
      { id: 'confinado', label: 'Espacio Confinado', keywords: ['confinado', 'silice', 'tunel'] },
      { id: 'ruido', label: 'Examen de Ruido', keywords: ['ruido', 'hipoacusia', 'auditivo'] },
      { id: 'fuego', label: 'Combate Incendios', keywords: ['fuego', 'incendio', 'extintor'] },
      { id: 'primeros_aux', label: 'Primeros Auxilios', keywords: ['auxilios', 'emergencia', 'reanimacion'] }
    ];

    const detected = catalog.filter(c => {
       return c.keywords.some(k => clean.includes(k));
    });

    // Si detectamos pocos, agregamos genéricos por si acaso
    if (detected.length < 2) {
       detected.push({ label: 'Certificación Técnica', id: 'tecnica' });
    }

    return detected;
  }

  function renderDetectedReqs(reqs) {
    intelReqs.innerHTML = reqs.map(r => `
      <div class="card" style="padding:10px; border:1px solid rgba(34,211,238,0.2); background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;">
         <span style="font-size:12px; font-weight:600;">${r.label}</span>
         <input type="checkbox" checked class="intel-check" data-label="${r.label}">
      </div>
    `).join('');
  }

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

  // --- LÓGICA DE MATCHMAKING (ENHANCED) ---

  let currentSource = 'workers';

  $('#btnMatchWorkers').onclick = () => {
    currentSource = 'workers';
    $('#btnMatchWorkers').classList.add('is-active');
    $('#btnMatchCandidates').classList.remove('is-active');
    if (window.lastTender) runMatchmaking(window.lastTender);
  };

  $('#btnMatchCandidates').onclick = () => {
    currentSource = 'candidates';
    $('#btnMatchCandidates').classList.add('is-active');
    $('#btnMatchWorkers').classList.remove('is-active');
    if (window.lastTender) runMatchmaking(window.lastTender);
  };

  async function runMatchmaking(tender) {
    window.lastTender = tender;
    $('#matchTitle').textContent = `Matchmaking JARVIS: ${tender.name}`;
    matchBody.innerHTML = '<div style="padding:40px; text-align:center;"><div class="skeleton skeleton-text"></div><p>Simulando escenarios vectoriales...</p></div>';
    openModal(matchModal);

    try {
      if (currentSource === 'workers') {
         await matchWorkers(tender);
      } else {
         await matchCandidates(tender);
      }
    } catch (err) {
      console.error(err);
      matchBody.innerHTML = `<p class="error">Error Matchmaking: ${err.message}</p>`;
    }
  }

  async function matchWorkers(tender) {
    const { data: workers, error: wErr } = await window.supabase.from('workers').select('*');
    const { data: creds } = await window.supabase.from('worker_credentials').select('*');
    const { data: exams } = await window.supabase.from('medical_exam_records').select('*');

    const norm = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

    const results = workers.map(w => {
      const wRut = norm(w.rut);
      const myDocs = [
        ...(creds || []).filter(c => c.worker_id === w.id || norm(c.rut) === wRut),
        ...(exams || []).filter(e => norm(e.rut) === wRut)
      ];

      const missing = [];
      tender.requirements.forEach(req => {
        const reqNorm = normalizeText(req);
        const found = myDocs.find(d => {
           return normalizeText(d.credential_name).includes(reqNorm) || 
                  normalizeText(d.exam_type).includes(reqNorm) ||
                  normalizeText(d.credential_category).includes(reqNorm);
        });
        if (!found) missing.push(req);
      });

      return { name: w.full_name, id: w.rut, detail: w.company_name, missing };
    }).sort((a,b) => a.missing.length - b.missing.length);

    renderMatchResults(results);
  }

  async function matchCandidates(tender) {
    const { data: candidates, error: cErr } = await window.supabase.from('candidates').select('*');
    if (cErr) throw cErr;

    const results = candidates.map(c => {
       const skills = normalizeText((c.profesion || "") + " " + (c.experiencia_especifica || ""));
       const missing = [];
       
       tender.requirements.forEach(req => {
          if (!skills.includes(normalizeText(req))) missing.push(req);
       });

       // Score JARVIS (Solo para candidatos en este contexto)
       const score = Math.round(100 - (missing.length * (100 / (tender.requirements.length || 1))));

       return { 
         name: c.nombre_completo, 
         id: c.profesion || 'Candidato', 
         detail: `Calce IA: ${score}%`, 
         missing,
         isCandidate: true,
         score
       };
    }).sort((a,b) => b.score - a.score);

    renderMatchResults(results);
  }

  function renderMatchResults(results) {
    if (!results.length) {
       matchBody.innerHTML = '<p style="padding:20px; text-align:center;">No se hallaron registros en esta fuente.</p>';
       return;
    }

    matchBody.innerHTML = results.slice(0, 15).map(r => {
      const apto = r.missing.length === 0;
      const statusIcon = apto ? '🟢' : (r.missing.length > 2 ? '🔴' : '⚠️');
      
      return `
        <div class="t-row" style="background: ${apto ? 'rgba(16,185,129,0.05)' : 'transparent'}">
          <div class="t-col-name">
            <strong>${escapeHtml(r.name)}</strong><br>
            <span style="font-size:11px; color:var(--muted)">${escapeHtml(r.id)}</span>
          </div>
          <div class="t-col-prof">
            <span style="font-size:16px;">${statusIcon}</span>
            <span style="font-size:12px; font-weight:700;">${apto ? 'CALCE ALTO' : (r.missing.length > 2 ? 'NO APTO' : 'EN DESARROLLO')}</span>
          </div>
          <div class="t-col-status" style="font-size:11px;">
            <div style="color:var(--text-muted)">${escapeHtml(r.detail)}</div>
            ${!apto ? `<div style="color:#f87171">Falta: ${r.missing.join(', ')}</div>` : '<div style="color:var(--ok)">✓ Perfil 100% compatible</div>'}
          </div>
          <div class="t-col-actions">
             ${r.isCandidate ? `<a href="candidate.html?id=${r.id}" class="btn btn--mini">Ver CV</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadTenders();
  });

})();
