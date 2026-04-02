<<<<<<< HEAD:static/sheet.js
// ==========================
// AFK RRHH - sheet.js (FINAL)
// ==========================

const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const num = x => (x == null || x === '') ? NaN : Number(String(x).replace(',','.'));

let allRows = [];
let selectedCandidates = [];
let availableVacancies = [];

function updateCompareButton() {
  const btn = $('#btnCompare');
  const count = $('#compareCount');
  if (btn && count) {
    count.innerText = selectedCandidates.length;
    btn.style.display = selectedCandidates.length >= 2 ? 'inline-block' : 'none';
  }
}

function clearRows(){
  $$('.table.candidates .t-row').forEach(r => r.remove());
}

const phases = ['Postulado', 'Entrevista inicial', 'Prueba técnica', 'Entrevista final', 'Oferta', 'Contratado', 'Rechazado'];
let currentPage = 0;
const PAGE_SIZE = 50;
let isLastPage = false;

function estadoColor(s){
  switch (s) {
    case 'Contratado':
    case 'Oferta': return 'success';
    case 'Entrevista inicial':
    case 'Prueba técnica':
    case 'Entrevista final': return 'warning';
    case 'Rechazado': return 'danger';
    case 'nuevo':
    case 'Postulado':
    default: return 'neutral';
  }
}

// helpers seguros (solo columnas REST-safe)
function getCargo(c){
  return c.cargo || '—';
}

function getExperiencia(c){
  return (
    c.experiencia_total ??
    c.experiencia_total_anos ??
    '—'
  );
}

function addRow(c){
  const table = $('.table.candidates');
  if (!table) return;

  const row = document.createElement('div');
  row.className = 't-row';

  // Forzamos .html plural para mayor compatibilidad en modo file, pero usamos clean URLs en servidor
  const isServer = window.location.protocol.startsWith('http');
  const pBase = isServer ? 'candidates' : 'candidates.html';
  const profileLink = `${pBase}?id=${encodeURIComponent(c.id)}`;

  row.innerHTML = `
    <div class="t-col-cb" data-label="Sel"><input type="checkbox" /></div>
    <div class="t-col-name" data-label="Nombre">
      <a href="${profileLink}" style="font-weight:600; text-decoration:none; color:var(--text);">
        ${c.nombre_completo ?? '—'}
      </a>
    </div>
    <div class="t-col-prof" data-label="Profesión">${c.profesion ?? '—'}</div>
    <div class="t-col-vac" data-label="Vacante">
      <select class="select vacancy-select" data-id="${c.id}" style="font-size:12px; padding:2px 6px; border-radius:6px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid var(--border); width:100%">
        <option value="">Sin asignar</option>
        ${availableVacancies.map(v => `<option value="${v.id}" ${v.id === c.vacancy_id ? 'selected' : ''}>${v.title}</option>`).join('')}
      </select>
    </div>
    <div class="t-col-score" data-label="Score"><strong>${c.nota ?? '—'}</strong></div>
    <div class="t-col-exp" data-label="Exp">${getExperiencia(c)}</div>
    <div class="t-col-status" data-label="Estado">
      <select class="select status-select" data-id="${c.id}" style="font-size:12px; padding:2px 6px; border-radius:6px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid var(--border); width:100%">
        ${phases.map(p => `<option value="${p}" ${p === c.status ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
  `;

  // Listener para cambiar vacante
  const vacSelect = row.querySelector('.vacancy-select');
  vacSelect.onchange = async (e) => {
    const newVid = e.target.value || null;
    const oldVid = c.vacancy_id;
    const cid = c.id;

    const { error } = await supabase
      .from('candidates')
      .update({ vacancy_id: newVid })
      .eq('id', cid);

    if (error) {
      alert('Error al actualizar vacante: ' + error.message);
      e.target.value = oldVid || '';
    } else {
      c.vacancy_id = newVid;
      await supabase.from('candidate_history').insert([{
        candidate_id: cid,
        event_type: 'vacancy_link',
        old_value: oldVid || 'Ninguna',
        new_value: newVid || 'Ninguna'
      }]);
    }
  };

  // Listener para cambiar estado desde la tabla
  const select = row.querySelector('.status-select');
  select.onchange = async (e) => {
    const newStatus = e.target.value;
    const oldStatus = c.status;
    const cid = c.id;

    console.log(`Cambiando estado de ${cid} a ${newStatus}`);
    
    const { error } = await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', cid);

    if (error) {
        alert('Error al actualizar estado: ' + error.message);
        e.target.value = oldStatus;
    } else {
        c.status = newStatus;
        // Opcional: registrar en historial
        await supabase.from('candidate_history').insert([{
            candidate_id: cid,
            event_type: 'status_change',
            old_value: oldStatus,
            new_value: newStatus
        }]);
    }
  };

  // Listener para comparación
  const cb = row.querySelector('input[type="checkbox"]');
  if (cb) {
    // Mantener estado si ya estaba seleccionado (ej: por re-render al buscar)
    if (selectedCandidates.includes(c.id)) cb.checked = true;

    cb.onchange = () => {
      if (cb.checked) {
        if (!selectedCandidates.includes(c.id)) selectedCandidates.push(c.id);
      } else {
        selectedCandidates = selectedCandidates.filter(id => id !== c.id);
      }
      updateCompareButton();
    };
  }

  table.appendChild(row);
}

function paintKPIs(rows){
  const kTotal = $('#kpi_total');
  const kNota = $('#kpi_prom_nota');
  const kExp = $('#kpi_prom_exp');
  const kPct = $('#kpi_pct_n6');

  if (kTotal) kTotal.innerText = rows.length;

  const notas = rows.map(r => num(r.nota)).filter(n => !isNaN(n));
  const exps  = rows.map(r => num(getExperiencia(r))).filter(n => !isNaN(n));

  if (kNota) {
    kNota.innerText = notas.length
      ? (notas.reduce((a,b)=>a+b,0) / notas.length).toFixed(2)
      : '—';
  }

  if (kExp) {
    kExp.innerText = exps.length
      ? (exps.reduce((a,b)=>a+b,0) / exps.length).toFixed(1)
      : '—';
  }

  if (kPct) {
    kPct.innerText = notas.length
      ? Math.round(notas.filter(n => n >= 6).length / notas.length * 100) + '%'
      : '—';
  }
}

function render(rows, append = false){
  if (!append) clearRows();
  rows.forEach(addRow);
  paintKPIs(rows);
  
  const btn = $('#btnLoadMore');
  if (btn) btn.style.display = isLastPage ? 'none' : 'inline-block';
}

$('#btnLoadMore')?.addEventListener('click', () => {
    currentPage++;
    loadFromSupabase(true);
});

// BUSCADOR Y FILTROS (SERVER-SIDE)
let searchTimer;
function onFilterChange() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentPage = 0;
        isLastPage = false;
        loadFromSupabase();
    }, 400);
}

$('#candSearch')?.addEventListener('input', onFilterChange);
$('#filterEstado')?.addEventListener('change', onFilterChange);
$('#filterCargo')?.addEventListener('change', onFilterChange);

$('#btnResetFilters')?.addEventListener('click', () => {
    if ($('#candSearch')) $('#candSearch').value = '';
    if ($('#filterEstado')) $('#filterEstado').value = '';
    if ($('#filterCargo')) $('#filterCargo').value = '';
    onFilterChange();
});

async function loadAvailableVacancies() {
  const { data, error } = await supabase.from('vacancies').select('id, title').eq('status', 'Abierta');
  if (!error && data) availableVacancies = data;
}

async function loadFromSupabase(append = false){
  console.log('⏳ Cargando candidatos (Server-side)…');
  
  if (availableVacancies.length === 0) {
    await loadAvailableVacancies();
  }
  
  const term = $('#candSearch')?.value || '';
  const statusFilter = $('#filterEstado')?.value || '';
  const cargoFilter = $('#filterCargo')?.value || '';

  let query = supabase
    .from('candidates')
    .select(`
      id,
      nombre_completo,
      correo,
      telefono,
      profesion,
      experiencia_total,
      nota,
      status,
      vacancy_id,
      vacancies!fk_vacancy(title)
    `, { count: 'exact' });

  // Filtros en el servidor
  if (term) query = query.ilike('nombre_completo', `%${term}%`);
  if (statusFilter) query = query.eq('status', statusFilter);
  if (cargoFilter) query = query.eq('profesion', cargoFilter);

  // Paginación
  const from = currentPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('❌ Supabase error:', error.message);
    return;
  }

  const newRows = data || [];
  isLastPage = newRows.length < PAGE_SIZE;
  
  if (currentPage === 0) {
      populateFiltersOnce(newRows);
  }
  
  render(newRows, append);
  
  if (count !== null) {
      const totalEl = $('#kpi_total');
      if (totalEl) totalEl.innerText = count;
  }

  // Notificar a otros componentes
  window.dispatchEvent(new CustomEvent('afk:candidates-loaded', { detail: newRows }));
}

function populateFiltersOnce(rows) {
    const selEstado = $('#filterEstado');
    const selCargo = $('#filterCargo');
    
    // Solo poblamos si están vacíos (excepto la opción default)
    if (selEstado && selEstado.options.length <= 1) {
        const estados = [...new Set(rows.map(r => r.status).filter(Boolean))].sort();
        selEstado.innerHTML += estados.map(e => `<option value="${e}">${e}</option>`).join('');
    }
    
    if (selCargo && selCargo.options.length <= 1) {
        const cargos = [...new Set(rows.map(r => r.profesion).filter(Boolean))].sort();
        selCargo.innerHTML += cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

// BOTÓN COMPARAR
$('#btnCompare')?.addEventListener('click', () => {
  if (selectedCandidates.length < 2) return;
  const ids = selectedCandidates.join(',');
  const base = window.location.protocol === 'file:' ? 'comparison.html' : 'comparison';
  window.location.href = `${base}?ids=${encodeURIComponent(ids)}`;
});

document.addEventListener('DOMContentLoaded', loadFromSupabase);
window.loadFromSupabase = loadFromSupabase; // Para que otros scripts puedan refrescar
=======
// ==========================
// AFK RRHH - sheet.js (FINAL)
// ==========================

const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const num = x => (x == null || x === '') ? NaN : Number(String(x).replace(',','.'));

let allRows = [];
let selectedCandidates = [];

function updateCompareButton() {
  const btn = $('#btnCompare');
  const count = $('#compareCount');
  if (btn && count) {
    count.innerText = selectedCandidates.length;
    btn.style.display = selectedCandidates.length >= 2 ? 'inline-block' : 'none';
  }
}

function clearRows(){
  $$('.table.candidates .t-row').forEach(r => r.remove());
}

const phases = ['Postulado', 'Entrevista inicial', 'Prueba técnica', 'Entrevista final', 'Oferta', 'Contratado', 'Rechazado'];
let currentPage = 0;
const PAGE_SIZE = 50;
let isLastPage = false;

function estadoColor(s){
  switch (s) {
    case 'Contratado':
    case 'Oferta': return 'success';
    case 'Entrevista inicial':
    case 'Prueba técnica':
    case 'Entrevista final': return 'warning';
    case 'Rechazado': return 'danger';
    case 'nuevo':
    case 'Postulado':
    default: return 'neutral';
  }
}

// helpers seguros (solo columnas REST-safe)
function getCargo(c){
  return c.cargo || '—';
}

function getExperiencia(c){
  return (
    c.experiencia_total ??
    c.experiencia_total_anos ??
    '—'
  );
}

function addRow(c){
  const table = $('.table.candidates');
  if (!table) return;

  const row = document.createElement('div');
  row.className = 't-row';

  // Forzamos .html plural para mayor compatibilidad en modo file, pero usamos clean URLs en servidor
  const isServer = window.location.protocol.startsWith('http');
  const pBase = isServer ? 'candidates' : 'candidates.html';
  const profileLink = `${pBase}?id=${encodeURIComponent(c.id)}`;

  row.innerHTML = `
    <div class="t-col-cb" data-label="Sel"><input type="checkbox" /></div>
    <div class="t-col-name" data-label="Nombre">
      <a href="${profileLink}" style="font-weight:600; text-decoration:none; color:var(--text);">
        ${c.nombre_completo ?? '—'}
      </a>
    </div>
    <div class="t-col-prof" data-label="Profesión">${c.profesion ?? '—'}</div>
    <div class="t-col-vac" data-label="Vacante">${c.vacancies?.title ?? 'Sin asignar'}</div>
    <div class="t-col-score" data-label="Score"><strong>${c.nota ?? '—'}</strong></div>
    <div class="t-col-exp" data-label="Exp">${getExperiencia(c)}</div>
    <div class="t-col-status" data-label="Estado">
      <select class="select status-select" data-id="${c.id}" style="font-size:12px; padding:2px 6px; border-radius:6px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid var(--border); width:100%">
        ${phases.map(p => `<option value="${p}" ${p === c.status ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
  `;

  // Listener para cambiar estado desde la tabla
  const select = row.querySelector('.status-select');
  select.onchange = async (e) => {
    const newStatus = e.target.value;
    const oldStatus = c.status;
    const cid = c.id;

    console.log(`Cambiando estado de ${cid} a ${newStatus}`);
    
    const { error } = await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', cid);

    if (error) {
        alert('Error al actualizar estado: ' + error.message);
        e.target.value = oldStatus;
    } else {
        c.status = newStatus;
        // Opcional: registrar en historial
        await supabase.from('candidate_history').insert([{
            candidate_id: cid,
            event_type: 'status_change',
            old_value: oldStatus,
            new_value: newStatus
        }]);
    }
  };

  // Listener para comparación
  const cb = row.querySelector('input[type="checkbox"]');
  if (cb) {
    // Mantener estado si ya estaba seleccionado (ej: por re-render al buscar)
    if (selectedCandidates.includes(c.id)) cb.checked = true;

    cb.onchange = () => {
      if (cb.checked) {
        if (!selectedCandidates.includes(c.id)) selectedCandidates.push(c.id);
      } else {
        selectedCandidates = selectedCandidates.filter(id => id !== c.id);
      }
      updateCompareButton();
    };
  }

  table.appendChild(row);
}

function paintKPIs(rows){
  const kTotal = $('#kpi_total');
  const kNota = $('#kpi_prom_nota');
  const kExp = $('#kpi_prom_exp');
  const kPct = $('#kpi_pct_n6');

  if (kTotal) kTotal.innerText = rows.length;

  const notas = rows.map(r => num(r.nota)).filter(n => !isNaN(n));
  const exps  = rows.map(r => num(getExperiencia(r))).filter(n => !isNaN(n));

  if (kNota) {
    kNota.innerText = notas.length
      ? (notas.reduce((a,b)=>a+b,0) / notas.length).toFixed(2)
      : '—';
  }

  if (kExp) {
    kExp.innerText = exps.length
      ? (exps.reduce((a,b)=>a+b,0) / exps.length).toFixed(1)
      : '—';
  }

  if (kPct) {
    kPct.innerText = notas.length
      ? Math.round(notas.filter(n => n >= 6).length / notas.length * 100) + '%'
      : '—';
  }
}

function render(rows, append = false){
  if (!append) clearRows();
  rows.forEach(addRow);
  paintKPIs(rows);
  
  const btn = $('#btnLoadMore');
  if (btn) btn.style.display = isLastPage ? 'none' : 'inline-block';
}

$('#btnLoadMore')?.addEventListener('click', () => {
    currentPage++;
    loadFromSupabase(true);
});

// BUSCADOR Y FILTROS (SERVER-SIDE)
let searchTimer;
function onFilterChange() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentPage = 0;
        isLastPage = false;
        loadFromSupabase();
    }, 400);
}

$('#candSearch')?.addEventListener('input', onFilterChange);
$('#filterEstado')?.addEventListener('change', onFilterChange);
$('#filterCargo')?.addEventListener('change', onFilterChange);

$('#btnResetFilters')?.addEventListener('click', () => {
    if ($('#candSearch')) $('#candSearch').value = '';
    if ($('#filterEstado')) $('#filterEstado').value = '';
    if ($('#filterCargo')) $('#filterCargo').value = '';
    onFilterChange();
});

async function loadFromSupabase(append = false){
  console.log('⏳ Cargando candidatos (Server-side)…');
  
  const term = $('#candSearch')?.value || '';
  const statusFilter = $('#filterEstado')?.value || '';
  const cargoFilter = $('#filterCargo')?.value || '';

  let query = supabase
    .from('candidates')
    .select(`
      id,
      nombre_completo,
      correo,
      telefono,
      profesion,
      experiencia_total,
      nota,
      status,
      vacancies!fk_vacancy(title)
    `, { count: 'exact' });

  // Filtros en el servidor
  if (term) query = query.ilike('nombre_completo', `%${term}%`);
  if (statusFilter) query = query.eq('status', statusFilter);
  if (cargoFilter) query = query.eq('profesion', cargoFilter);

  // Paginación
  const from = currentPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('❌ Supabase error:', error.message);
    return;
  }

  const newRows = data || [];
  isLastPage = newRows.length < PAGE_SIZE;
  
  if (currentPage === 0) {
      populateFiltersOnce(newRows);
  }
  
  render(newRows, append);
  
  if (count !== null) {
      const totalEl = $('#kpi_total');
      if (totalEl) totalEl.innerText = count;
  }

  // Notificar a otros componentes
  window.dispatchEvent(new CustomEvent('afk:candidates-loaded', { detail: newRows }));
}

function populateFiltersOnce(rows) {
    const selEstado = $('#filterEstado');
    const selCargo = $('#filterCargo');
    
    // Solo poblamos si están vacíos (excepto la opción default)
    if (selEstado && selEstado.options.length <= 1) {
        const estados = [...new Set(rows.map(r => r.status).filter(Boolean))].sort();
        selEstado.innerHTML += estados.map(e => `<option value="${e}">${e}</option>`).join('');
    }
    
    if (selCargo && selCargo.options.length <= 1) {
        const cargos = [...new Set(rows.map(r => r.profesion).filter(Boolean))].sort();
        selCargo.innerHTML += cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

// BOTÓN COMPARAR
$('#btnCompare')?.addEventListener('click', () => {
  if (selectedCandidates.length < 2) return;
  const ids = selectedCandidates.join(',');
  const base = window.location.protocol === 'file:' ? 'comparison.html' : 'comparison';
  window.location.href = `${base}?ids=${encodeURIComponent(ids)}`;
});

document.addEventListener('DOMContentLoaded', loadFromSupabase);
window.loadFromSupabase = loadFromSupabase; // Para que otros scripts puedan refrescar
>>>>>>> 8c99da40efea7850d26fba9f412dc9128e25ba4d:sheet.js
