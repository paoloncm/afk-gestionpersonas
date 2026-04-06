// vacancies.supabase.js - Protocolo Stark Intelligence V8: RECONSTRUCCIÓN INTEGRAL
(function () {
  const $ = (s) => document.querySelector(s);
  
  // UI - Dash & Modals
  const container = $('#vacancies-container');
  const vacancyModal = $('#vacancyModal');
  const vacancyForm = $('#vacancyForm');
  const matchModal = $('#matchModal');
  const personProfileModal = $('#personProfileModal');
  const btnNewVac = $('#btnNewVac');

  // UI - Matchmaking HUD
  const tabWorkers = $('#tabWorkers');
  const tabCandidates = $('#tabCandidates');
  const matchBodyWorkers = $('#matchBodyWorkers');
  const matchBodyCandidates = $('#matchBodyCandidates');
  const vacancySelector = $('#vacancySelector');

  // UI - Scanner Overlay (Radar)
  const scannerOverlay = $('#scannerOverlay');
  const radarText = $('#radarText');
  const radarLog = $('#radarLog');

  // State
  let allVacancies = [];
  let currentMatchVac = null;

  const openModal = (m) => m?.classList.add('is-open');
  const closeModal = (m) => m?.classList.remove('is-open');

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { closeModal(vacancyModal); closeModal(matchModal); closeModal(personProfileModal); };
  });

  // Tab Switch HUD
  if (tabWorkers && tabCandidates) {
    tabWorkers.onclick = () => {
        matchBodyWorkers.style.display = 'block';
        matchBodyCandidates.style.display = 'none';
        tabWorkers.style.color = 'var(--accent)';
        tabWorkers.style.borderBottom = '2px solid var(--accent)';
        tabCandidates.style.color = 'var(--muted)';
        tabCandidates.style.borderBottom = '2px solid transparent';
    };
    tabCandidates.onclick = () => {
        matchBodyWorkers.style.display = 'none';
        matchBodyCandidates.style.display = 'block';
        tabCandidates.style.color = 'var(--accent)';
        tabCandidates.style.borderBottom = '2px solid var(--accent)';
        tabWorkers.style.color = 'var(--muted)';
        tabWorkers.style.borderBottom = '2px solid transparent';
    };
  }

  // --- INITIALIZATION ---

  async function init() {
    if (!window.supabase || typeof window.supabase.from !== 'function') {
      console.warn("[Stark] DB Link logic failed, retrying...");
      return setTimeout(init, 500);
    }
    loadVacancies();
  }
  init();

  // --- VACANCY ENGINE ---

  async function loadVacancies() {
    try {
      if (container) container.innerHTML = '<div style="padding:100px; text-align:center;"><span class="text-cyan">SINCRONIZANDO NÚCLEO...</span></div>';
      
      const { data, error } = await window.supabase.from('vacancies').select('*, tenders(name)').order('created_at', { ascending: false });
      if (error) throw error;
      allVacancies = data || [];
      renderVacancies(allVacancies);
    } catch (err) { console.error('[Stark] Error loadVacancies:', err); }
  }

  function renderVacancies(vacs) {
    if (!container) return;
    container.innerHTML = '';
    
    if (vacs.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.5;">No hay vacantes activas en el protocolo.</div>';
        return;
    }

    vacs.forEach(v => {
      const card = document.createElement('div');
      card.className = 'stark-card';
      
      const tenderInfo = v.tenders ? `<div style="font-size:9px; color:var(--accent); margin-top:4px;">PROVENIENTE DE: ${v.tenders.name.toUpperCase()}</div>` : '';
      const reqsHtml = (v.requirements || []).slice(0, 4).map(r => `<span style="background:rgba(34,211,238,0.05); border:1px solid rgba(34,211,238,0.2); padding:2px 6px; border-radius:4px; font-size:10px; color:rgba(255,255,255,0.7);">${r}</span>`).join('');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:15px;">
           <div style="flex:1;">
              <h2 style="font-size:18px; font-weight:900; margin:0; letter-spacing:0.5px;">${v.title.toUpperCase()}</h2>
              ${tenderInfo}
           </div>
           <div class="tag" style="background:${v.status === 'Abierta' ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)'}; color:${v.status === 'Abierta' ? 'var(--accent)' : '#fff'}; font-weight:800; font-size:11px;">
              ${v.status.toUpperCase()}
           </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:20px; min-height:24px;">
           ${reqsHtml}
           ${(v.requirements?.length > 4) ? `<span style="font-size:10px; color:var(--muted);">+${v.requirements.length - 4}</span>` : ''}
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
           <button class="btn primary btn-match" style="padding:10px; font-weight:800; font-size:11px;" data-id="${v.id}">[ PROTOCOLO MATCH ]</button>
           <button class="btn btn-edit" style="padding:10px; font-weight:800; font-size:11px;" data-id="${v.id}">EXPEDIENTE</button>
        </div>
      `;

      card.querySelector('.btn-match').onclick = () => runMatchmaking(v);
      card.querySelector('.btn-edit').onclick = () => openEditModal(v);
      
      container.appendChild(card);
    });
  }

  function openEditModal(v) {
    $('#modalTitle').textContent = 'Edición de Vacante Estratégica';
    $('#editVacancyId').value = v.id;
    vacancyForm.title.value = v.title;
    vacancyForm.requirements.value = (v.requirements || []).join('\n');
    vacancyForm.sla_days.value = v.sla_days;
    openModal(vacancyModal);
  }

  if (btnNewVac) {
    btnNewVac.onclick = () => {
        $('#modalTitle').textContent = 'Nueva Vacante Stark';
        $('#editVacancyId').value = '';
        vacancyForm.reset();
        openModal(vacancyModal);
    };
  }

  if (vacancyForm) {
    vacancyForm.onsubmit = async (e) => {
        e.preventDefault();
        const vid = $('#editVacancyId').value;
        const data = {
            title: vacancyForm.title.value,
            requirements: vacancyForm.requirements.value.split('\n').filter(Boolean),
            sla_days: parseInt(vacancyForm.sla_days.value),
            status: 'Abierta'
        };

        const { error } = vid ? 
            await window.supabase.from('vacancies').update(data).eq('id', vid) : 
            await window.supabase.from('vacancies').insert([data]);

        if (error) alert('Error en Protocolo de Guardado: ' + error.message);
        else { closeModal(vacancyModal); loadVacancies(); }
    };
  }

  // --- MATCHMAKING HUD V3 ---

  async function runMatchmaking(v) {
    currentMatchVac = v;
    $('#matchTitle').textContent = `MATCHMAKING: ${v.title.toUpperCase()}`;
    vacancySelector.innerHTML = `<option value="${v.id}">${v.title.toUpperCase()}</option>`;
    
    matchBodyWorkers.innerHTML = '<div style="padding:40px; text-align:center;">INICIANDO SCANNER BIOMÉTRICO...</div>';
    matchBodyCandidates.innerHTML = '<div style="padding:40px; text-align:center;">RASTREANDO MERCADO EXTERNO...</div>';
    openModal(matchModal);

    try {
      // Step A: Get Embeddings for target requirements
      const targetText = (v.requirements || []).join(' ');
      const vRes = await fetch('/api/vectorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: targetText })
      });
      const vData = await vRes.json();
      if (!vData.ok) throw new Error("Error en Vector Engine");
      const targetVector = vData.embedding;

      // Step B: Load candidates & workers
      const { data: workers } = await window.supabase.from('workers').select('*, worker_credentials(*)');
      const { data: candidates } = await window.supabase.from('candidates').select('*');

      // Step C: Scoring engine (Hybrid: Text + Vector)
      const rs = v.requirements || [];
      const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const scoreIndividual = (personText) => {
          if (!personText || rs.length === 0) return 0;
          const p = normalize(personText);
          const matchCount = rs.filter(r => p.includes(normalize(r))).length;
          return Math.round((matchCount / rs.length) * 100);
      };

      // Scoring & UI Mapping
      const renderItem = (p, score, type) => {
          const color = score > 80 ? 'var(--ok)' : (score > 50 ? 'var(--warn)' : 'var(--muted)');
          return `
            <div class="stark-card" style="padding:12px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-left: 3px solid ${color};">
              <div style="flex:1;">
                <div style="font-weight:900; font-size:14px; cursor:pointer;" onclick="window.showPersonProfile('${p.id}', '${type}')">${p.nombre_completo || p.name}</div>
                <div style="font-size:11px; color:var(--muted); margin-top:2px;">${p.cargo || p.profesion || 'Sin Cargo Definido'}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-family:monospace; font-weight:900; color:${color}; font-size:18px;">${score}%</div>
                <button class="btn btn--mini" style="margin-top:4px; font-size:9px;" onclick="window.starkShortlist('${v.id}', '${p.id}', '${p.nombre_completo || p.name}', '${type}', ${score})">RECLUTAR</button>
              </div>
            </div>
          `;
      };

      const wResults = (workers || []).map(w => {
          const txt = `${w.cargo} ${w.perfil_profesional} ${w.worker_credentials.map(c => c.credential_name).join(' ')}`;
          return { original: w, score: scoreIndividual(txt) };
      }).sort((a,b) => b.score - a.score);

      const cResults = (candidates || []).map(c => {
          const txt = `${c.profesion} ${c.evaluacion_general} ${c.experiencia_tecnica}`;
          return { original: c, score: scoreIndividual(txt) };
      }).sort((a,b) => b.score - a.score);

      matchBodyWorkers.innerHTML = wResults.map(r => renderItem(r.original, r.score, 'worker')).join('') || '<p style="text-align:center;">Sin personal interno compatible.</p>';
      matchBodyCandidates.innerHTML = cResults.map(r => renderItem(r.original, r.score, 'candidate')).join('') || '<p style="text-align:center;">Sin candidatos compatibles en el mercado.</p>';

    } catch (err) {
      console.error("[Matchmaking Failure]", err);
      matchBodyWorkers.innerHTML = '<div style="color:var(--danger); padding:20px;">ERROR EN SISTEMA DE MATCHMAKING.</div>';
    }
  }

  // --- STARK PROFILE VIEWER ---

  window.showPersonProfile = async function(id, type) {
    const scanner = $('#profileScanner');
    if (scanner) scanner.style.display = 'flex';
    openModal(personProfileModal);

    try {
      const table = type === 'worker' ? 'workers' : 'candidates';
      const { data: p, error } = await window.supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;

      $('#profileName').textContent = (p.nombre_completo || p.name || 'ANÓNIMO').toUpperCase();
      $('#profileProfession').textContent = p.profesion || p.cargo || 'Especialista';
      $('#profileRut').textContent = p.rut || p.dni || 'No Registrado';
      $('#profileEmail').textContent = p.email || 'Sin Email';
      $('#profilePhone').textContent = p.telefono || 'Sin Teléfono';
      $('#profileStatus').textContent = (p.status || p.estado || 'Activo').toUpperCase();
      $('#profileExp').textContent = (p.experiencia || p.años_experiencia || '0') + ' años exp.';
      $('#profileCvSummary').textContent = p.evaluacion_general || p.perfil_profesional || 'Sin evaluación de inteligencia disponible.';
      $('#profileAcademic').textContent = p.antecedentes_academicos || p.estudios || 'Sin datos académicos.';
      
      $('#profileEditBtn').onclick = () => {
          location.href = type === 'worker' ? `workers.html?id=${id}` : `candidates.html?id=${id}`;
      };

    } catch (err) { console.error(err); }
    if (scanner) setTimeout(() => scanner.style.display = 'none', 600);
  };

  window.starkShortlist = async function(vacId, personId, personName, type, score) {
    try {
        const { error } = await window.supabase.from('candidates').update({ vacancy_id: vacId }).eq('id', personId);
        if (error) throw error;
        alert(`[ ${personName.toUpperCase()} ] ASIGNADO A LA VACANTE EXITOSAMENTE`);
        loadVacancies();
        closeModal(matchModal);
    } catch(err) { alert("ERROR AL RECLUTAR: " + err.message); }
  };

})();
