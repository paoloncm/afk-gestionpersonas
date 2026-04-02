
// alerts.supabase.js
(async function() {
    const $ = s => document.querySelector(s);
    const table = $('#alertsTable');

    let allAlerts = [];

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 500);
            return;
        }
        setupListeners();
        loadAlerts();
    }
    init();

    function setupListeners() {
        const search = $('#alertSearch');
        const typeF = $('#filterType');
        const sevF = $('#filterSeverity');
        const dateF = $('#filterDate');
        const btnReset = $('#btnResetFilters');

        const filterAction = () => {
            const query = search.value.toLowerCase();
            const type = typeF.value;
            const sev = sevF.value;
            const maxDate = dateF.value ? new Date(dateF.value) : null;

            const filtered = allAlerts.filter(item => {
                const docName = item.exam_type ? `${item.credential_name} (${item.exam_type})` : (item.credential_name || '');
                const matchesSearch = (item.workers?.full_name || '').toLowerCase().includes(query) || 
                                     docName.toLowerCase().includes(query);
                
                const matchesType = !type || (item.credential_name || '').includes(type);
                
                // For severity, we need to recalculate or store it
                const alertData = calculateAlert(item);
                const matchesSev = !sev || alertData.sevLabel === sev;

                // Date comparison
                let matchesDate = true;
                if (maxDate && item.expiry_date) {
                    const itemDate = new Date(item.expiry_date);
                    matchesDate = itemDate <= maxDate;
                }

                return matchesSearch && matchesType && matchesSev && matchesDate;
            });

            renderAlerts(filtered);
        };

        if(search) search.oninput = filterAction;
        if(typeF) typeF.onchange = filterAction;
        if(sevF) sevF.onchange = filterAction;
        if(dateF) dateF.onchange = filterAction;
        if(btnReset) btnReset.onclick = () => {
            search.value = '';
            typeF.value = '';
            sevF.value = '';
            dateF.value = '';
            renderAlerts(allAlerts);
        };
    }

    async function loadAlerts() {
        try {
            const [
                { data: workers, error: wErr },
                { data: creds, error: cErr },
                { data: exams, error: eErr }
            ] = await Promise.all([
                supabase.from('workers').select('id, full_name, rut'),
                supabase.from('worker_credentials').select('*').eq('is_latest', true),
                supabase.from('medical_exam_records').select('*')
            ]);

            if (wErr) throw wErr;
            if (cErr) throw cErr;
            if (eErr) throw eErr;

            const normalize = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

            // Unificar alertas
            const alerts = [];
            
            // 1. Procesar credenciales
            (creds || []).forEach(c => {
                const w = (workers || []).find(worker => worker.id === c.worker_id);
                alerts.push({ ...c, workers: w });
            });

            // 2. Procesar exámenes (evitar duplicados si ya están en credenciales por RUT y fecha)
            (exams || []).forEach(e => {
                const eRut = normalize(e.rut);
                const w = (workers || []).find(worker => normalize(worker.rut) === eRut);
                
                // Si el examen no tiene un registro equivalente en las alertas ya añadidas, lo sumamos
                const alreadyAdded = alerts.find(a => 
                    (normalize(a.rut || (a.workers?.rut)) === eRut) && 
                    (a.exam_type === e.exam_type) && 
                    (a.expiry_date === e.expiry_date)
                );

                if (!alreadyAdded) {
                    alerts.push({ 
                        ...e, 
                        workers: w, 
                        credential_name: e.credential_name || (e.exam_type === 'basica' ? 'Examen Preocupacional' : 'Examen') 
                    });
                }
            });

            // 3. Identificar trabajadores sin NINGUNA documentación
            (workers || []).forEach(w => {
                const hasAny = alerts.some(a => a.worker_id === w.id || (a.workers && a.workers.id === w.id));
                if (!hasAny) {
                    alerts.push({
                        id: `missing-${w.id}`,
                        worker_id: w.id,
                        workers: w,
                        credential_name: 'DOCUMENTACIÓN FALTANTE',
                        is_missing: true,
                        expiry_date: null
                    });
                }
            });

            allAlerts = alerts.sort((a,b) => {
                const da = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
                const db = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
                return da - db;
            });

            renderAlerts(allAlerts);
        } catch (err) {
            console.error('Error loading alerts:', err);
            table.innerHTML = `<div style="padding:40px; color:var(--muted)">Error al cargar alertas.</div>`;
        }
    }

    function calculateAlert(item) {
        const now = new Date();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
        
        // Caso especial: Documentación faltante
        // Caso especial: Documentación faltante -> BLOQUEADO (Rojo)
        if (item.is_missing) {
            return { 
                badgeClass: 'badge--danger', 
                statusLabel: 'No Iniciado', 
                sevClass: 'sev--high', 
                sevLabel: 'Crítica', 
                dateStr: 'SIN FECHA' 
            };
        }

        let badgeClass = 'badge--active';
        let statusLabel = 'Vigente';
        let sevClass = 'sev--low';
        let sevLabel = 'Baja';

        if (expiry) {
            const diff = expiry.getTime() - now.getTime();
            if (diff < 0) {
                // VENCIDO -> EN RIESGO (Amarillo)
                badgeClass = 'badge--warning';
                statusLabel = 'Vencido';
                sevClass = 'sev--med';
                sevLabel = 'Media';
            } else if (diff < thirtyDays) {
                badgeClass = 'badge--warn';
                statusLabel = 'Próximo a Vencer';
                sevClass = 'sev--med';
                sevLabel = 'Media';
            }
        }
        return { badgeClass, statusLabel, sevClass, sevLabel, dateStr: expiry ? expiry.toLocaleDateString('es-ES') : 'N/A' };
    }

    function renderAlerts(items) {
        const header = `
            <div class="t-head">
                <div class="t-col-name">Empleado</div>
                <div class="t-col-doc">Documento</div>
                <div class="t-col-date">Vencimiento</div>
                <div class="t-col-status">Estado</div>
                <div class="t-col-sev">Severidad</div>
            </div>`;
        
        let html = header;

        if (items.length === 0) {
            html += `<div style="padding:40px; text-align:center; color:var(--muted)">No se encontraron alertas con los filtros seleccionados.</div>`;
        } else {
            items.forEach(item => {
                const { badgeClass, statusLabel, sevClass, sevLabel, dateStr } = calculateAlert(item);
                const workerName = item.workers?.full_name || 'Desconocido';
                const docName = item.exam_type ? `${item.credential_name} (${item.exam_type})` : (item.credential_name || 'Sin nombre');
                const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(workerName)}&background=random&color=fff`;

                html += `
                    <div class="t-row">
                        <div class="emp t-col-name" data-label="Empleado">
                            <img class="avatar" src="${avatar}">
                            <div class="emp__name">${workerName}</div>
                        </div>
                        <div class="t-col-doc" data-label="Documento">${docName}</div>
                        <div class="t-col-date" data-label="Vencimiento">${dateStr}</div>
                        <div class="t-col-status" data-label="Estado"><span class="badge ${badgeClass}">${statusLabel}</span></div>
                        <div class="t-col-sev" data-label="Severidad"><span class="sev ${sevClass}">${sevLabel}</span></div>
                    </div>
                `;
            });
        }

        table.innerHTML = html;
    }
})();
