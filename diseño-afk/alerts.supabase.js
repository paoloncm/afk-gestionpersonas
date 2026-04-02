
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
            const { data, error } = await supabase
                .from('worker_credentials')
                .select(`
                    id,
                    credential_name,
                    exam_type,
                    expiry_date,
                    result_status,
                    is_active,
                    is_latest,
                    workers (
                        full_name
                    )
                `)
                .eq('is_latest', true)
                .order('expiry_date', { ascending: true });

            if (error) throw error;
            allAlerts = data;
            renderAlerts(data);
        } catch (err) {
            console.error('Error loading alerts:', err);
            table.innerHTML = `<div style="padding:40px; color:var(--muted)">Error al cargar alertas.</div>`;
        }
    }

    function calculateAlert(item) {
        const now = new Date();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
        
        let badgeClass = 'badge--active';
        let statusLabel = 'Vigente';
        let sevClass = 'sev--low';
        let sevLabel = 'Baja';

        if (expiry) {
            const diff = expiry.getTime() - now.getTime();
            if (diff < 0) {
                badgeClass = 'badge--inactive';
                statusLabel = 'Vencido';
                sevClass = 'sev--high';
                sevLabel = 'Crítica';
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
