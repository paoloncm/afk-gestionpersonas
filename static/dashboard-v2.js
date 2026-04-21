/**
 * AFK RRHH - Dashboard v2.0 (STARK HUD)
 * Conecta la interfaz de alta fidelidad con la red de datos de Supabase.
 */

const $ = (s) => document.querySelector(s);

async function initDashboard() {
    console.log("[JARVIS] 🦾 Activando Sistemas de Control v2.0...");

    if (!window.supabase) {
        console.error("[JARVIS] ❌ Error Crítico: Supabase no detectado.");
        return;
    }

    // 1. Verificación de Seguridad Stark (Proactiva)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        console.warn("[JARVIS] ⚠️ Sesión no detectada. Redirigiendo a zona segura...");
        window.location.href = 'login.html';
        return;
    }

    try {
        // 2. Cargar KPIs Reales
        await loadKPIs();

        // 3. Cargar Tabla de Candidatos con Filtros
        await fetchFilterOptions();
        await loadRecentCandidates(true);

        // 4. Cargar Inteligencia Adicional (Pipeline y Top 5)
        await loadPipeline();
        await loadTopCandidates();

        // 5. Configurar Eventos
        setupEventListeners();

        console.log("[JARVIS] ✅ Sistemas en línea. HUD Operativo.");
    } catch (err) {
        console.error("[JARVIS] 💥 Falla en la secuencia de inicio:", err);
    }
}

async function loadKPIs() {
    console.log("[JARVIS] 📊 Sincronizando métricas operativas...");

    const { count: workerCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });
    
    if ($('#kpi-workers')) $('#kpi-workers').innerText = workerCount || 0;

    const { count: candCount } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true });
    
    if ($('#kpi-candidates')) $('#kpi-candidates').innerText = candCount || 0;

    const { count: riskCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'bloqueado');
    
    if ($('#kpi-risks')) {
        const val = riskCount || 0;
        $('#kpi-risks').innerText = val;
        if ($('#bar-risks')) $('#bar-risks').style.width = Math.min(100, (val * 10)) + "%";
    }

    if ($('#kpi-expiring')) $('#kpi-expiring').innerText = "4"; 
    if ($('#bar-expiring')) $('#bar-expiring').style.width = "40%";

    const { count: compliantCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .not('rut', 'is', null)
        .not('email', 'is', null);
    
    if ($('#kpi-compliance')) {
        const total = workerCount || 1;
        const pct = Math.round(((compliantCount || 0) / total) * 100);
        $('#kpi-compliance').innerText = pct + "%";
    }
}

let selectedCandidateIds = new Set();
let currentPage = 0;
const PAGE_SIZE = 50;
let isLastPage = false;

async function loadRecentCandidates(reset = false) {
    const tbody = $('#candidates-tbody');
    if (!tbody) return;

    if (reset) {
        currentPage = 0;
        isLastPage = false;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">Sincronizando flujo de datos...</td></tr>';
        
        const master = $('#master-select');
        if (master) master.checked = false;
    }

    console.log(`[JARVIS] 📋 Cargando página ${currentPage + 1} de candidatos...`);

    const cargo = $('#filter-cargo')?.value;
    const status = $('#filter-status')?.value;
    const term = $('#search-input')?.value;

    let query = supabase
        .from('candidates')
        .select('id, nombre_completo, profesion, cargo_a_desempenar, nota, status');

    if (cargo) query = query.eq('cargo_a_desempenar', cargo);
    if (status) query = query.eq('status', status);
    if (term) query = query.or(`nombre_completo.ilike.%${term}%,profesion.ilike.%${term}%,rut.ilike.%${term}%`);

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
        const { data: candidates, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error("Error loading candidates:", error);
            if (reset) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--red);">Error al cargar flujo de datos.</td></tr>';
            else alert("Error al cargar más candidatos.");
            return;
        }

        if (reset) tbody.innerHTML = '';

        if (candidates.length < PAGE_SIZE) {
            isLastPage = true;
        }

        if (candidates.length === 0 && currentPage === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--muted);">No se encontraron candidatos con los criterios actuales.</td></tr>';
        } else {
            renderCandidateRows(candidates);
        }
    } catch (err) {
        console.error("Critical failure in loadRecentCandidates:", err);
    } finally {
        updateLoadMoreButton();
    }
}

function renderCandidateRows(candidates) {
    const tbody = $('#candidates-tbody');
    candidates.forEach(cand => {
        const tr = document.createElement('tr');
        tr.dataset.id = cand.id;
        tr.style.cursor = 'pointer';
        
        const isChecked = selectedCandidateIds.has(cand.id);

        tr.onclick = (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) return;
            window.location.href = `candidate.html?id=${cand.id}`;
        };

        tr.innerHTML = `
            <td><input type="checkbox" class="cand-select" ${isChecked ? 'checked' : ''} data-id="${cand.id}"></td>
            <td>${cand.nombre_completo || '—'}</td>
            <td class="text-cyan">${cand.profesion || '—'}</td>
            <td>${cand.cargo_a_desempenar || '—'}</td>
            <td class="score" style="font-weight:900;">${cand.nota || '—'}</td>
            <td><span class="badge blue">${cand.status || 'ANALIZADO POR IA'}</span></td>
            <td><a class="action-link" href="candidate.html?id=${cand.id}">Ver Perfil</a></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.cand-select').forEach(cb => {
        cb.onchange = (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) selectedCandidateIds.add(id);
            else selectedCandidateIds.delete(id);
            updateBulkBar();
        };
    });
}

function updateLoadMoreButton() {
    const btn = $('#btn-load-more');
    if (!btn) return;
    btn.style.display = isLastPage ? 'none' : 'inline-block';
    btn.innerText = "CARGAR MÁS CANDIDATOS";
    btn.disabled = false;
}

async function fetchFilterOptions() {
    console.log("[JARVIS] 🔍 Poblando opciones de filtrado táctico...");
    
    // Cargos únicos
    const { data: cargos } = await supabase.from('candidates').select('cargo_a_desempenar').not('cargo_a_desempenar', 'is', null);
    if (cargos) {
        const uniqueCargos = Array.from(new Set(cargos.map(c => c.cargo_a_desempenar))).sort();
        const selCargo = $('#filter-cargo');
        if (selCargo) {
            uniqueCargos.forEach(c => {
                const opt = document.createElement('option');
                opt.value = opt.innerText = c;
                selCargo.appendChild(opt);
            });
        }
    }

    // Estados únicos
    const { data: statuses } = await supabase.from('candidates').select('status').not('status', 'is', null);
    if (statuses) {
        const uniqueStatus = Array.from(new Set(statuses.map(s => s.status))).sort();
        const selStatus = $('#filter-status');
        if (selStatus) {
            uniqueStatus.forEach(s => {
                const opt = document.createElement('option');
                opt.value = opt.innerText = s;
                selStatus.appendChild(opt);
            });
        }
    }
}

function updateBulkBar() {
    const bar = $('#bulk-actions-bar');
    const countEl = $('#selected-count');
    if (!bar || !countEl) return;

    const count = selectedCandidateIds.size;
    if (count > 0) {
        bar.style.display = 'flex';
        countEl.innerText = count;
    } else {
        bar.style.display = 'none';
        const master = $('#master-select');
        if (master) master.checked = false;
    }
}

async function loadPipeline() {
    const container = $('#dashboard-pipeline');
    if (!container) return;

    const { count: tenderCount, error } = await supabase
        .from('tenders')
        .select('*', { count: 'exact', head: true });

    if (error) return;

    const bar = container.querySelector('div');
    if (bar) {
        const height = Math.min(100, (tenderCount || 0) * 10) + "px";
        bar.style.height = height;
        bar.style.width = "85%";
    }
}

async function loadTopCandidates() {
    const list = $('#dashboard-top-candidates');
    if (!list) return;

    const { data: topCands, error } = await supabase
        .from('candidates')
        .select('nombre_completo, nota, cargo_a_desempenar')
        .order('nota', { ascending: false })
        .limit(5);

    if (error) return;

    list.innerHTML = '';
    if (topCands.length === 0) {
        list.innerHTML = '<li>Sin candidatos calificados</li>';
        return;
    }

    topCands.forEach(cand => {
        const li = document.createElement('li');
        const nota = cand.nota || '—';
        li.innerHTML = `<strong>${cand.nombre_completo}</strong> — Nota: <span class="score">${nota}</span> — Cargo: ${cand.cargo_a_desempenar || '—'}`;
        list.appendChild(li);
    });
}

function setupEventListeners() {
    // Sincronización de Drive
    const btnSync = $('#btn-sync-drive');
    if (btnSync) {
        btnSync.onclick = async () => {
             btnSync.disabled = true;
             btnSync.innerText = "Sincronizando...";
             try {
                const res = await fetch('/api/sync-drive', { method: 'POST' });
                const data = await res.json();
                if (data.ok) alert("JARVIS: Sincronización iniciada.");
                else alert("JARVIS: Error: " + data.detail);
             } catch (e) { alert("JARVIS: Error de comunicación."); }
             finally { btnSync.disabled = false; btnSync.innerText = "Sincronizar Drive"; setTimeout(loadKPIs, 5000); }
        };
    }

    // Maestro Select
    const master = $('#master-select');
    if (master) {
        master.onchange = (e) => {
            const checkboxes = document.querySelectorAll('.cand-select');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const id = cb.dataset.id;
                if (e.target.checked) selectedCandidateIds.add(id);
                else selectedCandidateIds.delete(id);
            });
            updateBulkBar();
        };
    }

    // Botones Bulk (Limpiar IDs, no sesión)
    $('#btn-bulk-clear')?.addEventListener('click', () => {
        selectedCandidateIds.clear();
        document.querySelectorAll('.cand-select').forEach(cb => cb.checked = false);
        updateBulkBar();
    });

    const generateReport = async (type) => {
        if (selectedCandidateIds.size === 0) return;
        const btn = type === 'tec02' ? $('#btn-bulk-tec02') : $('#btn-bulk-tec02a');
        if (!btn) return;

        const oldText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Generando...";

        try {
            const res = await fetch('/api/reports/bulk-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedCandidateIds),
                    report_type: type
                })
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Anexo_${type.toUpperCase()}_AFK_${new Date().getTime()}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                const err = await res.json();
                alert("Error generando reportes: " + (err.detail || "Falla desconocida"));
            }
        } catch (e) { alert("Error de red al generar reportes."); }
        finally { btn.disabled = false; btn.innerText = oldText; }
    };

    $('#btn-bulk-tec02')?.addEventListener('click', () => generateReport('tec02'));
    $('#btn-bulk-tec02a')?.addEventListener('click', () => generateReport('tec02a'));

    // Logout Seguro
    $('#side-btn-logout')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm("¿Confirmas que deseas cerrar la sesión operativa de JARVIS?")) {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        }
    });

    // Búsqueda en tiempo real (Paginada)
    const searchInput = $('#search-input');
    let searchTimeout;
    if (searchInput) {
        searchInput.oninput = (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadRecentCandidates(true);
            }, 400); // Debounce de 400ms para no saturar Supabase
        };
    }

    // Filtros de Cargo y Estado
    $('#filter-cargo')?.addEventListener('change', () => loadRecentCandidates(true));
    $('#filter-status')?.addEventListener('change', () => loadRecentCandidates(true));

    // Botón Cargar Más
    const btnLoadMore = $('#btn-load-more');
    if (btnLoadMore) {
        btnLoadMore.onclick = () => {
            currentPage++;
            btnLoadMore.innerText = "Sincronizando...";
            btnLoadMore.disabled = true;
            loadRecentCandidates(false);
        };
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
