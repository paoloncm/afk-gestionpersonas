/** 
 * tenders.supabase.js - Protocolo Stark Intelligence V21 (Extracción Industrial) 
 * 
 * Mejoras: 60k contexto, separación de certificaciones, renderizado masivo.
 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // =========================================================
  // STATE & CONFIG
  // =========================================================
  const state = {
    allTenders: [],
    detectedVacancies: [],
    lastAiAnalysis: null,
    selectedTenderId: null,
    activeMatchTender: null,
    activeMatchVacancies: [],
    activeMatchVacancyIndex: 0,
    talentCache: {
      workers: null,
      workerCredentials: null,
      candidates: null,
      shortlistsByVacancy: {},
      lastLoadedAt: 0
    }
  };

  const CACHE_TTL_MS = 60 * 1000;

  const REQUIREMENT_ALIASES = {
    // Salud Ocupacional
    "altura fisica": ["altura fisica", "trabajo en altura", "altura", "altfis", "altura geográfica", "altura geografica", "trabajo en alturas"],
    "silice": ["silice", "sílice", "polvo de sílice", "polvo silice"],
    "ruido": ["ruido", "exposición al ruido", "ruido ocupacional"],
    "psicologico": ["psicologico", "psicológico", "infpsico", "informe psicologico", "informe psicológico", "evaluacion psicologica"],
    "examen preocupacional": ["preocupacional", "examen preocupacional", "preocupacional vigente", "examen médico"],
    // Sistemas Contra Incendios
    "contra incendios": ["contra incendios", "red humeda", "fuego", "fire system", "sistemas extinguidores", "sistemas contra incendios", "detectores de humo", "red seca", "spci", "protección contra incendios", "extintor"],
    // Habilidades Técnicas
    "instalacion": ["instalacion", "instalador", "montaje", "armado", "puesta en marcha", "instalación"],
    "mantenimiento": ["mantenimiento", "mantención", "mantencion", "manto", "overhaul"],
    "curso": ["curso", "capacitacion", "capacitación", "certificacion", "certificación"],
    "certificacion": ["certificacion", "certificación", "acreditacion", "acreditación", "homologación"],
    "operador": ["operador", "operacion", "operación", "operar"],
    "soldador": ["soldador", "soldadura", "tig", "mig", "smaw", "fcaw"],
    "electrico": ["electrico", "eléctrico", "electricidad", "instalación eléctrica", "baja tensión", "media tensión", "alta tensión", "eleéctrico"],
    "mecanico": ["mecanico", "mecánico", "mecánica", "mecanica", "mecánica industrial"],
    "conductor": ["conductor", "chofer", "driver", "licencia b", "licencia c", "licencia d"],
    "supervisor": ["supervisor", "jefe", "encargado", "capataz", "líder de equipo"],
    "ingeniero": ["ingeniero", "engineering", "ing.", "ingeniería"],
    // Industria Minera
    "mineria": ["mineria", "minería", "minero", "faena", "rajo", "underground", "subterráneo"],
    "sap": ["sap", "sap pm", "sap mm", "sap co"],
    "autocad": ["autocad", "cad", "diseño cad"],
    "izaje": ["izaje", "grúa", "eslingas", "rigger"],
    "espacio confinado": ["espacio confinado", "espacios confinados", "trabajo confinado"],
    "bloqueo": ["bloqueo", "bloqueo y etiquetado", "loto", "lockout"]
  };

  // =========================================================
  // HELPERS
  // =========================================================
  const openModal = (m) => m?.classList.add('is-open');
  const closeModal = (m) => m?.classList.remove('is-open');
  
  const notify = (msg) => { if (typeof window.notificar === 'function') window.notificar(msg); else console.log(msg); };
  const notifyError = (msg, err) => { console.error(msg, err); notify(`ERROR: ${msg}`); };
  const escapeHtml = (v) => { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; };

  function normalizeText(v) {
    return String(v || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function safeArray(v) { return Array.isArray(v) ? v : []; }

  // =========================================================
  // MOTOR DE PROCESAMIENTO PDF LEVEL-GOD (JARVIS)
  // =========================================================
  const StarkProcessor = {
    async process(file) {
        this.updateRadar("INICIANDO MATRIX SCAN INDUSTRIAL...", "Analizando hasta 60,000 carácteres...");
        const text = await this.extractText(file);
        this.updateRadar("EXTRACCIÓN COMPLETADA", `Sincronizando con Red Stark AI...`);
        return await this.analyzeTender(text);
    },
    async extractText(file) {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let txt = "";
        const numPages = pdf.numPages || pdf.length;
        for (let i = 1; i <= numPages; i++) {
            this.updateRadar(`ESCANEANDO PÁGINA ${i}/${numPages}`, "Extrayendo jerarquía tabular con precisión Y-Axis...");
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });
            const pageWidth = viewport.width;

            // --- STARK COLUMN DETECTOR ---
            // Detectar columnas dividiendo la página en mitades
            // Si el PDF tiene 2 columnas, los items de la columna derecha tienen x > pageWidth/2
            const midX = pageWidth / 2;
            const leftItems = [];
            const rightItems = [];

            for (const item of content.items) {
                if (!item.str || !item.str.trim()) continue;
                const x = item.transform[4];
                const y = item.transform[5];
                if (x > midX * 0.7 && x < midX) {
                    // Zona ambigua: tratar como columna izquierda
                    leftItems.push({ str: item.str, x, y });
                } else if (x >= midX) {
                    rightItems.push({ str: item.str, x, y });
                } else {
                    leftItems.push({ str: item.str, x, y });
                }
            }

            // Verificar si hay contenido real en la columna derecha (layout multi-columna)
            const isMultiColumn = rightItems.length > 5 && rightItems.length > leftItems.length * 0.2;

            let pageTxt = "";
            if (isMultiColumn) {
                // Procesar columna izquierda luego derecha
                pageTxt += this._itemsToText(leftItems) + "\n";
                pageTxt += this._itemsToText(rightItems) + "\n";
            } else {
                // Layout de una sola columna: ordenar todo junto
                const allItems = [...leftItems, ...rightItems];
                pageTxt += this._itemsToText(allItems) + "\n";
            }

            txt += pageTxt + `\n[PÁGINA_BREAK_${i}]\n`;
        }
        return txt;
    },
    _itemsToText(items) {
        // Ordenar por Y descendente (top), luego X ascendente
        const sorted = [...items].sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) < 10) return a.x - b.x; // Misma línea: izq a der
            return yDiff; // Distinta línea: arriba a abajo
        });
        let lines = [];
        let currentLine = [];
        let lastY = null;
        for (const item of sorted) {
            if (lastY === null || Math.abs(item.y - lastY) < 10) {
                currentLine.push(item.str);
            } else {
                if (currentLine.length) lines.push(currentLine.join(" "));
                currentLine = [item.str];
            }
            lastY = item.y;
        }
        if (currentLine.length) lines.push(currentLine.join(" "));
        return lines.join("\n");
    },
    async analyzeTender(text) {
        const res = await fetch('/api/analyze-tender', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ text: text }) 
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.detail);
        return data.analysis;
    },
    updateRadar(t, l) {
        if ($('#radarText')) $('#radarText').textContent = t;
        if ($('#radarLog')) $('#radarLog').textContent = l;
    }
  };

  // =========================================================
  // SCORING & MATCHMAKING
  // =========================================================
  function matchesRequirement(sourceText, requirement) {
    const source = normalizeText(sourceText);
    const normReq = normalizeText(requirement);
    const aliases = REQUIREMENT_ALIASES[normReq] || [normReq];
    return aliases.some(alias => source.includes(normalizeText(alias)));
  }

  function scoreRequirements(sourceText, requirements, certifications = []) {
    const all = [...safeArray(requirements), ...safeArray(certifications)].map(r => String(r).trim()).filter(Boolean);
    if (!all.length) return { score: 0, missing: [], matched: [] };
    const matched = [], missing = [];
    for (const req of all) {
      if (matchesRequirement(sourceText, req)) matched.push(req);
      else missing.push(req);
    }
    return { score: Math.round((matched.length / all.length) * 100), missing, matched };
  }

  function getWorkerSourceText(worker, credentials) {
    const credsText = (credentials || []).map(c => [c.credential_name, c.result_status].filter(Boolean).join(' ')).join(' ');
    return [worker?.full_name, worker?.cargo, worker?.position, worker?.profession, credsText].filter(Boolean).join(' ');
  }

  function getCandidateSourceText(candidate) {
    // Incluir todos los campos relevantes para el matching
    return [
      candidate?.nombre_completo,
      candidate?.profesion,
      candidate?.cargo_a_desempenar,
      candidate?.cargo,
      candidate?.evaluacion_general,
      candidate?.experiencia_general,
      candidate?.experiencia_especifica,
      candidate?.otras_experiencias,
      candidate?.software_que_domina,
      candidate?.antecedentes_academicos
    ].filter(Boolean).join(' ');
  }

  // =========================================================
  // API & DATA
  // =========================================================
  async function loadTenders() {
    try {
      if (!window.supabase) return setTimeout(loadTenders, 500);
      const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      state.allTenders = data || [];
      renderTenders();
    } catch (error) { notifyError('Fallo en carga de licitaciones.', error); }
  }

  async function ensureTalentDataLoaded(force = false) {
    const now = Date.now();
    const cacheFresh = (now - state.talentCache.lastLoadedAt) < CACHE_TTL_MS;
    if (!force && cacheFresh && state.talentCache.workers) return state.talentCache;

    const [w, cr, cd, sl] = await Promise.all([
      window.supabase.from('workers').select('*'),
      window.supabase.from('worker_credentials').select('*'),
      window.supabase.from('candidates').select('*'),
      window.supabase.from('vacancy_shortlists').select('*')
    ]);

    state.talentCache.workers = w.data || [];
    state.talentCache.workerCredentials = cr.data || [];
    state.talentCache.candidates = cd.data || [];
    
    const slMap = {};
    (sl.data || []).forEach(item => {
      if (!slMap[item.vacancy_id]) slMap[item.vacancy_id] = [];
      slMap[item.vacancy_id].push(item);
    });
    state.talentCache.shortlistsByVacancy = slMap;
    state.talentCache.lastLoadedAt = now;
    return state.talentCache;
  }

  // =========================================================
  // UI RENDERERS
  // =========================================================
  function renderTenders() {
    const body = $('#tendersBody'); if (!body) return;
    const term = normalizeText($('#searchTender')?.value || '');
    const filtered = state.allTenders.filter(t => normalizeText(t.name).includes(term) || normalizeText(t.description).includes(term));

    body.innerHTML = filtered.map(t => `
        <div class="t-row stark-card" data-id="${t.id}" style="margin-bottom:10px; padding:18px 20px; display:flex; align-items:center; cursor:pointer;" onclick="editTenderById('${t.id}', 'intel')">
          <div style="flex: 0 0 25%; font-weight:800; color:var(--text);">
             <span style="color:var(--accent)">[</span> ${escapeHtml(t.name)} <span style="color:var(--accent)">]</span>
          </div>
          <div style="flex: 0 0 35%; color:var(--muted); font-size:11px; padding-right:15px;">${escapeHtml(t.description || '')}</div>
          <div style="flex:1; display:flex; flex-wrap:wrap; gap:5px;">
            ${safeArray(t.requirements).slice(0,3).map(r => `<span class="badge" style="font-size:10px;">${escapeHtml(r)}</span>`).join('')}
          </div>
          <div style="flex:0 0 160px; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn--mini btn--primary" onclick="event.stopPropagation(); runMatchmakingById('${t.id}')">[ OPERATIVO ]</button>
            <button class="btn btn--mini btn-delete" onclick="event.stopPropagation(); deleteTender('${t.id}')" style="color:var(--danger); opacity:0.6;">🗑️</button>
          </div>
        </div>
    `).join('');
  }

  function renderDetectedVacancies() {
    const list = $('#vacanciesList'); if (!list) return;
    $('#vacanciesWrapper').style.display = state.detectedVacancies.length ? 'block' : 'none';
    list.innerHTML = state.detectedVacancies.map((v, i) => `
      <div class="stark-card" style="padding:15px; margin-bottom:12px; border-left:3px solid var(--accent); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01);">
        <div style="flex:1;">
          <input class="input" value="${escapeHtml(v.title)}" style="background:transparent; border:none; font-weight:900; color:var(--accent); width:100%; border-bottom:1px solid rgba(255,255,255,0.05); font-size:14px;" onchange="state.detectedVacancies[${i}].title=this.value">
          
          <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:8px;">
            ${safeArray(v.requirements).map(r => `<span style="font-size:9px; color:var(--muted); background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:4px;">${escapeHtml(r)}</span>`).join('')}
            ${safeArray(v.certifications).map(c => `<span style="font-size:9px; color:var(--accent); background:rgba(34,211,238,0.1); padding:2px 6px; border-radius:4px; border:1px solid rgba(34,211,238,0.2);">🔒 ${escapeHtml(c)}</span>`).join('')}
          </div>
          <div style="font-size:10px; color:var(--text); margin-top:5px; font-style:italic; opacity:0.7;">Exp: ${escapeHtml(v.experiencia_minima || 'N/A')}</div>
        </div>
        <div style="width:70px; margin:0 15px; text-align:center;">
          <div style="font-size:8px; color:var(--muted); margin-bottom:4px;">DOTACIÓN</div>
          <input type="number" class="input" value="${v.total_positions || 1}" onchange="state.detectedVacancies[${i}].total_positions=parseInt(this.value)" style="background:rgba(0,0,0,0.2); text-align:center; font-family:monospace;">
        </div>
        <button type="button" class="btn btn--mini" onclick="removeVacancy(${i})" style="color:var(--danger); font-size:18px;">×</button>
      </div>
    `).join('');
  }

  window.removeVacancy = (i) => { state.detectedVacancies.splice(i, 1); renderDetectedVacancies(); };

  async function updateIntelTab(id) {
    const tender = state.allTenders.find(t => t.id === id);
    if ($('#intelTenderInfo')) $('#intelTenderInfo').textContent = tender?.description || '';
    try {
      const [{ data: vacs }, talent] = await Promise.all([
        window.supabase.from('vacancies').select('*').eq('tender_id', id),
        ensureTalentDataLoaded()
      ]);
      const slByVac = talent.shortlistsByVacancy || {};
      $('#intelVacancyList').innerHTML = (vacs || []).map(v => {
        const count = (slByVac[v.id] || []).length, pos = v.total_positions || 1, pct = Math.round((count / pos) * 100);
        return `
          <div class="stark-card" style="padding:15px; margin-bottom:10px; border-left:3px solid ${pct >= 100 ? 'var(--ok)' : 'var(--accent)'};">
            <div style="display:flex; justify-content:space-between; align-items:start;">
              <div><div style="font-size:10px; font-weight:900;">[ ${escapeHtml(v.title.toUpperCase())} ]</div><div style="font-size:13px; font-weight:700; margin:5px 0;">${count} / ${pos} PUESTOS</div></div>
              <div style="text-align:right;"><div style="font-size:18px; font-weight:900; color:var(--accent)">${pct}%</div><div style="font-size:8px; color:var(--muted);">LLENADO</div></div>
            </div>
            <div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>
          </div>`;
      }).join('');
    } catch (err) { notifyError('Fallo en vista de inteligencia.', err); }
  }

  // =========================================================
  // ACTIONS
  // =========================================================
  async function handleFile(f) {
    if (!f) return;
    $('#scannerOverlay').style.display = 'flex';
    if ($('#radarLog')) $('#radarLog').textContent = "INICIANDO PROTOCOLO JARVIS...";
    
    try {
        const a = await StarkProcessor.process(f);
        state.lastAiAnalysis = a; // Guardar para importación manual
        
        const roles = Array.isArray(a.roles) ? a.roles : [];
        if (roles.length === 0) {
            roles.push({
                nombre: "PERFIL GENERAL OPERATIVO",
                cantidad: 1,
                requirements: ["Base Técnica", "Seguridad Industrial"],
                certificaciones: [],
                experiencia_minima: "1-3 años"
            });
            state.lastAiAnalysis.roles = roles;
        }

        // 2. Mostrar resultados en el panel de Inteligencia (SIN sobrescribir la ficha aún)
        if ($('#intelPreview')) {
            $('#intelPreview').style.display = 'block';
            if ($('#intelDesc')) $('#intelDesc').value = a.tender_summary || "";
            if ($('#intelReqs')) {
                $('#intelReqs').innerHTML = roles.map(r => `
                    <div class="stark-card" style="font-size:10px; background:rgba(34,211,238,0.05); border:1px solid rgba(34,211,238,0.2); padding:8px; border-radius:4px; margin-bottom:5px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="color:var(--accent);">${escapeHtml(r.nombre.toUpperCase())}</strong>
                            <span style="font-weight:900;">CANT: ${r.cantidad}</span>
                        </div>
                        <div style="font-size:8px; color:var(--muted); margin-top:4px;">${escapeHtml(r.perfil_ideal || '')}</div>
                    </div>
                `).join('');
            }
            if ($('#riskBadge')) {
                const risk = a.global_risk || "Medio";
                $('#riskBadge').textContent = `RIESGO: ${risk.toUpperCase()}`;
                $('#riskBadge').style.background = risk.includes('Alto') ? 'var(--danger)' : (risk.includes('Bajo') ? 'var(--ok)' : 'var(--accent)');
            }
        }

        // 3. Optimización de UI
        if ($('#uploadZone')) {
            $('#uploadZone').style.padding = '15px';
            $('#uploadZone').querySelector('p').textContent = "Explorar otro documento";
        }

        if (!$('#tenderModal').classList.contains('is-open')) {
            openModal($('#tenderModal'));
        }
        
        notify("JARVIS: ANÁLISIS COMPLETADO. REVISA EL PANEL SUPERIOR.");
        
        const scrollArea = document.querySelector('.modal-scroll');
        if (scrollArea) scrollArea.scrollTop = 0;

    } catch (e) { 
        notifyError("Falla en el motor JARVIS", e); 
    }
    $('#scannerOverlay').style.display = 'none';
  }

  window.importIntel = () => {
    const a = state.lastAiAnalysis;
    if (!a) return;

    const roles = a.roles || [];
    
    // 1. Poblar ficha técnica
    if ($('#tenderName')) $('#tenderName').value = `Licitación: ${roles[0]?.nombre || 'Nuevo Proyecto'}`;
    if ($('#tenderDesc')) $('#tenderDesc').value = a.tender_summary || "";
    
    // 2. Poblar Requisitos Manuales
    if ($('#reqContainer')) {
        $('#reqContainer').innerHTML = '';
        const allReqs = [...new Set([...(roles[0]?.requirements || []), ...(roles[0]?.certificaciones || [])])];
        allReqs.slice(0, 6).forEach(r => addReqInput(r));
    }

    // 3. Mapear vacantes al estado
    state.detectedVacancies = roles.map(r => ({ 
        title: r.nombre || 'CARGO SIN NOMBRE', 
        requirements: safeArray(r.requirements || r.requisitos),
        certifications: safeArray(r.certificaciones || r.certificciones),
        experiencia_minima: r.experiencia_minima || "No especificada",
        total_positions: parseInt(r.cantidad) || 1,
        perfil_ideal: r.perfil_ideal || ""
    }));
    
    renderDetectedVacancies();
    state.lastAiAnalysis = null; // Marcar como importado
    notify("ANÁLISIS INTEGRADO A LA FICHA EXITOSAMENTE.");
    if ($('#intelPreview')) $('#intelPreview').style.display = 'none';
  };

  async function saveTender(e, silent = false) {
    if (e) e.preventDefault();
    
    // DAR AVISO si hay inteligencia pendiente de importar
    if (!silent && state.lastAiAnalysis && !confirm("JARVIS: Hay un análisis de IA pendiente de importar. ¿Deseas guardar SIN integrar estos datos?")) {
        return;
    }

    try {
      const id = $('#tenderId').value;
      const payload = {
        name: $('#tenderName').value.trim(),
        description: $('#tenderDesc').value.trim(),
        requirements: $$('.req-input').map(i => i.value.trim()).filter(Boolean)
      };
      
      if (!payload.name) {
          if (!silent) notifyError("Operación Abortada: El nombre de la licitación es obligatorio.");
          return null;
      }

      const { data: tRes, error: tErr } = id ? 
        await window.supabase.from('tenders').update(payload).eq('id', id).select() :
        await window.supabase.from('tenders').insert(payload).select();

      if (tErr) throw tErr;
      const tid = id || tRes[0].id;
      if (!id) $('#tenderId').value = tid; // Guardar ID en el modal para futuras operaciones

      // Sincronizar vacantes
      if (state.detectedVacancies.length > 0) {
          const { data: exV } = await window.supabase.from('vacancies').select('id').eq('tender_id', tid);
          const exIds = (exV||[]).map(v => v.id), nIds = state.detectedVacancies.map(v => v.id).filter(i => i);
          const toDel = exIds.filter(i => !nIds.includes(i));
          
          if (toDel.length) {
              await window.supabase.from('vacancy_shortlists').delete().in('vacancy_id', toDel);
              await window.supabase.from('vacancies').delete().in('id', toDel);
          }

          const { data: savedV } = await window.supabase.from('vacancies').upsert(state.detectedVacancies.map(v => ({
            id: v.id || undefined,
            tender_id: tid,
            title: v.title,
            requirements: v.requirements,
            certifications: v.certifications,
            total_positions: v.total_positions || 1
          }))).select();
          
          // Actualizar IDs en memoria para que el matchmaking instantáneo funcione
          if (savedV) {
              state.detectedVacancies = savedV;
          }
      }

      if (silent) return tid;

      // --- DISPARAR RECLUTAMIENTO AUTÓNOMO ---
      if (state.detectedVacancies.length > 0) {
          const { data: finalV } = await window.supabase.from('vacancies').select('*').eq('tender_id', tid);
          if (finalV?.length) {
              await autoAssignCandidates(tid, finalV);
          }
      }

      notify('OPERACIÓN COMPLETADA: LICITACIÓN Y RECLUTAMIENTO SINCRONIZADOS.');
      closeModal($('#tenderModal'));
      loadTenders();
    } catch (err) { 
        if (!silent) notifyError('Error en persistencia industrial.', err); 
        return null; 
    }
  }

  async function autoAssignCandidates(tid, vacancies) {
    const overlay = $('#recruitmentOverlay');
    const bar = $('#recruitmentBar');
    const log = $('#recruitmentLog');
    const detail = $('#recruitmentDetail');

    if (overlay) overlay.style.display = 'flex';
    if (bar) bar.style.width = '0%';
    
    try {
        const talent = await ensureTalentDataLoaded();
        const totalV = vacancies.length;
        
        // 1. Obtener shortlists existentes para detectar colisiones (duplicados)
        const { data: existingSL } = await window.supabase.from('vacancy_shortlists').select('person_id');
        const busyIds = new Set((existingSL || []).map(s => s.person_id));

        const allAssignments = [];

        for (let i = 0; i < totalV; i++) {
            const v = vacancies[i];
            const progress = Math.round(((i + 1) / totalV) * 100);
            if (bar) bar.style.width = `${progress}%`;
            if (log) log.textContent = `RECLUTANDO: ${v.title.toUpperCase()}`;
            
            // Evaluar afinidad para todos los trabajadores
            const scored = talent.workers.map(w => ({
                id: w.id,
                ...scoreRequirements(getWorkerSourceText(w, talent.workerCredentials.filter(c => c.worker_id === w.id)), v.requirements, v.certifications)
            }))
            .filter(s => s.score >= 70) // Solo los mejores (Nivel Stark)
            .sort((a,b) => b.score - a.score);

            // Seleccionar top N según dotación
            const quota = v.total_positions || 1;
            const top = scored.slice(0, quota);

            top.forEach(candidate => {
                const isDuplicate = busyIds.has(candidate.id);
                allAssignments.push({
                    vacancy_id: v.id,
                    person_id: candidate.id,
                    score: candidate.score,
                    status: isDuplicate ? 'DOBLE_ASIGNACION' : 'RECLUTADO_IA',
                    notes: `Asignación automática JARVIS (Score: ${candidate.score}%)${isDuplicate ? ' - ADVERTENCIA: En otro proceso' : ''}`
                });
                if (detail) detail.textContent = `Asignado: ${candidate.id.slice(0,8)} a ${v.title}`;
            });
            
            await new Promise(r => setTimeout(r, 200)); // Delay estético Stark
        }

        if (allAssignments.length > 0) {
            const { error: insErr } = await window.supabase.from('vacancy_shortlists').insert(allAssignments);
            if (insErr) throw insErr;
            notify(`JARVIS: ${allAssignments.length} CANDIDATOS RECLUTADOS AUTÓNOMAMENTE.`);
        } else {
            notify("JARVIS: No se encontraron candidatos con afinidad suficiente.");
        }

    } catch (e) {
        console.error("Error en reclutamiento autónomo:", e);
        notifyError("Falla en el Protocolo de Reclutamiento", e);
    }

    if (overlay) {
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 1500);
    }
  }

  async function runMatchmaking(tender) {
    state.activeMatchTender = tender;
    openModal($('#matchModal'));
    $('#matchTitle').textContent = `OPERACIÓN_HUD: ${tender.name.toUpperCase()}`;
    setMatchTab('workers');

    // Priorizar vacantes en estado (detectadas) si existen, sino ir a DB
    if (state.detectedVacancies.length > 0 && (!tender.id || state.detectedVacancies[0].tender_id === tender.id)) {
        state.activeMatchVacancies = state.detectedVacancies;
    } else {
        const { data: v } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
        state.activeMatchVacancies = v?.length ? v : [{ id: 'global', title: 'Operación Global', requirements: tender.requirements, total_positions: 1 }];
    }
    
    if ($('#vacancySelector')) {
        $('#vacancySelector').innerHTML = state.activeMatchVacancies.map((vac, i) => `<option value="${i}">[ ${escapeHtml(vac.title.toUpperCase())} ]</option>`).join('');
        $('#vacancySelector').onchange = () => evaluateVacancy(state.activeMatchVacancies[$('#vacancySelector').value]);
    }
    evaluateVacancy(state.activeMatchVacancies[0]);
  }

  async function runInstantMatchmaking() {
      notify("Sincronizando Inteligencia antes del Matchmaking...");
      const tid = await saveTender(null, true); // Silent Sync
      if (tid) {
          const t = { 
              id: tid, 
              name: $('#tenderName').value, 
              requirements: $$('.req-input').map(i => i.value.trim()).filter(Boolean) 
          };
          runMatchmaking(t);
      }
  }

  async function evaluateVacancy(vacancy) {
    const talent = await ensureTalentDataLoaded();
    const sl = talent.shortlistsByVacancy[vacancy.id] || [];

    const scoredW = talent.workers.map(w => ({
        person: { ...w, full_name: w.full_name || w.nombre_completo },
        personType: 'worker',
        ...scoreRequirements(getWorkerSourceText(w, talent.workerCredentials.filter(c => c.worker_id === w.id)), vacancy.requirements, vacancy.certifications),
        isS: sl.some(s => s.person_id === w.id)
    })).sort((a,b) => b.score - a.score);

    const scoredC = talent.candidates.map(c => ({
        person: { ...c, full_name: c.nombre_completo },
        personType: 'candidate',
        ...scoreRequirements(getCandidateSourceText(c), vacancy.requirements, vacancy.certifications),
        isS: sl.some(s => s.person_id === c.id)
    })).sort((a,b) => b.score - a.score);

    $('#matchBodyWorkers').innerHTML = renderMatchGrid(scoredW, vacancy.id, 'AFK');
    $('#matchBodyCandidates').innerHTML = renderMatchGrid(scoredC, vacancy.id, 'IA EXTERNO');
  }

  function renderMatchGrid(list, vacId, label) {
    if (!list.length) return `<div style="padding:30px; text-align:center; color:var(--muted); font-size:12px;">[ SIN RESULTADOS PARA ESTE PERFIL ]</div>`;
    return list.map(item => {
      // Determinar tipo de persona por el campo type_hint que se pasa explícitamente
      const personType = item.personType || (item.person.nombre_completo ? 'candidate' : 'worker');
      const scoreColor = item.score >= 70 ? 'var(--green)' : item.score >= 40 ? 'var(--accent)' : 'var(--muted)';
      return `
        <div class="stark-card" style="padding:15px; margin-bottom:10px; border:${item.isS ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)'}; ${item.isS ? 'background:rgba(34,211,238,0.04);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:start; cursor:pointer;" onclick="StarkUI.openPersonProfile('${item.person.id}', '${personType}')">
            <div style="flex:1;">
              <strong style="font-size:13px;">${escapeHtml((item.person.full_name || item.person.nombre_completo || '').toUpperCase())}</strong>
              <div style="font-size:9px; color:var(--muted); margin-top:3px;">${escapeHtml(item.person.cargo || item.person.profesion || '')}</div>
            </div>
            <div style="text-align:right; margin-left:15px;">
              <span style="color:${scoreColor}; font-weight:900; font-size:18px;">${item.score}%</span>
              <div style="font-size:8px; color:var(--muted);">${label} MATCH</div>
            </div>
          </div>
          <div class="affinity-bar" style="margin-top:10px;"><div class="affinity-fill" style="width:${item.score}%; background:${scoreColor};"></div></div>
          ${item.matched?.length ? `<div style="font-size:8px; color:var(--green); margin-top:6px; display:flex; flex-wrap:wrap; gap:3px;">&#10003; ${item.matched.map(m => `<span style="background:rgba(46,231,165,0.1); border:1px solid rgba(46,231,165,0.25); padding:1px 5px; border-radius:3px;">${escapeHtml(m)}</span>`).join('')}</div>` : ''}
          ${item.missing?.length ? `<div style="font-size:8px; color:#ff3264; margin-top:4px; display:flex; flex-wrap:wrap; gap:3px;">&#10007; GAP: ${item.missing.map(m => `<span style="background:rgba(255,50,100,0.1); border:1px solid rgba(255,50,100,0.25); padding:1px 5px; border-radius:3px;">${escapeHtml(m)}</span>`).join('')}</div>` : ''}
          <div style="margin-top:10px; text-align:right;">
             ${!item.isS && vacId !== 'global' ? `<button class="btn btn--mini primary" onclick="shortlist('${vacId}', '${item.person.id}', '${personType}', ${item.score})">+ PRESELECCIONAR</button>` : `<span style="color:var(--accent); font-size:10px; font-weight:900;">[ SELECCIONADO ]</span>`}
          </div>
        </div>`;
    }).join('');
  }

  window.shortlist = async (vid, pid, type, score) => {
    await window.supabase.from('vacancy_shortlists').upsert({ vacancy_id: vid, person_id: pid, person_type: type, score: score }, { onConflict: 'vacancy_id, person_id, person_type' });
    notify("PIPELINE ACTUALIZADO");
    await ensureTalentDataLoaded(true);
    evaluateVacancy(state.activeMatchVacancies[$('#vacancySelector').value]);
  };

  // =========================================================
  // BOOTSTRAP
  // =========================================================
  function bindGlobalEvents() {
    if ($('#btnNewTender')) $('#btnNewTender').onclick = () => editTenderById(null);
    if ($('#searchTender')) $('#searchTender').oninput = () => renderTenders();
    if ($('#tenderForm')) $('#tenderForm').onsubmit = (e) => saveTender(e);

    if ($('#tabTenderEdit')) $('#tabTenderEdit').onclick = () => setTenderTab('edit');
    if ($('#tabTenderIntel')) $('#tabTenderIntel').onclick = () => { setTenderTab('intel'); if ($('#tenderId').value) updateIntelTab($('#tenderId').value); };
    if ($('#tabWorkers')) $('#tabWorkers').onclick = () => setMatchTab('workers');
    if ($('#tabCandidates')) $('#tabCandidates').onclick = () => setMatchTab('candidates');

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => {
        closeModal($('#tenderModal')); closeModal($('#matchModal')); closeModal($('#personProfileModal'));
    });

    if ($('#btnImportIntel')) $('#btnImportIntel').onclick = () => importIntel();

    const z = $('#uploadZone'), i = $('#pdfInput');
    if (z && i) {
        z.onclick = () => i.click();
        i.onchange = (e) => handleFile(e.target.files[0]);
        z.ondragover = (e) => { e.preventDefault(); z.style.borderColor = 'var(--accent)'; z.style.background = 'rgba(34,211,238,0.1)'; };
        z.ondragleave = () => { z.style.borderColor = 'var(--border)'; z.style.background = 'transparent'; };
        z.ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') handleFile(f); };
    }

    if ($('#btnInstantMatch')) $('#btnInstantMatch').onclick = () => runInstantMatchmaking();

    if ($('#btnStarkScan')) {
        $('#btnStarkScan').onclick = () => {
            // Abrir el input directamente si el dashboard lo pide
            if (i) i.click();
        };
    }
  }

  function setTenderTab(tab) {
    const isE = tab === 'edit';
    if ($('#tenderEditContent')) $('#tenderEditContent').style.display = isE ? 'flex' : 'none';
    if ($('#tenderIntelContent')) $('#tenderIntelContent').style.display = isE ? 'none' : 'flex';
    if ($('#tabTenderEdit')) $('#tabTenderEdit').className = `tab ${isE ? 'active' : ''}`;
    if ($('#tabTenderIntel')) $('#tabTenderIntel').className = `tab ${!isE ? 'active' : ''}`;
  }

  function setMatchTab(tab) {
    const isW = tab === 'workers';
    if ($('#matchBodyWorkers')) $('#matchBodyWorkers').style.display = isW ? 'block' : 'none';
    if ($('#matchBodyCandidates')) $('#matchBodyCandidates').style.display = isW ? 'none' : 'block';
    if ($('#tabWorkers')) $('#tabWorkers').className = `tab ${isW ? 'active' : ''}`;
    if ($('#tabCandidates')) $('#tabCandidates').className = `tab ${!isW ? 'active' : ''}`;
  }

  function addReqInput(v = '') {
    const d = document.createElement('div'); d.style.display = 'flex'; d.style.gap = '8px'; d.style.marginBottom = '5px';
    d.innerHTML = `<input class="input req-input" value="${escapeHtml(v)}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="this.parentElement.remove()">×</button>`;
    $('#reqContainer').appendChild(d);
  }

  window.editTenderById = async (id, tab = 'edit') => {
    const t = id ? state.allTenders.find(x => x.id === id) : { id: '', name: '', description: '', requirements: [] };
    $('#tenderId').value = t.id; $('#tenderName').value = t.name; $('#tenderDesc').value = t.description || '';
    $('#reqContainer').innerHTML = ''; (t.requirements || []).forEach(r => addReqInput(r)); if (!t.requirements?.length) addReqInput();
    if (id) { const { data } = await window.supabase.from('vacancies').select('*').eq('tender_id', id); state.detectedVacancies = data || []; }
    else state.detectedVacancies = [];
    renderDetectedVacancies(); setTenderTab(tab); openModal($('#tenderModal'));
    if (tab === 'intel') updateIntelTab(id);
  };

  window.runMatchmakingById = async (id) => {
    let t = state.allTenders.find(x => x.id === id);
    // Si no ha sido guardado, usamos el estado actual
    if (!t && $('#tenderId')?.value === '') { 
        t = { 
            id: 'unsaved', 
            name: $('#tenderName').value, 
            requirements: $$('.req-input').map(i => i.value.trim()).filter(Boolean) 
        };
    }
    runMatchmaking(t);
  };

  window.deleteTender = async (id) => {
    if (confirm('¿DESACTIVAR PROYECTO?')) {
        await window.supabase.from('vacancies').delete().eq('tender_id', id);
        await window.supabase.from('tenders').delete().eq('id', id);
        loadTenders();
    }
  };

  window.StarkUI = {
    openPersonProfile: async (id, type) => {
        $('#scannerOverlay').style.display = 'flex'; openModal($('#personProfileModal'));
        try {
            const { data: p } = await window.supabase.from(type === 'worker' ? 'workers' : 'candidates').select('*').eq('id', id).single();
            if (p) {
                $('#profileName').textContent = (p.full_name || p.nombre_completo || '').toUpperCase();
                $('#profileProfession').textContent = p.cargo || p.profesion || '';
                $('#profileCvSummary').innerHTML = p.evaluacion_general || p.perfil_profesional || '';
                $('#profileEditBtn').onclick = () => window.location.href = type === 'worker' ? `worker.html?id=${id}` : `candidate.html?id=${id}`;
            }
        } catch (e) {}
        setTimeout(() => $('#scannerOverlay').style.display = 'none', 800);
    }
  };

  async function init() {
    bindGlobalEvents();
    loadTenders();
  }

  init();
})();
