import re

with open('static/analytics.supabase.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Variables
js = js.replace("let allCandidates = [];", "let allCandidates = [];\n  let filteredWorkers = [];\n  let filteredCandidates = [];")

# loadData assignment
js = js.replace("allWorkers = workers || [];\n      allCandidates = candidates || [];", 
                "allWorkers = workers || [];\n      allCandidates = candidates || [];\n      filteredWorkers = [...allWorkers];\n      filteredCandidates = [...allCandidates];")

# Filter function
filter_func = """
  function applyAnalyticsFilters() {
      const prof = ($('#af-profesion')?.value || '').toLowerCase();
      const cargo = ($('#af-cargo')?.value || '').toLowerCase();
      const region = ($('#af-region')?.value || '').toLowerCase();

      filteredWorkers = allWorkers.filter(p => {
          const pProf = (p.position || p.cargo || 'Operativo').toLowerCase();
          const pCargo = (p.cargo_a_desempenar || '').toLowerCase();
          const pReg = (p.company_name || '').toLowerCase();
          return pProf.includes(prof) && pCargo.includes(cargo) && pReg.includes(region);
      });

      filteredCandidates = allCandidates.filter(p => {
          const pProf = (p.profesion || 'Candidato').toLowerCase();
          const pCargo = (p.cargo_a_desempenar || '').toLowerCase();
          const pReg = (p.direccion || '').toLowerCase();
          return pProf.includes(prof) && pCargo.includes(cargo) && pReg.includes(region);
      });
  }

  function renderAll() {
"""
js = js.replace("  function renderAll() {\n", filter_func)
js = js.replace("    renderKPIs();\n    renderCharts();", "    applyAnalyticsFilters();\n    renderKPIs();\n    renderCharts();")

# Replace in render functions
def replace_in_func(func_name, code):
    start = code.find(f"function {func_name}() {{")
    end = code.find("\n  function", start + 10)
    if end == -1: end = code.find("\n  //", start + 10)
    if end == -1: end = len(code)
    
    func_body = code[start:end]
    func_body = func_body.replace("allWorkers", "filteredWorkers")
    func_body = func_body.replace("allCandidates", "filteredCandidates")
    
    return code[:start] + func_body + code[end:]

js = replace_in_func("renderKPIs", js)
js = replace_in_func("renderCharts", js)
js = replace_in_func("renderMap", js)
js = replace_in_func("renderInsights", js)

# Bind events
events_code = """
  function bindEvents() {
    $("#btnExportAnalytics")?.addEventListener("click", () => window.print());
    $("#btnTriggerRecs")?.addEventListener("click", () => {
        window.notificar?.("JARVIS: Ejecutando algoritmos de optimizacin de dotacin...", "info");
    });
    
    $('#af-profesion')?.addEventListener('input', renderAll);
    $('#af-cargo')?.addEventListener('input', renderAll);
    $('#af-region')?.addEventListener('input', renderAll);
  }
"""

js = re.sub(r'function bindEvents\(\) \{.*?\n  \}', events_code.strip(), js, flags=re.DOTALL)

with open('static/analytics.supabase.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("analytics.supabase.js actualizado con lógica de filtrado responsivo")
