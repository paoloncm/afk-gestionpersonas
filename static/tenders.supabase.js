/** 
 * tenders.supabase.js - Protocolo Stark Intelligence V19 (UI/UX Recovery) 
 */

(function () {
  const $ = (s) => document.querySelector(s);
  
  const REQUIREMENT_ALIASES = {
    "altura fisica": ["altura fisica", "trabajo en altura", "altfis", "altura"],
    "silice": ["silice", "sílice", "silicosis"],
    "ruido": ["ruido", "hipoacusia"],
    "infpsico": ["infpsico", "informe psicologico", "psicologico", "evaluacion psicologica"],
    "prevencion": ["prevencion", "prevencionista", "riesgos"],
  };

  const StarkState = {
    tenders: [],
    currentTender: null,
    detectedVacancies: [],
    talentPool: { workers: null, credentials: null, candidates: null, lastLoaded: null }
  };

  const StarkScoring = {
    normalizeText(v) { return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim(); },
    matchesRequirement(source, req) {
        const ns = this.normalizeText(source), nr = this.normalizeText(req);
        return (REQUIREMENT_ALIASES[nr]||[nr]).some(a => ns.includes(this.normalizeText(a)));
    },
    scoreWorker(w, creds, reqs) {
        const src = (creds||[]).map(c => c.credential_name||"").join(" ");
        const miss = (reqs||[]).filter(r => !this.matchesRequirement(src, r));
        return { score: reqs.length ? Math.round(((reqs.length - miss.length) / reqs.length) * 100) : 0, missing: miss };
    },
    scoreCandidate(c, reqs) {
        const src = [c.profesion, c.evaluacion_general, c.experiencia_general, c.experiencia_especifica, c.cargo_a_desempenar].join(" ");
        const miss = (reqs||[]).filter(r => !this.matchesRequirement(src, r));
        return { score: reqs.length ? Math.round(((reqs.length - miss.length) / reqs.length) * 100) : 0, missing: miss };
    }
  };

  const StarkProcessor = {
    async process(file) {
        this.updateRadar("INICIANDO MATRIX SCAN...", "Accediendo al binario del pliego...");
        const text = await this.extractText(file);
        this.updateRadar("EXTRACCIÓN COMPLETADA", `Analizando con JARVIS AI...`);
        return await this.analyzeTender(text);
    },
    async extractText(file) {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let txt = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            this.updateRadar(`ESCANEANDO PÁGINA ${i}/${pdf.numPages}`, "Detectando jerarquía...");
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            txt += content.items.map(it => it.str).join(" ") + "\n";
        }
        return txt;
    },
    async analyzeTender(text) {
        const res = await fetch('/api/analyze-tender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.substring(0, 30000) }) });
        const data = await res.json();
        if (!data.ok) throw new Error(data.detail);
        return data.analysis;
    },
    updateRadar(t, l) { if ($('#radarText')) $('#radarText').textContent = t; if ($('#radarLog')) $('#radarLog').textContent = l; }
  };

  const StarkAPI = {
    async ensureTalent() {
        const c = StarkState.talentPool; if (c.lastLoaded && (Date.now()-c.lastLoaded < 60000)) return c;
        const [w, cr, cd] = await Promise.all([window.supabase.from('workers').select('*'), window.supabase.from('worker_credentials').select('*'), window.supabase.from('candidates').select('*')]);
        c.workers = w.data||[]; c.credentials = cr.data||[]; c.candidates = cd.data||[]; c.lastLoaded = Date.now(); return c;
    },
    async save(tender, vacs) {
        const { id, name, description, requirements } = tender;
        const { data: tRes, error: tErr } = id ? await window.supabase.from('tenders').update({ name, description, requirements }).eq('id', id).select() : await window.supabase.from('tenders').insert({ name, description, requirements }).select();
        if (tErr) throw tErr;
        const tid = id || tRes[0].id;
        const { data: exV } = await window.supabase.from('vacancies').select('id').eq('tender_id', tid);
        const exIds = (exV||[]).map(v => v.id), nIds = vacs.map(v => v.id).filter(i => i);
        const toDel = exIds.filter(i => !nIds.includes(i));
        if (toDel.length) await window.supabase.from('vacancies').delete().in('id', toDel);
        await window.supabase.from('vacancies').upsert(vacs.map(v => ({ id: v.id||undefined, tender_id: tid, title: v.title, requirements: v.requirements, total_positions: v.total_positions||1 })));
    }
  };

  const StarkUI = {
    async init() { this.bind(); await this.load(); },
    bind() {
        const b = (s, e, f) => { const el = $(s); if (el) el[e] = f; };
        b('#btnNewTender', 'onclick', () => this.openEdit());
        b('#searchTender', 'oninput', () => this.render());
        b('#tabTenderEdit', 'onclick', () => this.switchTab('edit'));
        b('#tabTenderIntel', 'onclick', () => this.switchTab('intel'));
        b('#tabWorkers', 'onclick', () => this.switchMatch('workers'));
        b('#tabCandidates', 'onclick', () => this.switchMatch('candidates'));
        b('#tenderForm', 'onsubmit', (e) => this.submit(e));
        
        document.querySelectorAll('.close-modal').forEach(c => c.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
        });

        const tb = $('#tendersBody'), zo = $('#uploadZone'), pi = $('#pdfInput');
        if (tb) tb.onclick = (e) => {
            const r = e.target.closest('.t-row'); if (!r) return;
            if (e.target.closest('.btn-match')) this.openMatch(StarkState.tenders.find(t => t.id === r.dataset.id));
            else if (e.target.closest('.btn-delete')) this.delete(r.dataset.id);
            else this.openEdit(r.dataset.id, 'intel');
        };
        if (zo && pi) {
            zo.onclick = () => pi.click();
            pi.onchange = (e) => this.handleFile(e.target.files[0]);
            zo.ondragover = (e) => { e.preventDefault(); zo.style.borderColor = 'var(--accent)'; zo.style.background = 'rgba(34,211,238,0.1)'; };
            zo.ondragleave = () => { zo.style.borderColor = 'var(--border)'; zo.style.background = 'rgba(255,255,255,0.02)'; };
            zo.ondrop = (e) => { e.preventDefault(); zo.style.borderColor = 'var(--border)'; const f = e.dataTransfer.files[0]; if (f?.type==='application/pdf') this.handleFile(f); };
        }
    },
    async handleFile(f) {
        if (!f) return; $('#scannerOverlay').style.display = 'flex';
        try {
            const a = await StarkProcessor.process(f);
            $('#tenderName').value = `Licitación: ${a.roles[0]?.nombre || f.name.replace('.pdf','')}`;
            $('#tenderDesc').value = a.tender_summary || "";
            
            // Populate Global Reqs
            $('#reqContainer').innerHTML = '';
            (a.roles[0]?.requisitos || []).slice(0, 5).forEach(r => this.addReq(r));
            
            StarkState.detectedVacancies = a.roles.map(r => ({ 
                title: r.nombre, 
                requirements: [...(r.requisitos||[]), ...(r.certificaciones||[]), r.experiencia_minima].filter(v=>v), 
                total_positions: r.cantidad||1 
            }));
            this.renderVacs();
            window.notificar?.("INTEGRACIÓN NIVEL STARK COMPLETADA");
        } catch (e) { window.notificar?.("ERROR EN SCAN"); }
        $('#scannerOverlay').style.display = 'none';
    },
    async load() {
        if (!window.supabase) return setTimeout(() => this.load(), 500);
        const { data } = await window.supabase.from('tenders').select('*').order('created_at', { ascending: false });
        StarkState.tenders = data||[]; this.render();
    },
    render() {
        const q = ($('#searchTender')?.value||"").toLowerCase();
        $('#tendersBody').innerHTML = StarkState.tenders.filter(t => (t.name||"").toLowerCase().includes(q) || (t.description||"").toLowerCase().includes(q)).map(t => `
            <div class="t-row stark-card" data-id="${t.id}" style="margin-bottom:10px; padding:18px 20px; display:flex; align-items:center; cursor:pointer;">
              <div style="flex:0 0 25%; font-weight:800; color:var(--accent)">[ ${this.escape(t.name)} ]</div>
              <div style="flex:0 0 35%; color:var(--muted); font-size:11px;">${this.escape(t.description||'')}</div>
              <div style="flex:1; display:flex; flex-wrap:wrap; gap:5px;">${(t.requirements||[]).slice(0,3).map(r => `<span class="badge" style="font-size:10px;">${r}</span>`).join('')}</div>
              <div style="flex:0 0 150px; display:flex; gap:8px; justify-content:flex-end;">
                 <button class="btn btn--mini btn--primary btn-match">[ MATCH ]</button>
                 <button class="btn btn--mini btn-delete" style="color:var(--danger)">🗑️</button>
              </div>
            </div>`).join('');
    },
    async openEdit(id=null, tab='edit') {
        const t = id ? StarkState.tenders.find(x => x.id === id) : { id:'', name:'', description:'', requirements:[] };
        $('#tenderId').value = t.id; $('#tenderName').value = t.name; $('#tenderDesc').value = t.description||'';
        $('#reqContainer').innerHTML = ''; (t.requirements||[]).forEach(r => this.addReq(r)); if (!t.requirements?.length) this.addReq();
        if (id) { const { data } = await window.supabase.from('vacancies').select('*').eq('tender_id', id); StarkState.detectedVacancies = data||[]; }
        else StarkState.detectedVacancies = [];
        this.renderVacs(); this.switchTab(tab); $('#tenderModal').classList.add('is-open');
    },
    switchTab(tab) {
        const isI = tab === 'intel';
        $('#tenderEditContent').style.display = isI ? 'none' : 'flex';
        $('#tenderIntelContent').style.display = isI ? 'flex' : 'none';
        $('#tabTenderIntel').className = `tab ${isI ? 'active' : ''}`;
        $('#tabTenderEdit').className = `tab ${!isI ? 'active' : ''}`;
        if (isI) this.renderIntel();
    },
    async renderIntel() {
        const id = $('#tenderId').value; const pool = await StarkAPI.ensureTalent();
        const { data: vacs } = await window.supabase.from('vacancies').select('*').eq('tender_id', id);
        const { data: sl } = await window.supabase.from('vacancy_shortlists').select('*').in('vacancy_id', (vacs||[]).map(v => v.id));
        $('#intelVacancyList').innerHTML = (vacs||[]).map(v => {
            const c = (sl||[]).filter(s => s.vacancy_id === v.id).length, p = v.total_positions||1, pct = Math.round((c/p)*100);
            return `<div class="stark-card" style="padding:15px; margin-bottom:10px; border-left:3px solid ${pct>=100 ? 'var(--ok)':'var(--accent)'};">
               <div style="display:flex; justify-content:space-between;">
                  <div><div style="font-size:10px; font-weight:900;">[ ${v.title.toUpperCase()} ]</div><div style="font-size:13px; font-weight:700;">${c} / ${p} PUESTOS</div></div>
                  <div style="font-size:18px; font-weight:900;">${pct}%</div>
               </div>
               <div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    },
    async openMatch(t) {
        if (!t) return; $('#matchTitle').textContent = t.name.toUpperCase(); $('#matchModal').classList.add('is-open'); this.switchMatch('workers');
        const { data: v } = await window.supabase.from('vacancies').select('*').eq('tender_id', t.id);
        const act = v?.length ? v : [{ id:'global', title:'OPERACIÓN GLOBAL', requirements: t.requirements||[] }];
        $('#vacancySelector').innerHTML = act.map((v, i) => `<option value="${i}">[ ${v.title.toUpperCase()} ]</option>`).join('');
        $('#vacancySelector').onchange = () => this.renderMatchmaker(t, act[$('#vacancySelector').value]);
        this.renderMatchmaker(t, act[0]);
    },
    async renderMatchmaker(t, v) {
        const p = await StarkAPI.ensureTalent(); const { data: sl } = await window.supabase.from('vacancy_shortlists').select('*').eq('vacancy_id', v.id);
        const sw = p.workers.map(w => ({ w, ...StarkScoring.scoreWorker(w, p.credentials.filter(c => c.worker_id === w.id), v.requirements||[]), isS: (sl||[]).some(s => s.person_id === w.id) })).sort((a,b)=>b.score-a.score);
        const sc = p.candidates.map(c => ({ w: { ...c, full_name: c.nombre_completo }, ...StarkScoring.scoreCandidate(c, v.requirements||[]), isS: (sl||[]).some(s => s.person_id === c.id) })).sort((a,b)=>b.score-a.score);
        $('#matchBodyWorkers').innerHTML = this.renderGrid(sw, v.id, 'worker'); $('#matchBodyCandidates').innerHTML = this.renderGrid(sc, v.id, 'candidate');
        $('.modal-scroll').onclick = async (e) => {
            const b = e.target.closest('[data-action="shortlist"]');
            if (b) { await window.supabase.from('vacancy_shortlists').upsert({ vacancy_id: b.dataset.vid, person_id: b.dataset.pid, person_type: b.dataset.type, score: parseInt(b.dataset.score) }); this.renderMatchmaker(t, v); }
            const c = e.target.closest('.stark-card[data-person]');
            if (c && !e.target.closest('button')) this.openProfile(c.dataset.person, c.dataset.type==='worker'?'AFK':'EXT');
        };
    },
    renderGrid(l, vid, ty) {
        return l.map(r => `<div class="stark-card" data-person="${r.w.id}" data-type="${ty}" style="padding:15px; margin-bottom:10px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between;"><div><strong>${r.w.full_name.toUpperCase()}</strong></div><div><span style="color:var(--accent)">${r.score}%</span></div></div>
            <div class="affinity-bar"><div class="affinity-fill" style="width:${r.score}%"></div></div>
            ${r.missing.length ? `<div style="font-size:8px; color:#ff3264;">GAP: ${r.missing.join(' • ')}</div>` : ''}
            <div style="margin-top:10px; text-align:right;">${!r.isS && vid !== 'global' ? `<button data-action="shortlist" data-vid="${vid}" data-pid="${r.w.id}" data-type="${ty}" data-score="${r.score}" class="btn btn--mini primary">+ PRESEL</button>` : `<span style="font-size:10px; color:var(--accent);">[ OK ]</span>`}</div>
        </div>`).join('');
    },
    switchMatch(tab) {
        const isW = tab === 'workers'; $('#matchBodyWorkers').style.display = isW ? 'block' : 'none'; $('#matchBodyCandidates').style.display = isW ? 'none' : 'block';
        $('#tabWorkers').className = `tab ${isW ? 'active' : ''}`; $('#tabCandidates').className = `tab ${!isW ? 'active' : ''}`;
    },
    async submit(e) {
        e.preventDefault(); const d = { id: $('#tenderId').value, name: $('#tenderName').value, description: $('#tenderDesc').value, requirements: Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v) };
        try { await StarkAPI.save(d, StarkState.detectedVacancies); $('#tenderModal').classList.remove('is-open'); this.load(); } catch(e) { window.notificar?.("ERROR AL GUARDAR"); }
    },
    renderVacs() {
        const w = $('#vacanciesWrapper'); if (!w) return;
        w.style.display = StarkState.detectedVacancies.length ? 'block' : 'none';
        $('#vacanciesList').innerHTML = StarkState.detectedVacancies.map((v, i) => `
            <div class="stark-card" style="padding:15px; margin-bottom:8px; border-left:2px solid var(--accent); display:flex; justify-content:space-between; align-items:center;">
              <div style="flex:1;">
                 <input class="input" value="${v.title}" style="background:transparent; border:none; font-weight:900; color:var(--accent); width:100%; border-bottom:1px solid rgba(255,255,255,0.05);" onchange="StarkState.detectedVacancies[${i}].title=this.value">
                 <div style="font-size:9px; color:var(--muted); margin-top:4px;">${(v.requirements||[]).join(' • ')}</div>
              </div>
              <div style="width:60px; margin:0 15px;">
                 <input type="number" class="input" value="${v.total_positions||1}" onchange="StarkState.detectedVacancies[${i}].total_positions=parseInt(this.value)" style="background:rgba(0,0,0,0.2); text-align:center;">
              </div>
              <button type="button" class="btn btn--mini" onclick="StarkUI.removeVac(${i})" style="color:var(--danger)">×</button>
            </div>`).join('');
    },
    removeVac(i) {
        StarkState.detectedVacancies.splice(i, 1);
        this.renderVacs();
    },
    addReq(val = '') {
        const d = document.createElement('div'); d.style.display = 'flex'; d.style.gap = '8px'; d.style.marginBottom = '5px';
        d.innerHTML = `<input class="input req-input" value="${val}" placeholder="Requisito..." required style="flex:1;"><button type="button" class="btn btn--mini" style="color:var(--danger)" onclick="this.parentElement.remove()">×</button>`;
        $('#reqContainer').appendChild(d);
    },
    async delete(id) { if (confirm('¿ELIMINAR?')) { await window.supabase.from('vacancies').delete().eq('tender_id', id); await window.supabase.from('tenders').delete().eq('id', id); this.load(); } },
    async openProfile(id, ty) {
        $('#scannerOverlay').style.display = 'flex'; $('#personProfileModal').classList.add('is-open');
        try {
            const { data: p } = await window.supabase.from(ty==='AFK'?'workers':'candidates').select('*').eq('id', id).single();
            if (p) { $('#profileName').textContent = (p.full_name || p.nombre_completo || '').toUpperCase(); $('#profileCvSummary').innerHTML = p.evaluacion_general || p.perfil_profesional || ''; $('#profileEditBtn').onclick = () => window.location.href = ty==='AFK' ? `worker.html?id=${id}` : `candidate.html?id=${id}`; }
        } catch(e) {} 
        setTimeout(() => { if($('#scannerOverlay')) $('#scannerOverlay').style.display = 'none'; }, 800);
    },
    escape(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  };

  // Expose removeVac for global onclick use
  window.StarkUI = StarkUI;
  StarkUI.init();
})();
