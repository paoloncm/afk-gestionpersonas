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

        // 3. Cargar Tabla de Candidatos Recientes
        await loadRecentCandidates();

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

async function loadRecentCandidates() {
    const tbody = $('#candidates-tbody');
    if (!tbody) return;

    console.log("[JARVIS] 📋 Cargando expediente de candidatos...");

    const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, nombre_completo, profesion, cargo_a_desempenar, nota, status')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error loading candidates:", error);
        return;
    }

    tbody.innerHTML = '';
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

    // Búsqueda en tiempo real
    const searchInput = $('#search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#candidates-tbody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        };
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
