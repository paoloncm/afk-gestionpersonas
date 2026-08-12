import re

with open('app.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Leaflet CSS
if 'leaflet.css' not in content:
    content = content.replace('</head>', '  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />\n</head>')

# 2. Reemplazar la seccion de metricas
replacement_html = """      <section class="grid-5" style="grid-template-columns: repeat(2, 1fr);">
        <article class="card">
          <div class="metric-label">Postulaciones</div>
          <div class="metric-value" id="kpi-candidates" style="color:#ffffff">...</div>
          <div class="metric-sub">Candidatos activos</div>
        </article>
        
        <article class="card">
          <div class="metric-label">Edad Promedio</div>
          <div class="metric-value" id="kpi_avg_age" style="color:#ffffff">...</div>
          <div class="metric-sub">Candidatos activos</div>
        </article>
      </section>

      <div class="analytical-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
         <div class="card">
            <h4 style="color:#f59e0b; margin:0 0 15px; font-size:12px; text-transform:uppercase;">Distribución por Rango Etario</h4>
            <div style="height:200px;"><canvas id="chart_age_dist"></canvas></div>
         </div>
         <div class="card">
            <h4 style="color:#f59e0b; margin:0 0 15px; font-size:12px; text-transform:uppercase;">Geolocalización Stark</h4>
            <div id="map_candidates" style="height:200px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;"></div>
         </div>
      </div>

      <div class="analytical-grid" style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">
         <div class="card">
            <h4 style="color:#f59e0b; margin:0 0 15px; font-size:12px; text-transform:uppercase;">Talonario de Profesiones</h4>
            <div style="height:250px;"><canvas id="chart_professions"></canvas></div>
         </div>
      </div>
"""

# Replace the grid-5 section
content = re.sub(r'<section class="grid-5">.*?</section>', replacement_html, content, flags=re.DOTALL)

# 3. Add JS libraries
if 'chart.umd.min.js' not in content:
    content = content.replace('</body>', '  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>\n  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>\n  <script defer src="static/analytics.supabase.js"></script>\n</body>')

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Modificado exitosamente')
