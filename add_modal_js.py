import re

with open('static/dashboard-v2.js', 'r', encoding='utf-8') as f:
    js = f.read()

modal_logic = """
// --- LOGICA MODAL TEC ---
let currentTecType = '';
let tecCandidatesData = [];
let selectedTecIds = new Set();

window.openTecModal = async function(type) {
    currentTecType = type;
    const modal = $('#tec-modal');
    if (!modal) return;
    
    $('#tec-modal-title').innerText = type === 'tec02' ? 'Generar Planilla TEC-02' : 'Generar Planilla TEC-02A';
    $('#tec-filename').value = '';
    
    // Fetch all candidates to filter locally
    const { data, error } = await supabase.from('candidates').select('id, nombre_completo, cargo_a_desempenar, experiencia, software_que_domina, ultima_exp_laboral_empresa');
    if (data) {
        tecCandidatesData = data;
    }
    
    selectedTecIds.clear();
    $('#tec-master-cb').checked = false;
    
    // Clear filters
    document.querySelectorAll('.tec-filter-input').forEach(i => i.value = '');
    
    renderTecCandidates();
    modal.style.display = 'flex';
};

window.closeTecModal = function() {
    $('#tec-modal').style.display = 'none';
};

function renderTecCandidates() {
    const tbody = $('#tec-candidates-list');
    if (!tbody) return;
    
    const filterCargo = $('#tec-filter-cargo').value.toLowerCase();
    const filterExp = $('#tec-filter-exp').value.toLowerCase();
    const filterSoft = $('#tec-filter-software').value.toLowerCase();
    const filterEmp = $('#tec-filter-empresa').value.toLowerCase();
    
    const filtered = tecCandidatesData.filter(c => {
        const cargo = (c.cargo_a_desempenar || '').toLowerCase();
        const exp = (c.experiencia || '').toLowerCase();
        const soft = (c.software_que_domina || '').toLowerCase();
        const emp = (c.ultima_exp_laboral_empresa || '').toLowerCase();
        
        return cargo.includes(filterCargo) && exp.includes(filterExp) && soft.includes(filterSoft) && emp.includes(filterEmp);
    });
    
    tbody.innerHTML = filtered.map(c => {
        const checked = selectedTecIds.has(c.id) ? 'checked' : '';
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px;"><input type="checkbox" class="tec-cb" data-id="${c.id}" ${checked}></td>
                <td style="padding:8px; font-size:12px; font-weight:600;">${c.nombre_completo}</td>
                <td style="padding:8px; font-size:11px; color:var(--muted);">${c.cargo_a_desempenar || '--'}</td>
            </tr>
        `;
    }).join('');
    
    $('#tec-selected-count').innerText = selectedTecIds.size;
    
    // Rebind checkboxes
    document.querySelectorAll('.tec-cb').forEach(cb => {
        cb.onchange = (e) => {
            if (e.target.checked) selectedTecIds.add(cb.dataset.id);
            else selectedTecIds.delete(cb.dataset.id);
            $('#tec-selected-count').innerText = selectedTecIds.size;
            
            // Auto check/uncheck master if all are selected
            const allChecked = document.querySelectorAll('.tec-cb:not(:checked)').length === 0;
            $('#tec-master-cb').checked = allChecked && filtered.length > 0;
        };
    });
}
"""

# Añadir eventos al setupEventListeners
events_logic = """
    // Modal TEC Logic
    document.querySelectorAll('.tec-filter-input').forEach(input => {
        input.addEventListener('input', () => {
            renderTecCandidates();
        });
    });
    
    $('#tec-master-cb')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.tec-cb').forEach(cb => {
            cb.checked = isChecked;
            if (isChecked) selectedTecIds.add(cb.dataset.id);
            else selectedTecIds.delete(cb.dataset.id);
        });
        $('#tec-selected-count').innerText = selectedTecIds.size;
    });
    
    $('#btn-confirm-tec')?.addEventListener('click', async () => {
        if (selectedTecIds.size === 0) {
            alert('Selecciona al menos un candidato.');
            return;
        }
        
        const btn = $('#btn-confirm-tec');
        const oldText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Generando...";
        
        const filename = $('#tec-filename').value.trim();

        try {
            const res = await fetch('/api/reports/bulk-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedTecIds),
                    report_type: currentTecType,
                    filename: filename
                })
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename ? `${filename}.xlsx` : `Anexo_${currentTecType.toUpperCase()}_AFK_${new Date().getTime()}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                closeTecModal();
            } else {
                const err = await res.json();
                alert("Error generando reporte: " + (err.detail || "Falla desconocida"));
            }
        } catch (e) {
            alert("Error de red al generar reporte.");
        } finally {
            btn.disabled = false;
            btn.innerText = oldText;
        }
    });
"""

# Inject before document.addEventListener('DOMContentLoaded', initDashboard);
if '// --- LOGICA MODAL TEC ---' not in js:
    js = js.replace("document.addEventListener('DOMContentLoaded', initDashboard);", modal_logic + "\n" + "document.addEventListener('DOMContentLoaded', initDashboard);")
    
    # Inject into setupEventListeners
    js = js.replace("const btnTop = $('#btn-load-more-top');\n    if (btnTop) btnTop.onclick = handleLoadMore;", "const btnTop = $('#btn-load-more-top');\n    if (btnTop) btnTop.onclick = handleLoadMore;\n" + events_logic)

with open('static/dashboard-v2.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("dashboard-v2.js actualizado")
