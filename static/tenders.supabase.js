/** 
 * tenders.supabase.js - Protocolo Stark Intelligence V17 (Análisis PDF Level-God) 
 */

(function () {
  const $ = (s) => document.querySelector(s);
  
  // --- CONFIGURACIÓN & ALIAS ---
  const REQUIREMENT_ALIASES = {
    "altura fisica": ["altura fisica", "trabajo en altura", "altfis", "altura"],
    "silice": ["silice", "sílice", "silicosis"],
    "ruido": ["ruido", "hipoacusia"],
    "infpsico": ["infpsico", "informe psicologico", "psicologico", "evaluacion psicologica"],
    "prevencion": ["prevencion", "prevencionista", "riesgos"],
  };

  // --- ESTADO GLOBAL ---
  const StarkState = {
    tenders: [],
    currentTender: null,
    detectedVacancies: [], // Estructura: { id, title, requirements, total_positions }
    talentPool: {
        workers: null,
        credentials: null,
        candidates: null,
        lastLoaded: null
    }
  };

  // --- NÚCLEO DE SCORING SEMÁNTICO ---
  const StarkScoring = {
    normalizeText(value) {
        return String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
    },

    matchesRequirement(sourceText, requirement) {
        const ns = this.normalizeText(sourceText);
        const nr = this.normalizeText(requirement);
        const aliases = REQUIREMENT_ALIASES[nr] || [nr];
        return aliases.some(a => ns.includes(this.normalizeText(a)));
    },

    scoreWorker(worker, credentials, requirements) {
        const sourceText = (credentials || []).map(c => c.credential_name || "").join(" ");
        const missing = (requirements || []).filter(req => !this.matchesRequirement(sourceText, req));
        const score = requirements.length ? Math.round(((requirements.length - missing.length) / requirements.length) * 100) : 0;
        return { score, missing };
    },

    scoreCandidate(candidate, requirements) {
        const sourceText = [
          candidate.profesion,
          candidate.evaluacion_general,
          candidate.experiencia_general,
          candidate.experiencia_especifica,
          candidate.cargo_a_desempenar
        ].join(" ");

        const missing = (requirements || []).filter(req => !this.matchesRequirement(sourceText, req));
        const score = requirements.length ? Math.round(((requirements.length - missing.length) / requirements.length) * 100) : 0;
        return { score, missing };
    }
  };

  // --- MOTOR DE PROCESAMIENTO PDF LEVEL-GOD ---
  const StarkProcessor = {
    async process(file) {
        this.updateRadar("INICIANDO MATRIX SCAN...", "Accediendo al binario del pliego...");
        try {
            const text = await this.extractText(file);
            this.updateRadar("EXTRACCIÓN COMPLETADA", `Analizando ${text.length} caracteres con JARVIS AI...`);
            const analysis = await this.analyzeTender(text);
            return analysis;
        } catch (err) {
            throw err;
        }
    },

    async extractText(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
            this.updateRadar(`ESCANEANDO PÁGINA ${i}/${pdf.numPages}`, "Detectando jerarquía operativa...");
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map(item => item.str).join(" ") + "\n";
        }
        return fullText;
    },

    async analyzeTender(text) {
        const response = await fetch('/api/analyze-tender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.substring(0, 30000) }) // GPT-4o context slice
        });
        const res = await response.json();
        if (!res.ok) throw new Error(res.detail || "Fallo en el motor de IA");
        return res.analysis;
    },

    updateRadar(title, log) {
        if ($('#radarText')) $('#radarText').textContent = title;
        if ($('#radarLog')) $('#radarLog').textContent = log;
    }
  };

  // --- CAPA DE PERSISTENCIA (API) ---
  const StarkAPI = {
    async ensureTalentLoaded(force = false) {
        const cache = StarkState.talentPool;
        const isFresh = cache.lastLoaded && (Date.now() - cache.lastLoaded < 60000);
        if (!force && isFresh && cache.workers) return cache;

        const [wRes, crRes, cRes] = await Promise.all([
            window.supabase.from('workers').select('*'),
            window.supabase.from('worker_credentials').select('*'),
            window.supabase.from('candidates').select('*')
        ]);

        cache.workers = wRes.data || [];
        cache.credentials = crRes.data || [];
        cache.candidates = cRes.data || [];
        cache.lastLoaded = Date.now();
        return cache;
    },

    async saveTender(tenderData, vacancies) {
        const { id, name, description, requirements } = tenderData;
        const { data: tRes, error: tErr } = id ? 
            await window.supabase.from('tenders').update({ name, description, requirements }).eq('id', id).select() :
            await window.supabase.from('tenders').insert({ name, description, requirements }).select();

        if (tErr) throw tErr;
        const tenderId = id || tRes[0].id;

        if (vacancies.length > 0) {
            const { data: existingVacs } = await window.supabase.from('vacancies').select('id').eq('tender_id', tenderId);
            const existingIds = (existingVacs || []).map(v => v.id);
            const newIds = vacancies.map(v => v.id).filter(id => id);
            
            const toDelete = existingIds.filter(id => !newIds.includes(id));
            if (toDelete.length) await window.supabase.from('vacancies').delete().in('id', toDelete);

            const vacData = vacancies.map(v => ({
                id: v.id || undefined,
                tender_id: tenderId,
                title: v.title,
                requirements: v.requirements,
                total_positions: v.total_positions || 1
            }));
            await window.supabase.from('vacancies').upsert(vacData);
        }
        return tenderId;
    },

    async shortlist(vacId, personId, type, score) {
        await window.supabase.from('vacancy_shortlists').upsert({
            vacancy_id: vacId, person_id: personId, person_type: type, score: score
        }, { onConflict: 'vacancy_id, person_id, person_type' });
    }
  };

  // --- CAPA DE INTERFAZ (UI) ---
  const StarkUI = {
    async init() {
        this.bindEvents();
        await this.loadDashboard();
    },

    bindEvents() {
        $('#btnNewTender').onclick = () => this.openTenderEdit();
        $('#searchTender').oninput = () => this.renderTenders();
        
        $('#tendersBody').onclick = (e) => {
            const row = e.target.closest('.t-row');
            if (!row) return;
            const id = row.dataset.id;
            if (e.target.closest('.btn-match')) this.openMatchmaking(StarkState.tenders.find(t => t.id === id));
            else if (e.target.closest('.btn-delete')) this.deleteTender(id);
            else this.openTenderEdit(id, 'intel');
        };

        $('#tabTenderEdit').onclick = () => this.switchTenderTab('edit');
        $('#tabTenderIntel').onclick = () => this.switchTenderTab('intel');
        $('#tabWorkers').onclick = () => this.switchMatchTab('workers');
        $('#tabCandidates').onclick = () => this.switchMatchTab('candidates');

        $('#tenderForm').onsubmit = (e) => this.handleSubmit(e);

        // --- PDF DRAG & DROP REAL-FIX ---
        const zone = $('#uploadZone');
        const input = $('#pdfInput');

        zone.onclick = () => input.click();
        input.onchange = (e) => this.handleFile(e.target.files[0]);

        zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; zone.style.background = 'rgba(34,211,238,0.1)'; };
        zone.ondragleave = () => { zone.style.borderColor = 'var(--border)'; zone.style.background = 'rgba(255,255,255,0.02)'; };
        zone.ondrop = (e) => { 
            e.preventDefault(); 
            zone.style.borderColor = 'var(--border)';
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') this.handleFile(file);
            else window.notificar?.("SÓLO SE ADMITEN PROTOCOLOS PDF");
        };
    },

    async handleFile(file) {
        if (!file) return;
        $('#scannerOverlay').style.display = 'flex';
        try {
            const analysis = await StarkProcessor.process(file);
            
            $('#tenderName').value = analysis.roles[0]?.nombre ? `Licitación: ${analysis.roles[0].nombre}` : file.name.replace('.pdf','');
            $('#tenderDesc').value = analysis.tender_summary || "Análisis JARVIS completado.";
            
            StarkState.detectedVacancies = analysis.roles.map(r => ({
                title: r.nombre,
                requirements: [...(r.requisitos || []), ...(r.certificaciones || []), r.experiencia_minima].filter(v => v),
                total_positions: r.cantidad || 1
            }));
            
            this.renderDetectedVacancies();
            window.notificar?.("EXTRACCIÓN LEVEL-GOD COMPLETADA");
        } catch (err) { 
            StarkUI.notifyError("Fallo en Análisis Profundo", err);
        } finally {
            $('#scannerOverlay').style.display = 'none';
        }
    },

    async loadDashboard() {
        if (!window.supabase) return setTimeout(() => this.loadDashboard(), 500);
        const { data } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
        StarkState.tenders = data || [];
        this.renderTenders();
    },

    renderTenders() {
        const body = $('#tendersBody');
        const term = ($('#searchTender')?.value || "").toLowerCase();
        const filtered = StarkState.tenders.filter(t => (t.name||"").toLowerCase().includes(term) || (t.description||"").toLowerCase().includes(term));
        body.innerHTML = filtered.map(t => `
            <div class="t-row stark-card" data-id="${t.id}" style="margin-bottom:10px; padding:18px 20px; display:flex; align-items:center; cursor:pointer;">
              <div style="flex:0 0 25%; font-weight:800;"><span style="color:var(--accent)">[</span> ${this.escape(t.name)} <span style="color:var(--accent)">]</span></div>
              <div style="flex:0 0 35%; color:var(--muted); font-size:11px;">${this.escape(t.description || '')}</div>
              <div style="flex:1; display:flex; flex-wrap:wrap; gap:5px;">${(t.requirements || []).slice(0,3).map(r => `<span class="badge" style="font-size:10px;">${r}</span>`).join('')}</div>
              <div style="flex:0 0 150px; display:flex; gap:8px; justify-content:flex-end;">
                 <button class="btn btn--mini btn--primary btn-match">[ OPERATIVO ]</button>
                 <button class="btn btn--mini btn-delete" style="color:var(--danger); opacity:0.6;">🗑️</button>
              </div>
            </div>`).join('');
    },

    async openTenderEdit(id = null, tab = 'edit') {
        const t = id ? StarkState.tenders.find(x => x.id === id) : { id: '', name: '', description: '', requirements: [] };
        $('#tenderId').value = t.id;
        $('#tenderName').value = t.name;
        $('#tenderDesc').value = t.description || '';
        $('#reqContainer').innerHTML = '';
        (t.requirements || []).forEach(r => this.addReqInput(r));
        if (!id) this.addReqInput();
        
        if (id) {
            const { data: v } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
            StarkState.detectedVacancies = v || [];
        } else StarkState.detectedVacancies = [];
        
        this.renderDetectedVacancies();
        this.switchTenderTab(tab);
        $('#tenderModal').classList.add('is-open');
    },

    switchTenderTab(tab) {
        const isI = tab === 'intel';
        $('#tenderEditContent').style.display = isI ? 'none' : 'block';
        $('#tenderIntelContent').style.display = isI ? 'block' : 'none';
        $('#tabTenderIntel').className = `tab ${isI ? 'active' : ''}`;
        $('#tabTenderEdit').className = `tab ${!isI ? 'active' : ''}`;
        if (isI) this.renderIntelReport();
    },

    async renderIntelReport() {
        const id = $('#tenderId').value;
        const pool = await StarkAPI.ensureTalentLoaded();
        const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
        const { data: sl } = await window.supabase.from('vacancy_shortlists').select('*').in('vacancy_id', (vacs||[]).map(v => v.id));

        $('#intelVacancyList').innerHTML = (vacs || []).map(v => {
            const count = (sl || []).filter(s => s.vacancy_id === v.id).length;
            const pos = v.total_positions || 1;
            const pct = Math.round((count / pos) * 100);
            return `
            <div class="stark-card" style="padding:15px; margin-bottom:10px; border-left:3px solid ${pct>=100 ? 'var(--ok)':'var(--accent)'};">
               <div style="display:flex; justify-content:space-between;">
                  <div><div style="font-size:10px; color:var(--accent); font-weight:900;">[ ${v.title.toUpperCase()} ]</div><div style="font-size:13px; font-weight:700; margin:5px 0;">${count} / ${pos} PUESTOS</div></div>
                  <div style="text-align:right;"><div style="font-size:18px; font-weight:900; color:var(--accent)">${pct}%</div><div style="font-size:9px; color:var(--muted);">DETECCIÓN</div></div>
               </div>
               <div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    },

    async openMatchmaking(tender) {
        if (!tender) return;
        $('#matchTitle').textContent = `OP: ${tender.name.toUpperCase()}`;
        $('#matchModal').classList.add('is-open');
        this.switchMatchTab('workers');
        const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
        const active = vacs?.length ? vacs : [{ id: 'global', title: 'OPERACIÓN GLOBAL', requirements: tender.requirements || [] }];
        $('#vacancySelector').innerHTML = active.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
        $('#vacancySelector').onchange = () => this.renderMatchmaker(tender, active[$('#vacancySelector').value]);
        this.renderMatchmaker(tender, active[0]);
    },

    async renderMatchmaker(tender, vacancy) {
        const pool = await StarkAPI.ensureTalentLoaded();
        const { data: sl } = await window.supabase.from('vacancy_shortlists').select('*').eq('vacancy_id', vacancy.id);
        const reqs = vacancy.requirements || [];

        const scoredW = pool.workers.map(w => ({ w, ...StarkScoring.scoreWorker(w, pool.credentials.filter(c => c.worker_id === w.id), reqs), isS: (sl||[]).some(s => s.person_id === w.id) })).sort((a,b) => b.score - a.score);
        const scoredC = pool.candidates.map(c => ({ w: { ...c, full_name: c.nombre_completo }, ...StarkScoring.scoreCandidate(c, reqs), isS: (sl||[]).some(s => s.person_id === c.id) })).sort((a,b) => b.score - a.score);

        $('#matchBodyWorkers').innerHTML = this.renderGrid(scoredW, vacancy.id, 'worker');
        $('#matchBodyCandidates').innerHTML = this.renderGrid(scoredC, vacancy.id, 'candidate');
        
        $('.modal-scroll').onclick = async (e) => {
            const btn = e.target.closest('[data-action="shortlist"]');
            if (btn) {
                const { vid, pid, type, score } = btn.dataset;
                await StarkAPI.shortlist(vid, pid, type, parseInt(score));
                window.notificar?.("PIPELINE ACTUALIZADO");
                this.renderMatchmaker(tender, vacancy);
            }
            const card = e.target.closest('.stark-card[data-person]');
            if (card && !e.target.closest('button')) this.openProfile(card.dataset.person, card.dataset.type === 'worker' ? 'AFK' : 'EXT');
        };
    },

    renderGrid(list, vacId, type) {
        return list.map(r => `
          <div class="stark-card" data-person="${r.w.id}" data-type="${type}" style="padding:15px; margin-bottom:10px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:start;">
               <div><strong style="color:var(--text); font-size:14px;">${r.w.full_name.toUpperCase()}</strong><div style="font-size:9px; color:var(--muted); text-transform:uppercase;">${r.w.cargo || r.w.profesion || ''}</div></div>
               <div style="text-align:right;"><span style="color:var(--accent); font-weight:900;">${r.score}%</span></div>
            </div>
            <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
            ${r.missing.length ? `<div style="font-size:8px; color:#ff3264; margin-top:10px;">GAP: ${r.missing.join(' • ')}</div>` : ''}
            <div style="margin-top:10px; text-align:right;">
               ${!r.isS && vacId !== 'global' ? `<button data-action="shortlist" data-vid="${vacId}" data-pid="${r.w.id}" data-type="${type}" data-score="${r.score}" class="btn btn--mini primary">+ PRESELECCIONAR</button>` : `<span style="font-size:10px; color:var(--accent);">[ SELECCIONADO ]</span>`}
            </div>
          </div>`).join('');
    },

    switchMatchTab(tab) {
        const isW = tab === 'workers';
        $('#matchBodyWorkers').style.display = isW ? 'block' : 'none';
        $('#matchBodyCandidates').style.display = isW ? 'none' : 'block';
        $('#tabWorkers').className = `tab ${isW ? 'active' : ''}`;
        $('#tabCandidates').className = `tab ${!isW ? 'active' : ''}`;
    },

    async handleSubmit(e) {
        e.preventDefault();
        const data = { id: $('#tenderId').value, name: $('#tenderName').value, description: $('#tenderDesc').value, requirements: Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v) };
        try {
            await StarkAPI.saveTender(data, StarkState.detectedVacancies);
            window.notificar?.("ESTRATEGIA GUARDADA.");
            $('#tenderModal').classList.remove('is-open');
            this.loadDashboard();
        } catch(err) { this.notifyError("Fallo al guardar", err); }
    },

    renderDetectedVacancies() {
        $('#vacanciesWrapper').style.display = StarkState.detectedVacancies.length ? 'block' : 'none';
        $('#vacanciesList').innerHTML = StarkState.detectedVacancies.map((v, i) => `
            <div class="stark-card vacancy-card" style="padding:15px; margin-bottom:8px; border-left:2px solid var(--accent); display:flex; justify-content:space-between;">
              <div style="flex:1;"><input class="input" value="${v.title}" style="background:transparent; border:none; font-weight:900; color:var(--accent); width:100%;" onchange="StarkState.detectedVacancies[${i}].title=this.value"><div style="font-size:9px; color:var(--muted);">${(v.requirements || []).join(' • ')}</div></div>
              <div style="width:50px;"><input type="number" class="input" value="${v.total_positions || 1}" onchange="StarkState.detectedVacancies[${i}].total_positions=this.value" style="background:rgba(0,0,0,0.2);"></div>
              <button type="button" class="btn btn--mini" onclick="this.parentElement.remove()" style="color:var(--danger)">×</button>
            </div>`).join('');
    },

    addReqInput(val = '') {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '8px'; div.style.marginBottom = '5px';
        div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="this.parentElement.remove()">×</button>`;
        $('#reqContainer').appendChild(div);
    },

    async deleteTender(id) {
        if (confirm('¿ELIMINAR?')) { await window.supabase.from('vacancies').delete().eq('tender_id', id); await window.supabase.from('tenders').delete().eq('id', id); this.loadDashboard(); }
    },

    async openProfile(id, type) {
        $('#scannerOverlay').style.display = 'flex';
        $('#personProfileModal').classList.add('is-open');
        try {
            const { data: p } = await window.supabase.from(type==='AFK'?'workers':'candidates').select('*').eq('id', id).single();
            if (p) {
                $('#profileName').textContent = (p.full_name || p.nombre_completo || '').toUpperCase();
                $('#profileProfession').textContent = p.cargo || p.profesion || '';
                $('#profileCvSummary').innerHTML = p.evaluacion_general || p.perfil_profesional || '';
                $('#profileEditBtn').onclick = () => window.location.href = type==='AFK' ? `worker.html?id=${id}` : `candidate.html?id=${id}`;
            }
        } catch(err) {} 
        setTimeout(() => { if($('#scannerOverlay')) $('#scannerOverlay').style.display = 'none'; }, 800);
    },

    notifyError(m, e) { console.error(m, e); window.notificar?.(`ERROR: ${m}`); },
    escape(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  };

  StarkUI.init();
})();
