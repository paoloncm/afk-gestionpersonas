/** 
 * tenders.supabase.js - Protocolo Stark Intelligence V16 (Refactor de Escala) 
 * 
 * Este archivo implementa:
 * 1. StarkState: Gestión de datos descentralizada.
 * 2. StarkCache: Caché inteligente de pool de talento (60s exp).
 * 3. StarkScoring: Motor semántico con normalización y alias.
 * 4. StarkAPI: Persistencia limpia en Supabase (upsert y tablas externas).
 * 5. StarkUI: Delegación de eventos y renderizado optimizado (sin onclick inline).
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
    detectedVacancies: [], // Para edición temporal
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
        const normalizedSource = this.normalizeText(sourceText);
        const normalizedReq = this.normalizeText(requirement);
        const aliases = REQUIREMENT_ALIASES[normalizedReq] || [normalizedReq];
        return aliases.some(a => normalizedSource.includes(this.normalizeText(a)));
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

  // --- CAPA DE PERSISTENCIA (API) ---
  const StarkAPI = {
    get sb() { return window.supabase; },

    async ensureTalentLoaded(force = false) {
        const cache = StarkState.talentPool;
        const isFresh = cache.lastLoaded && (Date.now() - cache.lastLoaded < 60000);
        
        if (!force && isFresh && cache.workers) return cache;

        const [wRes, crRes, cRes] = await Promise.all([
            this.sb.from('workers').select('*'),
            this.sb.from('worker_credentials').select('*'),
            this.sb.from('candidates').select('*')
        ]);

        if (wRes.error) throw wRes.error;
        if (crRes.error) throw crRes.error;
        if (cRes.error) throw cRes.error;

        cache.workers = wRes.data || [];
        cache.credentials = crRes.data || [];
        cache.candidates = cRes.data || [];
        cache.lastLoaded = Date.now();
        return cache;
    },

    async saveTender(tenderData, vacancies) {
        const { id, name, description, requirements } = tenderData;
        
        const { data: tRes, error: tErr } = id ? 
            await this.sb.from('tenders').update({ name, description, requirements }).eq('id', id).select() :
            await this.sb.from('tenders').insert({ name, description, requirements }).select();

        if (tErr) throw tErr;
        const tenderId = id || tRes[0].id;

        if (vacancies.length > 0) {
            // Sincronización inteligente de vacantes
            const { data: existingVacs } = await this.sb.from('vacancies').select('id').eq('tender_id', tenderId);
            const existingIds = (existingVacs || []).map(v => v.id);
            const newIds = vacancies.map(v => v.id).filter(id => id);
            
            // 1. Borrar eliminadas
            const toDelete = existingIds.filter(id => !newIds.includes(id));
            if (toDelete.length) await this.sb.from('vacancies').delete().in('id', toDelete);

            // 2. Upsert (Insert/Update)
            const vacData = vacancies.map(v => ({
                id: v.id || undefined,
                tender_id: tenderId,
                title: v.title,
                requirements: v.requirements,
                total_positions: v.total_positions || 1
            }));
            await this.sb.from('vacancies').upsert(vacData);
        }
        return tenderId;
    },

    async shortlist(vacId, personId, type, score) {
        const { error } = await this.sb.from('vacancy_shortlists').upsert({
            vacancy_id: vacId,
            person_id: personId,
            person_type: type, // 'worker' o 'candidate'
            score: score
        }, { onConflict: 'vacancy_id, person_id, person_type' });
        
        if (error) throw error;
    }
  };

  // --- CAPA DE INTERFAZ (UI) ---
  const StarkUI = {
    async init() {
        this.bindGlobalEvents();
        await this.loadAndRenderDashboard();
    },

    bindGlobalEvents() {
        $('#btnNewTender').onclick = () => this.openTenderEdit();
        $('#searchTender').oninput = () => this.renderTenders();
        
        // Delegación para Licitaciones
        $('#tendersBody').onclick = (e) => {
            const row = e.target.closest('.t-row');
            if (!row) return;
            const id = row.dataset.id;
            
            if (e.target.closest('.btn-match')) {
                const tender = StarkState.tenders.find(t => t.id === id);
                this.openMatchmaking(tender);
            } else if (e.target.closest('.btn-delete')) {
                this.deleteTender(id);
            } else {
                this.openTenderEdit(id, 'intel');
            }
        };

        // Tabs
        $('#tabTenderEdit').onclick = () => this.switchTenderTab('edit');
        $('#tabTenderIntel').onclick = () => this.switchTenderTab('intel');
        
        $('#tabWorkers').onclick = () => this.switchMatchTab('workers');
        $('#tabCandidates').onclick = () => this.switchMatchTab('candidates');

        // Formulario
        $('#tenderForm').onsubmit = (e) => this.handleTenderSubmit(e);

        // Vacancy Edit List (Delegación)
        $('#vacanciesList').onclick = (e) => {
            if (e.target.closest('[data-action="remove-vacancy"]')) {
                const idx = e.target.closest('.vacancy-card').dataset.index;
                StarkState.detectedVacancies.splice(idx, 1);
                this.renderDetectedVacancies();
            }
        };
    },

    async loadAndRenderDashboard() {
        try {
            if (!window.supabase) return setTimeout(() => this.loadAndRenderDashboard(), 500);
            const { data, error } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            StarkState.tenders = data || [];
            this.renderTenders();
        } catch (err) { this.notifyError("Fallo en sincronización central.", err); }
    },

    renderTenders() {
        const body = $('#tendersBody');
        const term = ($('#searchTender')?.value || "").toLowerCase();
        const filtered = StarkState.tenders.filter(t => 
            (t.name||"").toLowerCase().includes(term) || 
            (t.description||"").toLowerCase().includes(term)
        );

        body.innerHTML = filtered.map(t => `
            <div class="t-row stark-card" data-id="${t.id}" style="margin-bottom:10px; padding:18px 20px; display:flex; align-items:center; cursor:pointer;">
              <div style="flex: 0 0 25%; font-weight:800;">
                 <span style="color:var(--accent)">[</span> ${this.escape(t.name)} <span style="color:var(--accent)">]</span>
              </div>
              <div style="flex: 0 0 35%; color:var(--muted); font-size:11px;">${this.escape(t.description || 'Sin descripción estratégica')}</div>
              <div style="flex: 1; display:flex; flex-wrap:wrap; gap:5px;">
                ${(t.requirements || []).slice(0,3).map(r => `<span class="badge" style="font-size:10px;">${r}</span>`).join('')}
              </div>
              <div style="flex: 0 0 150px; display:flex; gap:8px; justify-content:flex-end;">
                 <button class="btn btn--mini btn--primary btn-match">[ OPERATIVO ]</button>
                 <button class="btn btn--mini btn-delete" style="color:var(--danger); opacity:0.6;">🗑️</button>
              </div>
            </div>
        `).join('');
    },

    async openTenderEdit(id = null, tab = 'edit') {
        const t = id ? StarkState.tenders.find(x => x.id === id) : { id: '', name: '', description: '', requirements: [] };
        StarkState.currentTender = t;
        
        $('#tenderId').value = t.id;
        $('#tenderName').value = t.name;
        $('#tenderDesc').value = t.description || '';
        
        const reqC = $('#reqContainer');
        reqC.innerHTML = '';
        (t.requirements || []).forEach(r => this.addReqInput(r));
        if (!t.requirements?.length) this.addReqInput();

        if (id) {
            const { data: v } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
            StarkState.detectedVacancies = v || [];
        } else {
            StarkState.detectedVacancies = [];
        }
        
        this.renderDetectedVacancies();
        this.switchTenderTab(tab);
        $('#tenderModal').classList.add('is-open');
    },

    switchTenderTab(tab) {
        const isIntel = tab === 'intel';
        $('#tenderEditContent').style.display = isIntel ? 'none' : 'block';
        $('#tenderIntelContent').style.display = isIntel ? 'block' : 'none';
        $('#tabTenderIntel').className = `tab ${isIntel ? 'active' : ''}`;
        $('#tabTenderEdit').className = `tab ${!isIntel ? 'active' : ''}`;
        if (isIntel) this.renderIntelReport();
    },

    async renderIntelReport() {
        const id = $('#tenderId').value;
        const info = $('#intelTenderInfo');
        const list = $('#intelVacancyList');
        const tender = StarkState.tenders.find(x => x.id === id);
        
        if (!id) return;
        info.textContent = tender?.description || "Iniciando análisis...";
        
        try {
            const pool = await StarkAPI.ensureTalentLoaded();
            const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
            const { data: sl } = await window.supabase.from('vacancy_shortlists').select('*').in('vacancy_id', (vacs||[]).map(v => v.id));

            list.innerHTML = (vacs || []).map(v => {
                const slCount = (sl || []).filter(s => s.vacancy_id === v.id).length;
                const pos = v.total_positions || 1;
                const pct = Math.round((slCount / pos) * 100);

                // Quick Match (Best in pool)
                let best = 0;
                [...pool.workers, ...pool.candidates].forEach(p => {
                    const score = p.id.length > 5 ? StarkScoring.scoreWorker(p, pool.credentials.filter(c => c.worker_id === p.id), v.requirements).score : StarkScoring.scoreCandidate(p, v.requirements).score;
                    if (score > best) best = score;
                });

                return `
                <div class="stark-card" style="padding:15px; margin-bottom:10px; border-left:3px solid ${pct>=100 ? 'var(--ok)':'var(--accent)'};">
                   <div style="display:flex; justify-content:space-between;">
                      <div>
                         <div style="font-size:10px; color:var(--accent); font-weight:900;">[ ${v.title.toUpperCase()} ]</div>
                         <div style="font-size:13px; font-weight:700; margin:5px 0;">${slCount} / ${pos} PUESTOS CUBIERTOS</div>
                         <div style="font-size:10px; color:var(--muted);">Aptitud del Pool: ${best}%</div>
                      </div>
                      <div style="text-align:right;">
                         <div style="font-size:18px; font-weight:900; color:var(--accent)">${pct}%</div>
                         <div style="font-size:9px; color:var(--muted);">DETECCIÓN</div>
                      </div>
                   </div>
                   <div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>
                </div>`;
            }).join('');
        } catch (err) { console.error(err); }
    },

    async openMatchmaking(tender) {
        if (!tender) return;
        $('#matchTitle').textContent = `OP: ${tender.name.toUpperCase()}`;
        $('#matchModal').classList.add('is-open');
        this.switchMatchTab('workers');

        const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', tender.id);
        const activeVacs = vacs?.length ? vacs : [{ id: 'global', title: 'OPERACIÓN GLOBAL', requirements: tender.requirements || [] }];

        const sel = $('#vacancySelector');
        sel.innerHTML = activeVacs.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
        sel.onchange = () => this.renderMatchmaker(tender, activeVacs[sel.value]);
        
        await this.renderMatchmaker(tender, activeVacs[0]);
    },

    async renderMatchmaker(tender, vacancy) {
        const pool = await StarkAPI.ensureTalentLoaded();
        const { data: sl } = await window.supabase.from('vacancy_shortlists').select('*').eq('vacancy_id', vacancy.id);
        const reqs = vacancy.requirements || [];

        // Workers
        const scoredW = pool.workers.map(w => {
            const creds = pool.credentials.filter(c => c.worker_id === w.id);
            const res = StarkScoring.scoreWorker(w, creds, reqs);
            return { w, ...res, isS: (sl||[]).some(s => s.person_id === w.id) };
        }).sort((a,b) => b.score - a.score);

        // Candidates
        const scoredC = pool.candidates.map(c => {
            const res = StarkScoring.scoreCandidate(c, reqs);
            return { w: { ...c, full_name: c.nombre_completo }, ...res, isS: (sl||[]).some(s => s.person_id === c.id) };
        }).sort((a,b) => b.score - a.score);

        $('#matchBodyWorkers').innerHTML = this.renderGrid(scoredW, vacancy.id, 'worker');
        $('#matchBodyCandidates').innerHTML = this.renderGrid(scoredC, vacancy.id, 'candidate');
        
        // Bind Shortlist events
        $('.modal-scroll').onclick = async (e) => {
            const btn = e.target.closest('[data-action="shortlist"]');
            if (btn) {
                const { vid, pid, type, score } = btn.dataset;
                try {
                    await StarkAPI.shortlist(vid, pid, type, parseInt(score));
                    window.notificar?.("PIPELINE ACTUALIZADO");
                    this.renderMatchmaker(tender, vacancy);
                } catch(err) { this.notifyError("Error en Preselección", err); }
            }
            const card = e.target.closest('.stark-card[data-person]');
            if (card && !e.target.closest('button')) {
                this.openProfile(card.dataset.person, card.dataset.type === 'worker' ? 'AFK' : 'EXT');
            }
        };
    },

    renderGrid(list, vacId, type) {
        return list.map(r => `
          <div class="stark-card" data-person="${r.w.id}" data-type="${type}" style="padding:15px; margin-bottom:10px; cursor:pointer; border: ${r.isS ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)'};">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
               <div>
                  <strong style="color:var(--text); font-size:14px;">${r.w.full_name.toUpperCase()}</strong>
                  <div style="font-size:9px; color:var(--muted); text-transform:uppercase; margin-top:2px;">${r.w.cargo || r.w.profesion || 'Perfil Operativo'}</div>
               </div>
               <div style="text-align:right;">
                  <span style="color:var(--accent); font-weight:900; font-size:16px;">${r.score}%</span>
                  <div style="font-size:8px; color:var(--muted);">MATCH</div>
               </div>
            </div>
            <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
            
            ${r.missing.length ? `<div style="font-size:9px; color:#ff3264; margin-top:10px; background:rgba(255,50,100,0.05); padding:5px 8px; border-radius:4px;">GAPS: ${r.missing.join(' • ')}</div>` : '<div style="font-size:9px; color:var(--ok); margin-top:10px;">[ COMPATIBILIDAD TOTAL ]</div>'}
            
            <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end;">
               ${!r.isS && vacId !== 'global' ? `<button data-action="shortlist" data-vid="${vacId}" data-pid="${r.w.id}" data-type="${type}" data-score="${r.score}" class="btn btn--mini primary">+ PRESELECCIONAR</button>` : `<span style="font-size:10px; font-weight:900; color:var(--accent);">[ SELECCIONADO ]</span>`}
            </div>
          </div>
        `).join('');
    },

    switchMatchTab(tab) {
        const isW = tab === 'workers';
        $('#matchBodyWorkers').style.display = isW ? 'block' : 'none';
        $('#matchBodyCandidates').style.display = isW ? 'none' : 'block';
        $('#tabWorkers').className = `tab ${isW ? 'active' : ''}`;
        $('#tabCandidates').className = `tab ${!isW ? 'active' : ''}`;
    },

    async handleTenderSubmit(e) {
        e.preventDefault();
        const data = {
            id: $('#tenderId').value,
            name: $('#tenderName').value,
            description: $('#tenderDesc').value,
            requirements: Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v)
        };
        try {
            await StarkAPI.saveTender(data, StarkState.detectedVacancies);
            window.notificar?.("ESTRATEGIA GUARDADA.");
            $('#tenderModal').classList.remove('is-open');
            this.loadAndRenderDashboard();
        } catch(err) { this.notifyError("No se pudo guardar la licitación.", err); }
    },

    renderDetectedVacancies() {
        const list = $('#vacanciesList');
        $('#vacanciesWrapper').style.display = StarkState.detectedVacancies.length ? 'block' : 'none';
        list.innerHTML = StarkState.detectedVacancies.map((v, i) => `
            <div class="stark-card vacancy-card" data-index="${i}" style="padding:15px; margin-bottom:8px; border-left: 2px solid var(--accent); display:flex; justify-content:space-between;">
              <div style="flex:1;">
                 <input class="input" value="${v.title}" style="background:transparent; border:none; font-weight:900; color:var(--accent); width:100%; border-bottom:1px solid rgba(255,255,255,0.05);" onchange="StarkState.detectedVacancies[${i}].title=this.value">
                 <div style="font-size:9px; color:var(--muted); margin-top:5px;">${(v.requirements || []).join(' • ')}</div>
              </div>
              <div style="width:70px; text-align:right;">
                 <input type="number" class="input" value="${v.total_positions || 1}" min="1" style="height:25px; text-align:center; background:rgba(0,0,0,0.2);" onchange="StarkState.detectedVacancies[${i}].total_positions=parseInt(this.value)">
                 <button type="button" class="btn btn--mini" data-action="remove-vacancy" style="color:var(--danger); margin-top:5px;">BORRAR</button>
              </div>
            </div>`).join('');
    },

    addReqInput(val = '') {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '8px'; div.style.marginBottom = '5px';
        div.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="this.parentElement.remove()">×</button>`;
        $('#reqContainer').appendChild(div);
    },

    async deleteTender(id) {
        if (!confirm('¿DESACTIVAR PROYECTO?')) return;
        try {
            await window.supabase.from('vacancies').delete().eq('tender_id', id);
            await window.supabase.from('tenders').delete().eq('id', id);
            this.loadAndRenderDashboard();
        } catch(err) { this.notifyError("Fallo al eliminar.", err); }
    },

    async openProfile(id, type) {
        const radar = $('#scannerOverlay');
        if (radar) radar.style.display = 'flex';
        $('#personProfileModal').classList.add('is-open');
        try {
            const table = (type === 'AFK') ? 'workers' : 'candidates';
            const { data: p } = await window.supabase.from(table).select('*').eq('id', id).single();
            if (p) {
                $('#profileName').textContent = (p.full_name || p.nombre_completo || 'S/I').toUpperCase();
                $('#profileProfession').textContent = p.cargo || p.profesion || 'Perfil Operativo';
                $('#profileRut').textContent = p.rut || '-';
                $('#profileEmail').textContent = p.email || p.correo || '-';
                $('#profilePhone').textContent = p.phone || p.telefono || '-';
                $('#profileCvSummary').innerHTML = p.evaluacion_general || p.perfil_profesional || 'Análisis Stark completado.';
                $('#profileStatus').textContent = p.status || `NOTA: ${p.nota || 'S/N'}`;
                $('#profileEditBtn').onclick = () => window.location.href = (type === 'AFK') ? `worker.html?id=${id}` : `candidate.html?id=${id}`;
            }
        } catch(err) {} 
        setTimeout(() => { if(radar) radar.style.display = 'none'; }, 800);
    },

    notifyError(m, e) {
        console.error(m, e);
        window.notificar?.(`ERROR: ${m}`);
    },

    escape(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  };

  StarkUI.init();
})();
