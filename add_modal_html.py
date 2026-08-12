import re

with open('app.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Añadir los botones en section-tools
buttons_html = """
            <button class="btn" onclick="openTecModal('tec02')">Generar TEC-02</button>
            <button class="btn" onclick="openTecModal('tec02a')">Generar TEC-02A</button>
"""
html = html.replace('<button class="btn" id="btn-sync-drive">Sincronizar Drive</button>', 
                    '<button class="btn" id="btn-sync-drive">Sincronizar Drive</button>' + buttons_html)

# 2. Añadir el Modal HTML antes de </body>
modal_html = """
  <!-- Modal TEC -->
  <div id="tec-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h3 style="margin:0; font-size:16px; color: var(--cyan);" id="tec-modal-title">Generar Planilla</h3>
        <button class="btn" onclick="closeTecModal()" style="padding:4px 8px;">X</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="font-size:11px; color:var(--muted); display:block; margin-bottom:5px;">Nombre de la Planilla (Opcional)</label>
        <input type="text" id="tec-filename" class="stark-input" placeholder="Ej: Reporte_Candidatos" style="width:100%; box-sizing: border-box;">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 15px;">
        <div>
          <label style="font-size:11px; color:var(--muted); display:block; margin-bottom:5px;">Cargo</label>
          <input type="text" id="tec-filter-cargo" class="stark-input tec-filter-input" placeholder="Ej: Prevencionista..." style="width:100%; box-sizing: border-box;">
        </div>
        <div>
          <label style="font-size:11px; color:var(--muted); display:block; margin-bottom:5px;">Experiencia</label>
          <input type="text" id="tec-filter-exp" class="stark-input tec-filter-input" placeholder="Ej: 5 años..." style="width:100%; box-sizing: border-box;">
        </div>
        <div>
          <label style="font-size:11px; color:var(--muted); display:block; margin-bottom:5px;">Software que domina</label>
          <input type="text" id="tec-filter-software" class="stark-input tec-filter-input" placeholder="Ej: Excel, AutoCAD..." style="width:100%; box-sizing: border-box;">
        </div>
        <div>
          <label style="font-size:11px; color:var(--muted); display:block; margin-bottom:5px;">Última Empresa</label>
          <input type="text" id="tec-filter-empresa" class="stark-input tec-filter-input" placeholder="Ej: Minera..." style="width:100%; box-sizing: border-box;">
        </div>
      </div>

      <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 15px;">
        <table style="width:100%; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: var(--panel);">
            <tr>
              <th style="padding:8px; width: 40px;"><input type="checkbox" id="tec-master-cb"></th>
              <th style="padding:8px; text-align: left; font-size: 11px; color: var(--muted);">Candidato</th>
              <th style="padding:8px; text-align: left; font-size: 11px; color: var(--muted);">Cargo / Profesión</th>
            </tr>
          </thead>
          <tbody id="tec-candidates-list">
            <!-- Rellenado por JS -->
          </tbody>
        </table>
      </div>

      <div style="text-align: right;">
        <button class="btn primary" id="btn-confirm-tec">Crear Planilla (<span id="tec-selected-count">0</span>)</button>
      </div>
    </div>
  </div>
"""

html = html.replace('</body>', modal_html + '\n</body>')

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('app.html actualizado')
