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
        const { data: vacancies, error } = await supabase
            .from('vacancies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error cargando vacantes:', error);
            if (error.code === '42P01') renderSetupMessage(error);
            return;
        }

        // Fetch all candidates to join manually (fallback for lack of FK)
        const { data: allCandi } = await supabase.from('candidates').select('*').not('vacancy_id', 'is', null);
        
        const vacanciesWithCandi = vacancies.map(v => ({
            ...v,
            candidates: (allCandi || []).filter(c => c.vacancy_id === v.id)
        }));

        renderVacancies(vacanciesWithCandi);
    }

    function renderSetupMessage(error) {
        const isTableMissing = error.code === '42P01';
        const msg = isTableMissing 
            ? `Faltan tablas básicas (vacancies o candidates).` 
            : `Faltan columnas necesarias para el reclutamiento (ej. vacancy_id en candidates).`;

        container.innerHTML = `
            <h1 class="h1">Configuración requerida</h1>
            <div class="card">
                <div class="card__body">
                    <p>${msg}</p>
                    <p>Por favor, ejecuta el script SQL actualizado en el editor para corregir la base de datos.</p>
                </div>
            </div>
        `;
    }

    function renderVacancies(vacancies) {
        // Limpiamos el contenido actual (excepto el título si queremos mantenerlo, pero mejor reconstruir)
        container.innerHTML = `<h1 class="h1">Gestión de Vacantes</h1>`;

        const grid = document.createElement('div');
        grid.className = 'grid-2'; // Usamos la clase grid-2 definida en styles.css (o similar)
        grid.style.display = 'grid';
        grid.style.gap = '20px';
        grid.style.marginTop = '20px';

        vacancies.forEach(v => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'default';
            
            const candidatesCount = (v.candidates || []).length;
            const candidatesHtml = (v.candidates || []).map(c => {
                const stage = c.status || c.estado || 'Postulado';
                return `
                    <div style="display:flex; justify-content:space-between; font-size:12px; padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                        <a href="candidates.html?id=${c.id}" style="color:var(--primary); text-decoration:none; font-weight:600;">${c.nombre_completo}</a>
                        <span class="tag" style="font-size:10px; padding: 2px 6px; background:rgba(255,255,255,0.05)">${stage}</span>
                    </div>
                `;
            }).join('');

            card.innerHTML = `
                <div class="card__body">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h2 class="h1" style="font-size:20px; margin-bottom:4px;">${v.title}</h2>
                            <div class="text-muted" style="font-size:12px;">SLA: ${v.sla_days} días</div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:end; gap:8px;">
                            <div class="tag" style="background: ${v.status === 'Abierta' ? 'rgba(0,255,100,0.1)' : 'rgba(255,255,255,0.05)'}; color: ${v.status === 'Abierta' ? '#00ff64' : '#fff'}">
                                ${v.status}
                            </div>
                            <div style="display:flex; gap:4px;">
                                <button class="btn btn-edit-vac" style="padding:4px 8px; font-size:10px; background:rgba(255,255,255,0.05)">Editar</button>
                                <button class="btn btn-delete-vac" style="padding:4px 8px; font-size:10px; background:rgba(255,100,100,0.1); color:#f44">Eliminar</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top:16px;">
                        <button class="btn toggle-candi" style="width:100%; font-size:12px; padding: 8px; justify-content:space-between; background:rgba(255,255,255,0.03); display:flex; align-items:center;">
                            <span>Candidatos en proceso (${candidatesCount})</span>
                            <span class="icon">▼</span>
                        </button>
                        
                        <div class="candi-list" style="display:none; margin-top:12px; padding: 0 8px;">
                            ${candidatesHtml || '<div class="text-muted" style="font-size:12px; font-style:italic; padding:8px 0;">No hay candidatos vinculados</div>'}
                            
                            <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
                                <label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:4px;">Asignar candidato:</label>
                                <div style="display:flex; gap:8px;">
                                    <select class="select candi-select" style="flex:1; font-size:12px; padding:4px; background:rgba(0,0,0,0.2); border:1px solid var(--border); color:#fff; border-radius:4px;">
                                        <option value="">Cargando...</option>
                                    </select>
                                    <button class="btn btn--primary btn-link-candi" style="font-size:11px; padding:4px 8px;">Ok</button>
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
            };

            // Link candidate logic
            const sel = card.querySelector('.candi-select');
            const btnLk = card.querySelector('.btn-link-candi');
            
            populateCandiSelect(sel, v.id);

            btnLk.onclick = async () => {
                const cid = sel.value;
                if (!cid) return;
                
                // Get old vacancy if any for logging
                const { data: candi } = await supabase.from('candidates').select('vacancy_id').eq('id', cid).single();
                const oldVid = candi?.vacancy_id || 'Ninguna';

                const { error } = await supabase.from('candidates').update({ vacancy_id: v.id }).eq('id', cid);
                
                if (error) alert('Error: ' + error.message);
                else {
                    await supabase.from('candidate_history').insert([{
                        candidate_id: cid,
                        event_type: 'vacancy_link',
                        old_value: oldVid,
                        new_value: v.id
                    }]);
                    loadVacancies();
                }
            };

            // Edit & Delete logic
            card.querySelector('.btn-edit-vac').onclick = () => openEditModal(v);
            card.querySelector('.btn-delete-vac').onclick = () => deleteVacancy(v.id, v.title);

            grid.appendChild(card);
        });

        container.appendChild(grid);
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
