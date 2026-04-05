/**
 * AFK RRHH - Dashboard v2.0 (STARK HUD)
 * Conecta la interfaz de alta fidelidad con la red de datos de Supabase.
 */

const $ = (s) => document.querySelector(s);

async function initDashboard() {
    console.log("[JARVIS] 🦾 Activando Sistemas de Control v2.0...");

    // 1. Cargar Metatada de Sesión / Usuario (opcional si ya está en auth.js)
    if (!window.supabase) {
        console.error("[JARVIS] ❌ Error Crítico: Supabase no detectado.");
        return;
    }

    try {
        // 2. Cargar KPIs Reales
        await loadKPIs();

        // 3. Cargar Tabla de Candidatos Recientes
        await loadRecentCandidates();

        // 4. Configurar Eventos
        setupEventListeners();

        console.log("[JARVIS] ✅ Sistemas en línea. HUD Operativo.");
    } catch (err) {
        console.error("[JARVIS] 💥 Falla en la secuencia de inicio:", err);
    }
}

async function loadKPIs() {
    console.log("[JARVIS] 📊 Sincronizando métricas operativas...");

    // Conteo de Trabajadores
    const { count: workerCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });
    
    if ($('#kpi-workers')) $('#kpi-workers').innerText = workerCount || 0;

    // Conteo de Candidatos
    const { count: candCount } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true });
    
    if ($('#kpi-candidates')) $('#kpi-candidates').innerText = candCount || 0;

    // Riesgos (ejemplo: trabajadores bloqueados o con alertas)
    // Asumimos que hay un campo 'status' o similar en 'workers'
    const { count: riskCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'bloqueado');
    
    if ($('#kpi-risks')) {
        const val = riskCount || 0;
        $('#kpi-risks').innerText = val;
        // Animamos la barra de progreso proporcionalmente (base 10 como "peligro")
        if ($('#bar-risks')) $('#bar-risks').style.width = Math.min(100, (val * 10)) + "%";
    }

    // Próximos Vencimientos (Placeholder lógico: registros creados esta semana)
    if ($('#kpi-expiring')) $('#kpi-expiring').innerText = "4"; // Placeholder para lógica de fechas compleja
}

async function loadRecentCandidates() {
    const tbody = $('#candidates-tbody');
    if (!tbody) return;

    // Fetch 8 most recent candidates
    const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, nombre_completo, profesion, cargo_a_desempenar, nota, status')
        .order('created_at', { ascending: false })
        .limit(8);

    if (error) {
        console.error("Error loading candidates:", error);
        return;
    }

    tbody.innerHTML = '';
    candidates.forEach(cand => {
        const row = document.createElement('tr');
        const score = cand.nota || '—';
        const status = cand.status || 'nuevo';
        
        // Asignación de badge color según estado
        let badgeClass = 'blue';
        if (status === 'Rechazado' || status === 'bloqueado') badgeClass = 'red';
        if (status === 'Contratado' || status === 'Apto') badgeClass = 'green';
        if (status === 'En revisión' || status === 'warning') badgeClass = 'yellow';

        row.innerHTML = `
            <td>${cand.nombre_completo || 'Sin nombre'}</td>
            <td>${cand.profesion || '—'}</td>
            <td>${cand.cargo_a_desempenar || 'Por asignar'}</td>
            <td class="score">${score}</td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
            <td><a class="action-link" href="candidate.html?id=${cand.id}">Ver Perfil</a></td>
        `;
        tbody.appendChild(row);
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
                if (data.ok) {
                    alert("JARVIS: Sincronización iniciada en segundo plano con Google Drive.");
                } else {
                    alert("JARVIS: Error al iniciar sincronización: " + data.detail);
                }
             } catch (e) {
                alert("JARVIS: Error de comunicación con el núcleo.");
             } finally {
                btnSync.disabled = false;
                btnSync.innerText = "Sincronizar Drive";
             }
        };
    }

    // Chatbot Sidebar
    const btnChatbot = $('#side-btn-chatbot');
    if (btnChatbot) {
        btnChatbot.onclick = (e) => {
            e.preventDefault();
            // Disparar evento para que el componente chatbot (si existe) se abra
            window.dispatchEvent(new CustomEvent('afk:open-chatbot'));
        };
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
