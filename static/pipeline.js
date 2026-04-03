// pipeline.js
(async function() {
    const $ = s => document.querySelector(s);
    const board = $('#kanbanBoard');
    const phases = ['Postulado', 'Entrevista inicial', 'Prueba técnica', 'Entrevista final', 'Oferta', 'Contratado'];

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 500);
            return;
        }
        loadVacancies();
        loadData();
    }

    async function loadData() {
        const vacancyId = $('#kanbanVacancyFilter')?.value;
        let query = supabase
            .from('candidates')
            .select(`
                id,
                nombre_completo,
                profesion,
                status,
                match_score,
                vacancies!fk_vacancy ( title )
            `); // Reverted to original select for compatibility

        if (vacancyId) {
            query = query.eq('vacancy_id', vacancyId);
        }
        
        const { data, error } = await query;

        if (error) {
            console.error('Error cargando candidatos para pipeline:', error);
            window.notificar?.('Error al conectar con el núcleo de datos: ' + error.message, 'error');
            return;
        }
        renderBoard(data || []);
    }

    async function loadVacancies() {
        const { data } = await supabase.from('vacancies').select('id, title').eq('status', 'Abierta');
        const sel = $('#kanbanVacancyFilter');
        if (sel) {
            sel.innerHTML = '<option value="">Todas las vacantes</option>' + 
                (data || []).map(v => `<option value="${v.id}">${v.title}</option>`).join('');
        }
    }

    $('#kanbanVacancyFilter')?.addEventListener('change', loadData);

    function renderBoard(candidates) {
        board.innerHTML = '';

        phases.forEach(phase => {
            const col = document.createElement('div');
            col.className = 'kanban__col';
            const colCandidates = candidates.filter(c => {
                const s = String(c.status || '').trim().toLowerCase();
                const p = phase.toLowerCase();
                if (phase === 'Postulado' && (s === 'nuevo' || s === '' || s === 'postulado' || s === 'analizado por ia')) return true;
                return s === p;
            });

            col.innerHTML = `
                <div class="kanban__head">
                    <strong>${phase}</strong>
                    <span class="kanban__count">${colCandidates.length}</span>
                </div>
                <div class="kanban__body" data-phase="${phase}">
                    <!-- Cards here -->
                </div>
            `;

            // Render columns
            const body = col.querySelector('.kanban__body');
            colCandidates.forEach(c => {
                const card = document.createElement('div');
                card.className = 'kanban__card';
                card.draggable = true;
                card.id = `card-${c.id}`;
                card.innerHTML = `
                    <span class="name text-white">${c.nombre_completo}</span>
                    <span class="prof text-muted" style="font-size: 12px;">${c.profesion || 'Sin profesión'}</span>
                    <div class="meta" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; display: flex; justify-content: space-between;">
                        <span class="tag" style="font-size:10px; background: rgba(255,255,255,0.05); color: var(--muted); padding: 2px 6px; border-radius: 4px;">${c.vacancies?.title || 'Sin vacante'}</span>
                        <span class="tag" style="font-size:10px; background:rgba(0,123,255,0.1); color:#007bff; padding: 2px 6px; border-radius: 4px;">IA: ${Math.round(c.match_score || 0)}%</span>
                    </div>
                `;

                card.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', c.id);
                    e.dataTransfer.effectAllowed = 'move';
                    card.classList.add('is-dragging');
                    setTimeout(() => card.style.display = 'none', 0);
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('is-dragging');
                    card.style.display = 'block';
                });
                
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.tag')) return;
                    const isServer = window.location.protocol.startsWith('http');
                    const pBase = isServer ? 'candidates' : 'candidates.html';
                    window.location.href = `${pBase}?id=${c.id}`;
                });

                body.appendChild(card);
            });

            // Container drop events
            body.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                body.classList.add('drag-over');
            });

            body.addEventListener('dragleave', () => {
                body.classList.remove('drag-over');
            });
            
            body.addEventListener('drop', async (e) => {
                e.preventDefault();
                body.classList.remove('drag-over');
                
                const id = e.dataTransfer.getData('text/plain');
                if (!id) return;

                const newPhase = body.dataset.phase;

                // Find candidate local data
                const candi = candidates.find(item => String(item.id) === String(id));
                if (!candi) return;

                const oldPhase = candi.status || 'Postulado';
                if (oldPhase === newPhase) return;

                console.log(`🚀 Moviendo ${candi.nombre_completo} de ${oldPhase} a ${newPhase}`);

                // Optimistic UI (optional, but let's refresh for safety)
                const { error } = await supabase
                    .from('candidates')
                    .update({ status: newPhase })
                    .eq('id', id);

                if (error) {
                    console.error('❌ Error updating status:', error);
                    alert('Error al mover candidato: ' + error.message);
                    loadData(); // Revert on error
                } else {
                    console.log('✅ Estado actualizado en Supabase');
                    
                    // Update local state and re-render immediately
                    const idx = candidates.findIndex(c => String(c.id) === String(id));
                    if (idx !== -1) {
                        candidates[idx].status = newPhase;
                        renderBoard(candidates);
                    }

                    await supabase.from('candidate_history').insert([{
                        candidate_id: id,
                        event_type: 'status_change',
                        old_value: oldPhase,
                        new_value: newPhase
                    }]);

                    if (newPhase === 'Contratado') {
                        console.log('👷 Generando perfil de trabajador automático...');
                        try {
                            // 1. Obtener datos completos del candidato (especialmente el RUT)
                            const { data: fullCand, error: candErr } = await supabase
                                .from('candidates')
                                .select('*')
                                .eq('id', id)
                                .single();

                            if (candErr) throw candErr;

                            // 2. Insertar en tabla workers
                            const { error: workerErr } = await supabase
                                .from('workers')
                                .insert([{
                                    full_name: fullCand.nombre_completo,
                                    rut: fullCand.rut,
                                    profesion: fullCand.profesion,
                                    email: fullCand.correo,
                                    status: 'Activo',
                                    company_name: fullCand.cargo_a_desempenar || 'Por asignar'
                                }]);

                            if (workerErr) {
                                // Es probable que ya exista un trabajador con ese RUT (vuelve a la empresa)
                                if (workerErr.code === '23505') {
                                    window.notificar?.('El trabajador ya existe en la base de datos de gestión.', 'info');
                                } else {
                                    throw workerErr;
                                }
                            } else {
                                window.notificar?.('¡Perfil de trabajador creado automáticamente!', 'success');
                            }
                        } catch (err) {
                            console.error('Error al crear trabajador:', err);
                            window.notificar?.('Candidato contratado, pero no se pudo crear el perfil de trabajador: ' + err.message, 'warning');
                        }
                    }
                }
            });

            board.appendChild(col);
        });
    }

    init();
})();
