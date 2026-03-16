
// worker.js
(async function() {
    const $ = s => document.querySelector(s);
    const qs = new URLSearchParams(window.location.search);
    const workerId = qs.get('id');
    const content = $('#profileContent');

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 500);
            return;
        }
        if (!workerId) {
            content.innerHTML = '<h2 class="h1">No se especificó un ID de trabajador.</h2>';
            return;
        }
        loadWorkerData();
    }
    init();

    async function loadWorkerData() {
        try {
            // Fetch worker basic info
            const { data: worker, error: wErr } = await supabase
                .from('workers')
                .select('*')
                .eq('id', workerId)
                .single();

            if (wErr) throw wErr;

            // Fetch credentials/exams
            const { data: credentials, error: cErr } = await supabase
                .from('worker_credentials')
                .select('*')
                .eq('worker_id', workerId)
                .order('expiry_date', { ascending: false });

            renderProfile(worker, credentials || []);
        } catch (err) {
            console.error('Error loading worker profile:', err);
            content.innerHTML = `<h2 class="h1">Error al cargar datos: ${err.message}</h2>`;
        }
    }

    function renderProfile(w, creds) {
        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(w.full_name)}&size=128&background=random&color=fff`;
        
        content.innerHTML = `
            <div class="profile-grid">
                <div class="profile-sidebar">
                    <div class="card" style="text-align:center; padding:30px;">
                        <img src="${avatar}" style="width:120px; height:120px; border-radius:50%; margin-bottom:20px; border:4px solid var(--border);">
                        <h1 class="h1" style="margin:0">${w.full_name}</h1>
                        <p class="text-muted" style="margin:10px 0">${w.rut}</p>
                        <div class="badge ${w.status === 'active' || w.status === 'Activo' ? 'badge--active' : 'badge--inactive'}" style="margin-bottom:20px">
                            ${w.status || 'Activo'}
                        </div>
                        <div style="text-align:left; border-top:1px solid var(--border); padding-top:20px; margin-top:20px;">
                            <p><strong>Empresa/Faena:</strong><br>${w.company_name || 'Sin asignar'}</p>
                            <p><strong>Email:</strong><br>${w.email || '-'}</p>
                            <p><strong>Teléfono:</strong><br>${w.phone || '-'}</p>
                        </div>
                    </div>
                </div>

                <div class="profile-main">
                    <div class="card" style="margin-bottom:24px;">
                        <div class="card__body">
                            <h2 class="h1" style="font-size:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                                Cumplimiento y Documentación
                                <span class="badge badge--info">${creds.length} Documentos</span>
                            </h2>
                            
                            <div class="credentials-list">
                                ${creds.length === 0 ? '<p class="text-muted">No hay registros de exámenes o certificaciones.</p>' : ''}
                                ${creds.map(c => {
                                    const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
                                    const isExpired = expiry && expiry < new Date();
                                    const displayName = c.exam_type ? `${c.credential_name} (${c.exam_type})` : c.credential_name;
                                    return `
                                        <div class="credential-card">
                                            <div class="credential-info">
                                                <strong>${displayName}</strong>
                                                <span class="text-muted" style="font-size:12px;">Tipo: ${c.credential_category || 'General'}</span>
                                                <span style="font-size:11px; color:${isExpired ? 'var(--accent)' : 'var(--ok)'}">
                                                    Vence: ${expiry ? expiry.toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                            <div class="badge ${isExpired ? 'badge--danger' : 'badge--success'}">
                                                ${c.result_status || (isExpired ? 'Vencido' : 'Vigente')}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card__body">
                            <h2 class="h1" style="font-size:18px; margin-bottom:14px;">Currículum Vitae</h2>
                            <p class="text-muted">Documentos cargados en el sistema de almacenamiento seguro.</p>
                            <button class="btn btn--primary" onclick="alert('Funcionalidad de CV de trabajador en desarrollo. Consultando bucket...')">Ver CV Digital</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
})();
