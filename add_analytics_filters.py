import re

with open('app.html', 'r', encoding='utf-8') as f:
    html = f.read()

filters_html = """
      <div class="analytics-filters" style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
        <input type="text" id="af-profesion" class="stark-input" placeholder="Filtrar por Profesión..." style="flex:1; min-width:150px;">
        <input type="text" id="af-cargo" class="stark-input" placeholder="Filtrar por Cargo Destino..." style="flex:1; min-width:150px;">
        <input type="text" id="af-region" class="stark-input" placeholder="Filtrar por Región/Empresa..." style="flex:1; min-width:150px;">
      </div>
      <div class="analytical-grid"
"""

html = html.replace('<div class="analytical-grid"', filters_html, 1)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("app.html actualizado con barra de filtros")
