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
                            ${c.evaluacion_general || 'Data awaiting deep-link synchronization...'}
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
