import re

with open('app.html', 'r', encoding='utf-8') as f:
    html = f.read()

new_layout = """
      <div class="analytical-grid" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div class="card">
             <h4 style="color:#f59e0b; margin:0 0 15px; font-size:12px; text-transform:uppercase;">Distribución por Rango Etario</h4>
             <div style="height:250px;"><canvas id="chart_age_dist"></canvas></div>
          </div>
          <div class="card">
             <h4 style="color:#f59e0b; margin:0 0 15px; font-size:12px; text-transform:uppercase;">Talonario de Profesiones</h4>
             <div style="height:250px;"><canvas id="chart_professions"></canvas></div>
          </div>
      </div>

      <div class="analytical-grid" style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">
          <div class="card">
             <h4 style="color:#f59e0b; margin:0 0 15px; font-size:12px; text-transform:uppercase;">Geolocalización</h4>
             <div id="map_candidates" style="height:350px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;"></div>
          </div>
      </div>
"""

# Find the start of the first analytical grid
start_idx = html.find('<div class="analytical-grid"')
# Find the end of the second analytical grid
end_idx = html.find('</div>', html.find('</div>', html.find('</div>', html.find('<div class="analytical-grid"', start_idx + 10)))) + 6

# I will use a regex to replace everything between the first analytical-grid and the start of <div class="section-header">
pattern = re.compile(r'<div class="analytical-grid".*?</div>\s*</div>\s*<div class="section-header">', re.DOTALL)

# Let's see if we can just replace the chunks
html = re.sub(
    r'<div class="analytical-grid"\s*style="display: grid; grid-template-columns: repeat\(2, 1fr\); gap: 20px; margin-bottom: 20px;">.*?<div class="analytical-grid" style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">.*?</div>\s*</div>',
    new_layout.strip(),
    html,
    flags=re.DOTALL
)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Layout de analíticas actualizado.")
