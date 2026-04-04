import re

new_hub = r'''        <div class="hud-main">
          <!-- RECOMENDACIÓN TÁCTICA (Hero Banner - DECISION HUB) -->
          <section id="starkDecisionHub" class="stark-card" style="margin-bottom:24px; display:grid; grid-template-columns: 2fr 1fr 1fr; gap:24px; border:2px solid var(--accent); background:rgba(34,213,238,0.05);">
            <!-- AI WINNER -->
            <div style="border-right:1px solid rgba(255,255,255,0.1); padding-right:20px;">
              <div class="section-kicker">🎯 RECOMENDACIÓN FINAL</div>
              <h2 id="winnerName" style="font-size:28px; margin:10px 0; color:var(--ok); letter-spacing:-1px;">SCANNING...</h2>
              <div id="winnerStats" style="display:flex; gap:10px; margin-bottom:12px;">
                 <span id="winnerConfidence" class="badge bg-cyan-500/20 text-cyan-400 border-cyan-500/50 border px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">CONFIANZA: --%</span>
                 <span id="winnerMatch" class="badge bg-green-500/20 text-green-400 border-green-500/50 border px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">MATCH: --%</span>
              </div>
              <div id="winnerReason" class="soft" style="font-size:13px; line-height:1.6; min-height:60px;">Calculando matriz de decisión Stark Industries...</div>
              <div style="margin-top:10px; display:flex; gap:10px;">
                <button id="btnHireWinner" class="btn btn--primary" style="background:#10b981; border:none; padding:8px 20px; font-weight:bold;">🟢 CONTRATAR</button>
                <button id="btnSendToClient" class="btn" style="border:1px solid var(--accent); color:var(--accent); background:transparent; padding:8px 16px;">ENVIAR A CLIENTE</button>
              </div>
            </div>

            <!-- TOP 3 -->
            <div style="border-right:1px solid rgba(255,255,255,0.1); padding-right:20px;">
              <div class="section-kicker">🏆 TOP 3 CANDIDATOS</div>
              <div id="top3List" style="display:grid; gap:8px; margin-top:15px;">
                 <!-- Dinámico -->
              </div>
            </div>

            <!-- OPERATIONAL RISK -->
            <div>
              <div class="section-kicker">⚠️ RIESGO OPERACIONAL</div>
              <div id="riskIndicator" style="text-align:center; padding:10px 0;">
                 <div id="riskLevel" style="font-size:48px; font-weight:900; line-height:1;">--</div>
                 <div id="riskLabel" style="font-size:10px; opacity:0.6; margin-top:4px; font-weight:bold; tracking:2px;">SIN EVALUAR</div>
              </div>
              <ul id="riskDetails" style="font-size:10px; opacity:0.8; padding-left:15px; margin:0; line-height:1.4;">
                 <!-- Dinámico -->
              </ul>
            </div>
          </section>

          <!-- SMART FILTERS -->
          <div style="display:flex; gap:12px; margin-bottom:24px; align-items:center; background:rgba(0,0,0,0.2); padding:10px 20px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
            <span style="font-size:11px; opacity:0.5; font-family:\'JetBrains Mono\', monospace; font-weight:bold; tracking:1px;">FILTROS TÁCTICOS:</span>
            <button id="filterAll" class="btn btn-ghost-accent btn-sm active" style="font-size:10px;">TODOS</button>
            <button id="filterAptos" class="btn btn-ghost-accent btn-sm" style="font-size:10px;">SOLO APTOS (+85%)</button>
            <button id="filterDocs" class="btn btn-ghost-accent btn-sm" style="font-size:10px;">DOCS OK</button>
            <button id="filterTop10" class="btn btn-ghost-accent btn-sm" style="font-size:10px;">TOP 10</button>
          </div>

          <section class="stark-card" style="margin-bottom:40px;">
            <div class="section-kicker">➔ Matriz de Decisión</div>
            <div class="table-container">
              <table class="stark-table">
                <thead>
                  <tr id="matrixHeader">
                    <th>Factor</th>
                    <!-- Dinámico -->
                  </tr>
                </thead>
                <tbody id="matrixBody">
                  <!-- Dinámico -->
                </tbody>
              </table>
            </div>
          </section>

          <h3 style="margin:40px 0 24px; font-family:\'Outfit\', sans-serif; font-weight:900; text-transform:uppercase; letter-spacing:2px; font-size:20px; opacity:0.8;">Análisis Detallado Stark</h3>'''

try:
    with open('comparison.html', 'r', encoding='utf-8') as f:
        content = f.read()
except:
    with open('comparison.html', 'r', encoding='latin-1') as f:
        content = f.read()

# Pattern captures from the first stark-card in hud-main to the Details header
pattern = r'<div class="hud-main">.*?Análisis Detallado</h3>'
if re.search(pattern, content, re.DOTALL):
    new_content = re.sub(pattern, new_hub, content, flags=re.DOTALL)
    with open('comparison.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    # Try more liberal pattern
    pattern2 = r'<div class="hud-main">.*?Análisis Detallado</h3>'
    # Wait, maybe it's just the HUD main block
    print("RETRYING WITH BROAD PATTERN")
    pattern3 = r'      <div class="hud-main">.*?Análisis Detallado</h3>'
    if re.search(pattern3, content, re.DOTALL):
         new_content = re.sub(pattern3, new_hub, content, flags=re.DOTALL)
         with open('comparison.html', 'w', encoding='utf-8') as f:
             f.write(new_content)
         print("SUCCESS")
    else:
         # Fallback: Just replace the h3 and specific markers
         content = content.replace('      <h3>Análisis Detallado</h3>', '<h3 style="margin:40px 0 24px; font-family:\'Outfit\', sans-serif; font-weight:900; text-transform:uppercase; letter-spacing:2px; font-size:20px; opacity:0.8;">Análisis Detallado Stark</h3>')
         # This is a bit risky but we need to update the file
         with open('comparison.html', 'w', encoding='utf-8') as f:
             f.write(content)
         print("PARTIAL SUCCESS (Header only)")

