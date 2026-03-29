
// workers.supabase.js
(async function() {
    const $ = s => document.querySelector(s);
    const tableBody = $('#workersTable');
    let allWorkers = [];

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 500);
            return;
        }
        loadWorkers();
        setupFilters();
    }
    init();

    async function loadWorkers() {
        try {
            const { data, error } = await supabase
                .from('workers')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;
            allWorkers = data;
            renderWorkers(allWorkers);
        } catch (err) {
            console.error('Error loading workers:', err);
            tableBody.innerHTML = `<div style="padding:40px; color:var(--muted)">Error al cargar trabajadores.</div>`;
        }
    }

    function renderWorkers(items) {
        const header = `
            <div class="t-head">
                <div>Nombre</div>
                <div>RUT</div>
                <div>Empresa / Faena</div>
                <div>Email</div>
                <div>Estado</div>
            </div>`;
        
        let html = header;

        if (items.length === 0) {
            html += `<div style="padding:40px; text-align:center; color:var(--muted)">No se encontraron trabajadores.</div>`;
        } else {
            items.forEach(w => {
                const id = w.id;
                const name = w.full_name || 'Desconocido';
                const rut = w.rut || 'N/A';
                const company = w.company_name || 'Sin asignar';
                const email = w.email || '-';
                const status = w.status || 'Activo';
                const statusClass = status === 'Activo' || status === 'active' ? 'badge--active' : 'badge--inactive';
                
                const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;

                html += `
                    <div class="t-row" data-id="${id}">
                        <div class="emp t-col-name" data-label="Nombre">
                            <img class="avatar" src="${avatar}">
                            <div>
                                <a href="worker.html?id=${id}" class="emp__name" style="color:var(--text); text-decoration:none; border-bottom:1px solid transparent;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='transparent'">
                                    ${name}
                                </a>
                            </div>
                        </div>
                        <div class="t-col-rut" data-label="RUT">${rut}</div>
                        <div class="faena-cell t-col-faena" data-label="Empresa">
                            <span class="faena-text">${company}</span>
                            <button class="btn btn--mini btn-assign" style="padding:2px 6px; font-size:10px; margin-left:8px; opacity:0.5; display:${company === 'Sin asignar' ? 'inline-block' : 'none'}">Asignar</button>
                        </div>
                        <div class="t-col-email" data-label="Email">${email}</div>
                        <div class="t-col-status" data-label="Estado"><span class="badge ${statusClass}">${status}</span></div>
                    </div>
                `;
            });
        }
        tableBody.innerHTML = html;

        // Add event listeners for assignment
        tableBody.querySelectorAll('.btn-assign').forEach(btn => {
            btn.onclick = async (e) => {
                const row = e.target.closest('.t-row');
                const id = row.dataset.id;
                const newFaena = prompt('Ingrese el nombre de la Faena o Empresa:');
                if (newFaena) {
                    const { error } = await supabase.from('workers').update({ company_name: newFaena }).eq('id', id);
                    if (error) alert('Error: ' + error.message);
                    else loadWorkers();
                }
            };
        });
    }

    function setupFilters() {
        const searchInput = $('#workerSearch');
        const statusFilter = $('#filterStatus');
        const resetBtn = $('#btnResetFilters');

        const applyFilters = () => {
            const query = searchInput.value.toLowerCase();
            const status = statusFilter.value;

            const filtered = allWorkers.filter(w => {
                const matchSearch = (w.full_name?.toLowerCase().includes(query) || 
                                     w.rut?.toLowerCase().includes(query) || 
                                     w.company_name?.toLowerCase().includes(query));
                const matchStatus = !status || w.status === status;
                return matchSearch && matchStatus;
            });

            renderWorkers(filtered);
        };

        searchInput.oninput = applyFilters;
        statusFilter.onchange = applyFilters;
        resetBtn.onclick = () => {
            searchInput.value = '';
            statusFilter.value = '';
            renderWorkers(allWorkers);
        };
    }
})();
