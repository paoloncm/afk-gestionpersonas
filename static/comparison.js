<<<<<<< HEAD:static/comparison.js
// comparison.js - Lógica de Centro de Decisiones AFK
(function() {
    const $ = s => document.querySelector(s);
    const container = $('#comparisonContainer');
    const matrixHeader = $('#matrixHeader');
    const matrixBody = $('#matrixBody');

    const qs = new URLSearchParams(window.location.search);
    const ids = (qs.get('ids') || '').split(',').filter(Boolean);

    if (ids.length === 0) {
        if (container) container.innerHTML = '<p>No se seleccionaron candidatos para comparar.</p>';
        return;
    }

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 200);
            return;
        }
        await fetchData();
    }

    async function fetchData() {
        try {
            const { data, error } = await window.supabase
                .from('candidates')
                .select('*')
                .in('id', ids);

            if (error) throw error;

            // Lógica de Ranking AFK: Priorizar Match IA y luego Nota
            const sortedCandidates = data.sort((a, b) => {
                const matchA = Number(a.match_score) || 0;
                const matchB = Number(b.match_score) || 0;
                if (matchB !== matchA) return matchB - matchA;
                
                const notaA = Number(String(a.nota || '0').replace(',', '.'));
                const notaB = Number(String(b.nota || '0').replace(',', '.'));
                return notaB - notaA;
            });

            updateHero(sortedCandidates[0]);
            renderMatrix(sortedCandidates);
            renderDetailedGrid(sortedCandidates);

        } catch (err) {
            console.error('Error in comparison init:', err);
        }
    }

    function updateHero(winner) {
        if (!winner) return;
        const nameEl = $('#winnerName');
        const reasonEl = $('#winnerReason');

        if (nameEl) nameEl.textContent = `Recomendación AFK: ${winner.nombre_completo}`;
        if (reasonEl) {
            const nota = Number(String(winner.nota || '0').replace(',', '.'));
            let reason = `${winner.nombre_completo} es el candidato más equilibrado: `;
            if (winner.experiencia_total) reason += `posee ${winner.experiencia_total} años de experiencia comprobable, `;
            reason += `con un match del ${winner.match_score || '85'}% y un score de ${nota}. `;
            reason += `Recomendado para avanzar a entrevista final de inmediato.`;
            reasonEl.textContent = reason;
        }

        const btnQuick = $('#btnQuickSchedule');
        const btnSelect = $('#btnSelectWinner');
        
        if (btnQuick) {
            btnQuick.onclick = () => {
                location.href = `candidates.html?id=${winner.id}`;
            };
        }
        
        if (btnSelect) {
            btnSelect.onclick = async () => {
                if (confirm(`¿Seleccionar a ${winner.nombre_completo} como el candidato finalista?`)) {
                    const { error } = await window.supabase
                        .from('candidates')
                        .update({ status: 'Entrevista final' })
                        .eq('id', winner.id);
                    
                    if (error) alert('Error: ' + error.message);
                    else alert(`${winner.nombre_completo} ha sido marcado para Entrevista Final.`);
                }
            };
        }
    }

    function renderMatrix(candidates) {
        if (!matrixHeader || !matrixBody) return;

        // Header: Factor | Cand 1 | Cand 2 | Cand 3
        let headHtml = '<th>Factor</th>';
        candidates.forEach(c => {
            headHtml += `<th style="text-align:center;">${c.nombre_completo.split(' ')[0]}</th>`;
        });
        matrixHeader.innerHTML = headHtml;

        // Filas de Factores
        const factors = [
            { label: 'Experiencia', key: 'experiencia_total', suffix: ' años' },
            { label: 'Nota', key: 'nota', prefix: '⭐ ' },
            { label: 'Match IA', key: 'match_score', suffix: '%' },
            { label: 'Riesgo Gaps', val: (c) => (Number(c.nota) > 6 ? 'Bajo' : 'Medio') }
        ];

        let bodyHtml = '';
        factors.forEach(f => {
            bodyHtml += `<tr><td>${f.label}</td>`;
            candidates.forEach(c => {
                let val = '';
                if (f.val) val = f.val(c);
                else val = (f.prefix || '') + (c[f.key] || '—') + (f.suffix || '');
                
                let color = '#fff';
                if (val === 'Bajo' || val.includes('Alto') || (f.key === 'nota' && Number(val.replace('⭐ ', '')) >= 6)) color = '#10b981';
                
                bodyHtml += `<td style="text-align:center; color:${color}">${val}</td>`;
            });
            bodyHtml += '</tr>';
        });
        matrixBody.innerHTML = bodyHtml;
    }

    function renderDetailedGrid(candidates) {
        if (!container) return;
        container.innerHTML = '';

        candidates.forEach((c, idx) => {
            const isWinner = idx === 0;
            
            const div = document.createElement('div');
            div.className = `card stark-card ${isWinner ? 'winner-card stark-card--winner' : ''}`;
            div.style.position = 'relative';

            // Nota Status
            const notaVal = Number(String(c.nota || '0').replace(',', '.'));
            let statusText = 'A EVALUAR';
            let statusColor = 'var(--muted)';
            if (notaVal >= 6.5) { statusText = 'ALTO POTENCIAL'; statusColor = '#10b981'; }
            else if (notaVal >= 5.5) { statusText = 'RECOMENDABLE'; statusColor = '#f59e0b'; }

            div.innerHTML = `
                ${isWinner ? '<div class="best-option-badge">SYSTEM_CHOICE</div>' : ''}
                <div class="card__body" style="height:100%; display:flex; flex-direction:column;">
                    <div class="stark-header" style="margin-bottom:20px;">
                        <div class="stark-id-badge">FILE_ID: ${c.id.substring(0,8).toUpperCase()}</div>
                        <h4 class="stark-name">${c.nombre_completo}</h4>
                        <div class="stark-status" style="color:${statusColor}">${statusText}</div>
                    </div>

                    <div class="stark-stats-grid">
                        <div class="stark-stat">
                            <div class="stark-stat-value">${c.match_score || '80'}%</div>
                            <div class="stark-stat-label">MATCH_IA</div>
                        </div>
                        <div class="stark-stat">
                            <div class="stark-stat-value">${c.nota || '—'}</div>
                            <div class="stark-stat-label">SC_OPERATIONAL</div>
                        </div>
                    </div>

                    <div class="stark-summary" style="margin-bottom:20px;">
                        <div class="stark-summary-label">// OPERATIONAL_ANALYSIS</div>
                        <div class="stark-summary-content">
                            ${c.evaluacion_general || 'No hay un resumen disponible para este candidato.'}
                        </div>
                    </div>

                    <div style="margin-top:auto; display:flex; gap:8px;">
                        <button class="btn btn--primary" style="flex:1; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:12px;" onclick="location.href='candidates.html?id=${c.id}'">OPEN_FILE</button>
                        <button class="btn" style="flex:1; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:12px;" ${!c.cv_url ? 'disabled' : `onclick="window.open('${c.cv_url}')"`}>VIEW_DOC</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    init();
})();
=======
// comparison.js
(async function() {
    const $ = s => document.querySelector(s);
    const container = $('#comparisonContainer');

    const qs = new URLSearchParams(window.location.search);
    const ids = (qs.get('ids') || '').split(',').filter(Boolean);

    if (ids.length === 0) {
        container.innerHTML = '<p>No se seleccionaron candidatos para comparar.</p>';
        return;
    }

    async function fetchData() {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .in('id', ids);

        if (error) {
            console.error('Error fetching comparison data:', error);
            return;
        }

        renderComparison(data);
    }

    function renderComparison(candidates) {
        container.innerHTML = '';

        candidates.forEach((c, idx) => {
            const seed = encodeURIComponent(c.nombre_completo || 'AFK');
            const avatar = `https://i.pravatar.cc/72?u=${seed}`;
            
            const card = document.createElement('div');
            card.className = 'card';
            card.style.height = '100%';
            
            // Tokenizar habilidades
            const skills = (c.experiencia_especifica || '')
                .split(/,|\n|;/)
                .map(s => s.trim())
                .filter(Boolean)
                .slice(0, 6);

            card.innerHTML = `
                <div class="card__body" style="display:flex; flex-direction:column; align-items:flex-start; text-align:left; height:100%;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; width:100%;">
                        <img src="${avatar}" class="avatar" style="width:48px; height:48px;">
                        <div>
                            <h3 class="h1" style="font-size:18px; margin:0;">${c.nombre_completo}</h3>
                            <div class="text-muted" style="font-size:12px;">${c.profesion || 'Sin cargo'}</div>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; width:100%; gap:12px; margin-bottom:16px; border-top:1px solid var(--border); padding-top:12px;">
                        <div>
                            <div class="comp-value" style="font-size:20px; font-weight:800; color:var(--accent);">${c.nota || '—'}</div>
                            <div class="comp-label" style="font-size:10px; text-transform:uppercase; color:var(--muted);">Nota</div>
                        </div>
                        <div>
                            <div class="comp-value" style="font-size:20px; font-weight:800;">${c.experiencia_total || '0'}</div>
                            <div class="comp-label" style="font-size:10px; text-transform:uppercase; color:var(--muted);">Años Exp.</div>
                        </div>
                    </div>

                    <div style="width:100%; margin-bottom:16px;">
                        <div class="text-muted" style="font-size:11px; margin-bottom:4px; text-transform:uppercase;">Resumen Ejecutivo</div>
                        <div style="font-size:13px; line-height:1.4; color:var(--text); max-height:80px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical;">
                            ${c.evaluacion_general || 'No hay un resumen disponible para este candidato.'}
                        </div>
                    </div>

                    <div style="width:100%; margin-bottom:16px;">
                        <div class="text-muted" style="font-size:11px; margin-bottom:8px; text-transform:uppercase;">Conocimientos Clave</div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${skills.length > 0 
                                ? skills.map(s => `<span class="pill" style="font-size:10px;">${s}</span>`).join('')
                                : '<span class="text-muted" style="font-size:12px;">Sin datos</span>'
                            }
                        </div>
                    </div>

                    <div class="radar-box" style="width:100%; height:180px; margin-bottom:16px;">
                        <canvas id="radar-${idx}"></canvas>
                    </div>

                    <div style="margin-top:auto; width:100%; display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <button class="btn" style="padding:8px;" onclick="location.href='candidates.html?id=${c.id}'">Perfil</button>
                        ${c.cv_url 
                            ? `<a href="${c.cv_url}" target="_blank" class="btn btn--primary" style="padding:8px; text-decoration:none; justify-content:center;">Ver CV</a>`
                            : `<button class="btn btn--disabled" disabled style="padding:8px; opacity:0.5;">Sin CV</button>`
                        }
                    </div>
                </div>
            `;
            container.appendChild(card);

            // Render matching radar for individual context
            renderMiniRadar(`radar-${idx}`, c);
        });
    }

    function renderMiniRadar(canvasId, row) {
        const labels = ['Exp.', 'Edad', 'Técnica', 'Ranking', 'Nota'];
        const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));
        
        const expN = clamp((Number(row.experiencia_total) || 0) / 2, 0, 10);
        const notaN = clamp(Number(row.nota) || 0, 0, 10);
        const rankingN = clamp(Number(row.ranking) || 0, 0, 10);
        
        const data = [expN, 5, notaN, rankingN, notaN]; // Mock age to 5 for now

        new Chart(document.getElementById(canvasId), {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    data,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: 'rgba(230, 2, 91, 0.2)',
                    borderColor: '#e6025b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        min: 0,
                        max: 10,
                        ticks: { display: false },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        pointLabels: { color: '#aaa', font: { size: 10 } }
                    }
                }
            }
        });
    }

    fetchData();
})();
>>>>>>> 8c99da40efea7850d26fba9f412dc9128e25ba4d:comparison.js
