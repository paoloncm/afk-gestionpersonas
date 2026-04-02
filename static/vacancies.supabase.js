// vacancies.supabase.js
(async function() {
    const $ = s => document.querySelector(s);
    const container = $('#vacancies-container');
    const btnNew = $('#btnNewVac');
    const modal = $('#vacancyModal');
    const form = $('#vacancyForm');

    async function init() {
        if (!window.supabase) {
            console.warn('Waiting for Supabase in vacancies.js...');
            setTimeout(init, 500);
            return;
        }
        console.log('Supabase ready in vacancies.js');
        loadVacancies();
    }
    init();

    async function loadVacancies() {
        if (container) container.innerHTML = '<div style="padding:40px; text-align:center;">SINCRONIZANDO MATRIZ DE VACANTES...</div>';

        // Fetch Tenders, Vacancies, and Candidates
        const { data: tenders, error: tErr } = await supabase.from('tenders').select('id, name').order('name');
        const { data: vacancies, error: vErr } = await supabase.from('vacancies').select('*').order('created_at', { ascending: false });
        const { data: allCandi } = await supabase.from('candidates').select('*').not('vacancy_id', 'is', null);

        if (vErr) {
            console.error('Error cargando vacantes:', vErr);
            if (vErr.code === '42P01') renderSetupMessage(vErr);
            return;
        }

        // Grouping Logic
        const grouped = {};
        
        // Ensure "Global" group exists first
        grouped['GLOBAL'] = { name: '[ OPERACIONES_GLOBALES ]', vacancies: [] };
        
        (tenders || []).forEach(t => {
            grouped[t.id] = { name: `OPERACIÓN: ${t.name.toUpperCase()}`, vacancies: [] };
        });

        (vacancies || []).forEach(v => {
            const vWithCandi = {
                ...v,
                candidates: (allCandi || []).filter(c => c.vacancy_id === v.id)
            };
            const targetGroup = v.tender_id && grouped[v.tender_id] ? v.tender_id : 'GLOBAL';
            grouped[targetGroup].vacancies.push(vWithCandi);
        });

        renderGroupedVacancies(grouped);
    }

    function renderGroupedVacancies(grouped) {
        container.innerHTML = `<h1 class="h1">Gestión de Vacantes</h1>`;

        Object.keys(grouped).forEach(groupId => {
            const group = grouped[groupId];
            if (group.vacancies.length === 0) return; // Skip empty groups

            const section = document.createElement('section');
            section.className = 'tender-group';
            section.style.marginBottom = '40px';
            section.style.animation = 'fadeIn 0.6s ease';

            const header = document.createElement('div');
            header.className = 'stark-group-header';
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.gap = '15px';
            header.style.padding = '15px 20px';
            header.style.background = 'linear-gradient(90deg, rgba(34,211,238,0.1), transparent)';
            header.style.borderLeft = '4px solid var(--accent)';
            header.style.marginBottom = '20px';
            header.style.borderRadius = '0 8px 8px 0';

            header.innerHTML = `
                <div style="font-family:'JetBrains Mono', monospace; font-size:10px; color:var(--accent); font-weight:800; border:1px solid var(--accent); padding:2px 6px; border-radius:4px;">GRUP_ID: ${groupId.substring(0,4)}</div>
                <h2 style="margin:0; font-size:18px; letter-spacing:1px; color:var(--text);">${group.name}</h2>
                <div style="margin-left:auto; font-size:10px; color:var(--muted);">${group.vacancies.length} POSICIONES ACTIVAS</div>
            `;
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'grid-2'; 
            grid.style.display = 'grid';
            grid.style.gap = '20px';

            group.vacancies.forEach(v => {
                const card = createVacancyCard(v);
                grid.appendChild(card);
            });

            section.appendChild(grid);
            container.appendChild(section);
        });
    }

    function createVacancyCard(v) {
        const card = document.createElement('div');
        card.className = 'card stark-card';
        card.style.cursor = 'default';
        card.style.background = 'rgba(15,23,42,0.4)';
        card.style.backdropFilter = 'blur(10px)';
        
        let shortlist = [];
        try {
            if (typeof v.shortlisted_candidates === 'string') shortlist = JSON.parse(v.shortlisted_candidates);
            else if (Array.isArray(v.shortlisted_candidates)) shortlist = v.shortlisted_candidates;
        } catch(e) {}

        const oldCandidates = (v.candidates || []).map(c => ({
            id: c.id,
            name: c.nombre_completo,
            type: 'AFK LEGACY',
            score: 'N/A',
            status: c.status || c.estado || 'Postulado'
        }));

        const combinedList = [...oldCandidates, ...shortlist].reduce((acc, curr) => {
            if(!acc.some(item => item.id === curr.id)) acc.push(curr);
            return acc;
        }, []);

        const candidatesCount = combinedList.length;
        const candidatesHtml = combinedList.map(c => `
            <div style="display:flex; justify-content:space-between; font-size:12px; padding: 12px 8px; border-bottom: 1px dashed rgba(255,255,255,0.05); align-items:center;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span style="color:var(--primary); font-weight:700;">${(c.name || '').toUpperCase()}</span>
                    <span style="font-size:9px; color:var(--muted); opacity:0.8;">[ TIPO: ${c.type || 'AFK'} ]</span>
                </div>
                <div style="text-align:right;">
                    <span class="tag" style="font-size:10px; padding: 4px 8px; background:rgba(34,211,238,0.1); border:1px solid rgba(34,211,238,0.3); color:var(--accent)">
                        MATCH: ${c.score || '0'}%
                    </span>
                </div>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="card__body">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h2 class="h1" style="font-size:20px; margin-bottom:4px;">${v.title}</h2>
                        <div class="text-muted" style="font-size:12px;">SLA_ESTIMADO: ${v.sla_days} días</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:end; gap:8px;">
                        <div class="tag" style="background: ${v.status === 'Abierta' ? 'rgba(0,255,100,0.1)' : 'rgba(255,255,255,0.05)'}; color: ${v.status === 'Abierta' ? '#00ff64' : '#fff'}">
                            ${v.status.toUpperCase()}
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button class="btn btn-edit-vac" style="padding:4px 8px; font-size:10px; background:rgba(255,255,255,0.05)">Editar</button>
                            <button class="btn btn-delete-vac" style="padding:4px 8px; font-size:10px; background:rgba(255,100,100,0.1); color:#f44">Eliminar</button>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top:16px;">
                    <button class="btn toggle-candi" style="width:100%; font-size:12px; padding: 10px; justify-content:space-between; background:rgba(255,255,255,0.03); display:flex; align-items:center; border:1px solid rgba(255,255,255,0.05); border-radius:4px;">
                        <span style="font-weight:700;">CANDIDATOS EN PROCESO (${candidatesCount})</span>
                        <span class="icon">▼</span>
                    </button>
                    
                    <div class="candi-list" style="display:none; margin-top:12px; padding: 0 8px;">
                        ${candidatesHtml || '<div class="text-muted" style="font-size:12px; font-style:italic; padding:8px 0;">No hay candidatos vinculados</div>'}
                        
                        <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
                            <label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:4px; font-family:'JetBrains Mono', monospace;">[ ASIGNAR_POSTULACIÓN ]</label>
                            <div style="display:flex; gap:8px;">
                                <select class="select candi-select" style="flex:1; font-size:12px; padding:4px; background:rgba(0,0,0,0.4); border:1px solid var(--border); color:#fff; border-radius:4px;">
                                    <option value="">Elegir...</option>
                                </select>
                                <button class="btn btn--primary btn-link-candi" style="font-size:11px; padding:4px 8px;">Vincular</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Toggle logic
        const btnToggle = card.querySelector('.toggle-candi');
        const list = card.querySelector('.candi-list');
        btnToggle.onclick = () => {
            const isHidden = list.style.display === 'none';
            list.style.display = isHidden ? 'block' : 'none';
            btnToggle.querySelector('.icon').textContent = isHidden ? '▲' : '▼';
            btnToggle.style.background = isHidden ? 'rgba(34,211,238,0.05)' : 'rgba(255,255,255,0.03)';
            btnToggle.style.borderColor = isHidden ? 'var(--accent)' : 'rgba(255,255,255,0.05)';
        };

        // Link candidate logic
        const sel = card.querySelector('.candi-select');
        const btnLk = card.querySelector('.btn-link-candi');
        populateCandiSelect(sel, v.id);

        btnLk.onclick = async () => {
            const cid = sel.value;
            if (!cid) return;
            const { error } = await supabase.from('candidates').update({ vacancy_id: v.id }).eq('id', cid);
            if (error) alert('Error: ' + error.message);
            else loadVacancies();
        };

        // Edit & Delete logic
        card.querySelector('.btn-edit-vac').onclick = () => openEditModal(v);
        card.querySelector('.btn-delete-vac').onclick = () => deleteVacancy(v.id, v.title);

        return card;
    }


    async function deleteVacancy(id, title) {
        if (!confirm(`¿Estás seguro de eliminar la vacante "${title}"?`)) return;
        const { error } = await supabase.from('vacancies').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadVacancies();
    }

    function openEditModal(v) {
        $('#modalTitle').textContent = 'Editar Vacante';
        $('#editVacancyId').value = v.id;
        form.title.value = v.title;
        form.requirements.value = (v.requirements || []).join('\n');
        form.sla_days.value = v.sla_days;
        modal.classList.add('is-open');
    }

    async function populateCandiSelect(select, currentVid) {
        const { data } = await supabase.from('candidates').select('id, nombre_completo').order('nombre_completo');
        if (!data) return;
        select.innerHTML = '<option value="">Elegir...</option>';
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre_completo;
            select.appendChild(opt);
        });
    }

    if (btnNew) {
        btnNew.onclick = () => {
            $('#modalTitle').textContent = 'Nueva Vacante';
            $('#editVacancyId').value = '';
            form.reset();
            modal.classList.add('is-open');
        };
    }

    if (modal) {
        modal.querySelector('.close-modal').onclick = () => modal.classList.remove('is-open');
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const vid = formData.get('vacancy_id');
            const data = {
                title: formData.get('title'),
                requirements: formData.get('requirements').split('\n').filter(Boolean),
                sla_days: parseInt(formData.get('sla_days')),
                status: 'Abierta'
            };

            let res;
            if (vid) {
                res = await supabase.from('vacancies').update(data).eq('id', vid);
            } else {
                res = await supabase.from('vacancies').insert([data]);
            }
            const { error } = res;

            if (error) {
                alert('Error al crear vacante: ' + error.message);
            } else {
                modal.classList.remove('is-open');
                form.reset();
                loadVacancies();
            }
        };
    }

    loadVacancies();
})();
