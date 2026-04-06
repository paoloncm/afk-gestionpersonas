// workers.supabase.js - Protocolo Stark Intelligence V8: RECONSTRUCCIÓN INTEGRAL
(async function() {
    const $ = s => document.querySelector(s);
    const grid = $('#workersGrid');
    const scannerOverlay = $('#scannerOverlay');
    const personProfileModal = $('#personProfileModal');
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
            if (grid) grid.innerHTML = `<div style="padding:40px; color:var(--danger)">ERROR_DDR: Error al sincronizar base de datos Stark.</div>`;
        }
    }

    function renderWorkers(items) {
        if (!grid) return;
        grid.innerHTML = '';

        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding:100px; text-align:center; color:var(--muted); letter-spacing:2px;">NO SE DETECTARON PERFILES OPERATIVOS ACTIVOS.</div>`;
            return;
        }

        items.forEach(w => {
            const id = w.id;
            const name = (w.full_name || 'Desconocido').toUpperCase();
            const rut = w.rut || 'N/A';
            const company = w.company_name || 'SIN ASIGNAR';
            const email = w.email || 'SIN EMAIL';
            const status = w.status || 'Activo';
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=22d3ee&color=020617&bold=true`;

            const card = document.createElement('div');
            card.className = 'stark-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:20px;">
                   <div style="display:flex; align-items:center; gap:15px;">
                      <img src="${avatar}" style="width:45px; height:45px; border-radius:12px; border:2px solid var(--accent); box-shadow: 0 0 10px var(--accent-glow);">
                      <div>
                         <h3 style="font-size:16px; font-weight:900; margin:0; letter-spacing:1px; cursor:pointer;" onclick="window.showPersonProfile('${id}')">${name}</h3>
                         <div style="font-size:10px; color:var(--accent); font-weight:800; margin-top:2px;">ID: ${rut}</div>
                      </div>
                   </div>
                   <div class="tag" style="background:${status === 'Activo' || status === 'active' ? 'rgba(34,211,238,0.1)' : 'rgba(255,50,100,0.1)'}; color:${status === 'Activo' || status === 'active' ? 'var(--accent)' : '#ff3264'};">
                      ${status.toUpperCase()}
                   </div>
                </div>

                <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:15px; margin-bottom:20px;">
                   <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                         <span style="font-size:12px;">🏢</span>
                         <div style="flex:1;">
                            <div style="font-size:9px; color:var(--muted); text-transform:uppercase;">Empresa / Faena</div>
                            <div style="font-size:12px; font-weight:700;">${company}</div>
                         </div>
                         <button class="btn btn--mini btn-assign" style="font-size:9px; padding:4px 8px; opacity:0.5; display:${company === 'SIN ASIGNAR' ? 'block' : 'none'}">ASIGNAR</button>
                      </div>
                   </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                   <div style="font-size:11px; color:var(--muted);">${email}</div>
                   <button class="btn btn--mini" style="font-size:10px; font-weight:900;" onclick="window.showPersonProfile('${id}')">[ BIOMETRÍA ]</button>
                </div>
            `;

            const btnAssign = card.querySelector('.btn-assign');
            if (btnAssign) {
              btnAssign.onclick = async (e) => {
                  e.stopPropagation();
                  const newFaena = prompt('ASIGNACIÓN DE RECURSO - Ingrese Faena/Empresa:');
                  if (newFaena) {
                      const { error } = await supabase.from('workers').update({ company_name: newFaena }).eq('id', id);
                      if (error) alert('Error: ' + error.message);
                      else loadWorkers();
                  }
              };
            }

            grid.appendChild(card);
        });
    }

    // --- BIOMETRIC SCANNER V8 ---

    window.showPersonProfile = async function(id) {
        if (scannerOverlay) scannerOverlay.style.display = 'flex';
        openModal(personProfileModal);

        try {
            const { data: p, error } = await supabase.from('workers').select('*').eq('id', id).single();
            if (error) throw error;

            $('#profileName').textContent = (p.full_name || 'ANÓNIMO').toUpperCase();
            $('#profileProfession').textContent = p.cargo || 'Especialista Operativo';
            $('#profileRut').textContent = p.rut || 'No Registrado';
            $('#profileEmail').textContent = p.email || 'Sin Email';
            $('#profilePhone').textContent = p.phone || 'Sin Teléfono';
            $('#profileStatus').textContent = (p.status || 'Activo').toUpperCase();
            $('#profileExp').textContent = (p.experiencia || '0') + ' años exp.';
            $('#profileCvSummary').textContent = p.perfil_profesional || 'Sincronizando evaluación de inteligencia JARVIS... Perfil operativo optimizado para Industrias Stark.';
            
            $('#profileEditBtn').onclick = () => { window.location.href = `worker.html?id=${id}`; };

        } catch (err) { console.error('[Stark Profile Error]', err); }
        
        // Mantener el efecto visual del escáner por un momento para inmersión
        if (scannerOverlay) setTimeout(() => scannerOverlay.style.display = 'none', 800);
    };

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

        if (searchInput) searchInput.oninput = applyFilters;
        if (statusFilter) statusFilter.onchange = applyFilters;
        if (resetBtn) resetBtn.onclick = () => {
            searchInput.value = '';
            statusFilter.value = '';
            renderWorkers(allWorkers);
        };
    }

    function openModal(m) { if(m) m.classList.add('is-open'); }
    function closeModal(m) { if(m) m.classList.remove('is-open'); }

    document.querySelectorAll('.close-modal').forEach(b => {
        b.onclick = () => { closeModal(personProfileModal); };
    });

})();
