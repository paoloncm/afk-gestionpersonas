// interviews.supabase.js
(async function() {
    const $ = s => document.querySelector(s);
    const container = $('#interviews-container');

    async function init() {
        if (!window.supabase) {
            console.warn('Waiting for Supabase in interviews.js...');
            setTimeout(init, 500);
            return;
        }
        console.log('Supabase ready in interviews.js');
        loadInterviews();
    }
    init();

    async function loadInterviews() {
        try {
            const { data, error } = await supabase
                .from('interviews')
                .select(`
                    id,
                    candidate_id,
                    interview_date,
                    duration_minutes,
                    notes,
                    status,
                    candidates (
                        id,
                        nombre_completo,
                        profesion,
                        vacancies!fk_vacancy (
                            title
                        )
                    )
                `)
                .order('interview_date', { ascending: true });

            if (error) {
                console.error('Error cargando entrevistas:', error);
                if (error.code === '42P01' || error.message.includes('column')) {
                    renderSetupMessage(error);
                } else {
                    container.innerHTML = `<div class="card"><div class="card__body text-muted">Error al cargar datos. Revisa la consola o ejecuta el SQL de reparación.</div></div>`;
                }
                return;
            }

            renderInterviews(data);
        } catch (err) {
            console.error('Exception in loadInterviews:', err);
            container.innerHTML = `<div class="card"><div class="card__body text-muted">Error crítico al cargar. Por favor ejecuta el SQL proporcionado.</div></div>`;
        }
    }

    function renderSetupMessage(error) {
        const isTableMissing = error.code === '42P01';
        const msg = isTableMissing 
            ? `La tabla <code>interviews</code> no existe.` 
            : `Faltan columnas en la tabla <code>interviews</code> (ej. status o vacancy_id).`;
            
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

    function renderInterviews(interviews) {
        container.innerHTML = `<h1 class="h1">Gestión de Entrevistas</h1>`;

        if (interviews.length === 0) {
            container.innerHTML += `
                <div class="card" style="margin-top:20px">
                    <div class="card__body" style="text-align:center; padding: 60px 20px;">
                        <div class="text-muted" style="font-size:18px">No hay entrevistas programadas</div>
                        <p class="text-muted">Las entrevistas aparecerán aquí una vez las programes desde el perfil del candidato.</p>
                    </div>
                </div>
            `;
            return;
        }

        // Grouping logic
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const groups = {
            'Hoy': [],
            'Próximas': [],
            'Anteriores': []
        };

        interviews.forEach(i => {
            const d = new Date(i.interview_date);
            const dTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            
            if (dTime === today) groups['Hoy'].push(i);
            else if (dTime > today) groups['Próximas'].push(i);
            else groups['Anteriores'].push(i);
        });

        Object.entries(groups).forEach(([title, items]) => {
            if (items.length === 0) return;

            const section = document.createElement('div');
            section.className = 'interview-section';
            section.innerHTML = `
                <h2 class="h1" style="font-size:16px; margin: 24px 0 12px; opacity:0.7">${title}</h2>
                <div class="interview-grid"></div>
            `;
            const grid = section.querySelector('.interview-grid');

            items.forEach(i => {
                const date = new Date(i.interview_date);
                const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(date.getTime() + i.duration_minutes * 60000);
                const endTimeStr = endTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                const candRaw = i.candidates;
                let cand = {};
                if (Array.isArray(candRaw) && candRaw.length > 0) cand = candRaw[0];
                else if (candRaw && !Array.isArray(candRaw)) cand = candRaw;

                const candidateId = cand.id || i.candidate_id; 
                if (!candidateId) console.warn('⚠️ No candidate ID for interview:', i.id);
                
                const candidateName = cand.nombre_completo || 'Desconocido';
                const isServer = window.location.protocol.startsWith('http');
                const pBase = isServer ? 'candidates' : 'candidates.html';
                const profileUrl = `${pBase}?id=${candidateId}`;
                
                const vacancyTitle = cand.vacancies?.title || (Array.isArray(cand.vacancies) ? cand.vacancies[0]?.title : null) || 'Puesto no asignado';
                const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=random&color=fff&size=128`;

                console.log(`🔗 Redering card for ${candidateName}, ID: ${candidateId}, Link: ${profileUrl}`);

                const statusClass = (i.status || 'Programada').toLowerCase().replace(/\s+/g, '-');

                const card = document.createElement('div');
                card.className = `interview-card ${statusClass}`;
                card.innerHTML = `
                    <div class="interview-card__header">
                        <img class="interview-card__avatar" src="${avatar}">
                        <div class="interview-card__status badge-${statusClass}">${i.status || 'Programada'}</div>
                    </div>
                    <div class="interview-card__body">
                        <h3 class="interview-card__name">${candidateName}</h3>
                        <div class="interview-card__vacancy">${vacancyTitle}</div>
                        <div class="interview-card__time">
                            <span class="icon">📅</span> ${dateStr} 
                            <span class="icon" style="margin-left:8px">⏰</span> ${timeStr} - ${endTimeStr}
                        </div>
                    </div>
                    <div class="interview-card__footer">
                        <button class="btn btn-edit" data-id="${i.id}" data-status="${i.status || 'Programada'}" data-notes="${escapeHtml(i.notes)}">Seguimiento</button>
                        <button class="btn btn-view-profile" data-cid="${candidateId}" data-status="${i.status || ''}" data-name="${candidateName}" style="cursor:pointer">Ver Perfil</button>
                    </div>
                `;
                grid.appendChild(card);
            });

            container.appendChild(section);
        });

        // Event listeners (re-bind)
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                $('#editInterviewId').value = btn.dataset.id;
                $('#editStatus').value = btn.dataset.status;
                $('#editNotes').value = btn.dataset.notes;
                $('#updateModal').classList.add('is-open');
            };
        });

        document.querySelectorAll('.btn-view-profile').forEach(btn => {
            btn.onclick = async () => {
                const cid = btn.dataset.cid;
                const status = btn.dataset.status;
                const name = btn.dataset.name;

                console.log('🚀 Navigating to profile for ID:', cid, 'Status:', status);
                
                if (!cid || cid === 'undefined' || cid === 'null') {
                    alert('Error: No se encontró el ID del candidato para esta entrevista.');
                    return;
                }

                const isServer = window.location.protocol.startsWith('http');

                // Si está contratado, intentar redirigir a worker.html
                if (status === 'Contratado') {
                    console.log('🔍 Candidate is hired, checking for worker record...');
                    // Intentar buscar trabajador por nombre como fallback si no hay link directo (asumiendo que RUT o nombre coinciden)
                    const { data: workerData } = await supabase
                        .from('workers')
                        .select('id')
                        .ilike('full_name', name)
                        .limit(1);

                    if (workerData && workerData.length > 0) {
                        console.log('✅ Worker record found, redirecting to worker profile');
                        const wBase = isServer ? 'worker' : 'worker.html';
                        window.location.href = `${wBase}?id=${workerData[0].id}`;
                        return;
                    } else {
                        console.warn('⚠️ No matching worker found for hired candidate. Falling back to candidates profile');
                    }
                }

                const pBase = isServer ? 'candidates' : 'candidates.html';
                const url = `${pBase}?id=${cid}`;
                console.log('🔗 URL final:', url);
                window.location.href = url;
            };
        });
    }

    const modal = $('#updateModal');
    if (modal) {
        modal.querySelector('.close-modal').onclick = () => modal.classList.remove('is-open');
        $('#updateForm').onsubmit = async (e) => {
            e.preventDefault();
            const id = $('#editInterviewId').value;
            const status = $('#editStatus').value;
            const notes = $('#editNotes').value;

            const { error } = await supabase
                .from('interviews')
                .update({ status, notes })
                .eq('id', id);

            if (error) alert('Error al actualizar: ' + error.message);
            else {
                modal.classList.remove('is-open');
                loadInterviews();
            }
        };
    }

    function escapeHtml(str) {
        return String(str ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');
    }

    // init() already calls loadInterviews()
})();
