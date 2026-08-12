import re

# 1. Update app.html
with open('app.html', 'r', encoding='utf-8') as f:
    html = f.read()

filters_html = """
      <div class="analytics-filters" style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
        <select id="af-profesion" class="stark-input" style="flex:1; min-width:150px;">
          <option value="">Todas las Profesiones</option>
        </select>
        <select id="af-cargo" class="stark-input" style="flex:1; min-width:150px;">
          <option value="">Todos los Cargos</option>
        </select>
        <select id="af-region" class="stark-input" style="flex:1; min-width:150px;">
          <option value="">Todas las Regiones/Empresas</option>
        </select>
      </div>
"""

html = re.sub(r'<div class="analytics-filters".*?</div>', filters_html.strip(), html, flags=re.DOTALL)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(html)


# 2. Update analytics.supabase.js
with open('static/analytics.supabase.js', 'r', encoding='utf-8') as f:
    js = f.read()

populate_func = """
  function populateAnalyticsFilters() {
      const profs = new Set();
      const cargos = new Set();
      const regiones = new Set();

      allWorkers.forEach(p => {
          if (p.position) profs.add(p.position);
          if (p.cargo) profs.add(p.cargo);
          if (p.cargo_a_desempenar) cargos.add(p.cargo_a_desempenar);
          if (p.company_name) regiones.add(p.company_name);
      });

      allCandidates.forEach(p => {
          if (p.profesion) profs.add(p.profesion);
          if (p.cargo_a_desempenar) cargos.add(p.cargo_a_desempenar);
          if (p.direccion) regiones.add(p.direccion);
      });

      const selProf = $('#af-profesion');
      const selCargo = $('#af-cargo');
      const selRegion = $('#af-region');

      if (selProf) {
          Array.from(profs).filter(Boolean).sort().forEach(p => {
              const opt = document.createElement('option');
              opt.value = p; opt.innerText = p;
              selProf.appendChild(opt);
          });
      }
      
      if (selCargo) {
          Array.from(cargos).filter(Boolean).sort().forEach(c => {
              const opt = document.createElement('option');
              opt.value = c; opt.innerText = c;
              selCargo.appendChild(opt);
          });
      }

      if (selRegion) {
          Array.from(regiones).filter(Boolean).sort().forEach(r => {
              const opt = document.createElement('option');
              opt.value = r; opt.innerText = r;
              selRegion.appendChild(opt);
          });
      }
  }

  function applyAnalyticsFilters() {
"""

js = js.replace('  function applyAnalyticsFilters() {', populate_func)

init_func = """
  async function init() {
    console.log("[Analytics] Iniciando Protocolo de Sincronizacin...");
    if (!window.supabase) {
       console.warn("[Analytics] Esperando enlace con Supabase...");
       setTimeout(init, 500);
       return;
    }
    await loadData();
    populateAnalyticsFilters();
    renderAll();
    bindEvents();
  }
"""

js = re.sub(r'async function init\(\) \{.*?\n  \}', init_func.strip(), js, flags=re.DOTALL)

js = js.replace("addEventListener('input', renderAll);", "addEventListener('change', renderAll);")

with open('static/analytics.supabase.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Todo actualizado a dropdowns")
