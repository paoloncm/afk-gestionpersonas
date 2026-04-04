// comparison.js - Stark Decision Intelligence Matrix
(function() {
    const $ = s => document.querySelector(s);
    const container = $('#comparisonContainer');
    const matrixHeader = $('#matrixHeader');
    const matrixBody = $('#matrixBody');
    
    // Decision Hub Elements
    const winnerName = $('#winnerName');
    const winnerConfidence = $('#winnerConfidence');
    const winnerMatch = $('#winnerMatch');
    const winnerReason = $('#winnerReason');
    const top3List = $('#top3List');
    const riskLevel = $('#riskLevel');
    const riskLabel = $('#riskLabel');
    const riskDetails = $('#riskDetails');

    const qs = new URLSearchParams(window.location.search);
    const ids = (qs.get('ids') || '').split(',').filter(Boolean);

    let allCandidates = [];
    let currentFilter = 'all';

    if (ids.length === 0) {
        if (container) container.innerHTML = '<p>No se seleccionaron candidatos para comparar.</p>';
        return;
    }

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 200);
            return;
        }
        setupFilterListeners();
        await fetchData();
    }

    function setupFilterListeners() {
        const filters = {
            'filterAll': 'all',
            'filterAptos': 'aptos',
            'filterDocs': 'docs',
            'filterTop10': 'top10'
        };

        Object.keys(filters).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = () => {
                    // Update UI active state
                    document.querySelectorAll('.btn-ghost-accent').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    currentFilter = filters[id];
                    renderAll();
                };
            }
        });
    }

    async function fetchData() {
        try {
            // 1. Fetch Candidates
            const { data: candData, error: candErr } = await window.supabase
                .from('candidates')
                .select('*')
                .in('id', ids);

            if (candErr) throw candErr;

            // 2. Fetch Credentials for Risk Audit
            const { data: credData, error: credErr } = await window.supabase
                .from('credentials')
                .select('*')
                .in('candidate_id', ids);

            // Attach credentials to candidates
            allCandidates = candData.map(c => ({
                ...c,
                credentials: (credData || []).filter(cr => cr.candidate_id === c.id)
            }));

            // 3. Initial Sort (System Best Choice)
            allCandidates.sort((a, b) => {
                const scoreA = calculateDeepScore(a);
                const scoreB = calculateDeepScore(b);
                return scoreB - scoreA;
            });

            renderAll();

        } catch (err) {
            console.error('Error in decision hub init:', err);
        }
    }

    function calculateDeepScore(c) {
        const match = Number(c.match_score) || 0;
        const nota = Number(String(c.nota || '0').replace(',', '.'));
        // Weighted formula: 70% Match IA + 30% Nota (normalized to 100)
        return (match * 0.7) + ((nota / 7) * 30);
    }

    function calculateRisk(c) {
        if (!c.credentials || c.credentials.length === 0) return { level: 'LOW', color: 'var(--muted)', msg: 'SIN AUDITORÍA DOCUMENTAL' };
        
        const now = new Date();
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(now.getDate() + 30);

        let expiredCount = 0;
        let warningCount = 0;

        c.credentials.forEach(cred => {
            if (!cred.expiry_date) return;
            const exp = new Date(cred.expiry_date);
            if (exp < now) expiredCount++;
            else if (exp < thirtyDaysOut) warningCount++;
        });

        if (expiredCount > 0) return { level: 'HIGH', color: '#ef4444', msg: `${expiredCount} DOCS VENCIDOS` };
        if (warningCount > 0) return { level: 'MED', color: '#f59e0b', msg: `${warningCount} DOCS POR VENCER` };
        return { level: 'LOW', color: '#10b981', msg: 'CUMPLIMIENTO TOTAL' };
    }

    function renderAll() {
        let filtered = [...allCandidates];

        if (currentFilter === 'aptos') {
            filtered = filtered.filter(c => calculateDeepScore(c) >= 80);
        } else if (currentFilter === 'docs') {
            filtered = filtered.filter(c => calculateRisk(c).level === 'LOW');
        } else if (currentFilter === 'top10') {
            filtered = filtered.slice(0, 10);
        }

        renderDecisionHub();
        renderMatrix(filtered);
        renderDetailedGrid(filtered);
    }

    function renderDecisionHub() {
        const winner = allCandidates[0];
        if (!winner) return;

        // Banner Winner
        if (winnerName) winnerName.textContent = winner.nombre_completo;
        if (winnerConfidence) winnerConfidence.textContent = `CONFIANZA STARK: ${Math.round(calculateDeepScore(winner))}%`;
        if (winnerMatch) winnerMatch.textContent = `MATCH IA: ${winner.match_score || 85}%`;
        
        if (winnerReason) {
            const nota = Number(String(winner.nota || '0').replace(',', '.'));
            winnerReason.innerHTML = `
                <b>MOTIVO DE SELECCIÓN:</b> ${winner.nombre_completo} presenta el mayor equilibrio operativo. 
                Con <b>${winner.experiencia_total || 'N/A'} años</b> de trayectoria y una nota operacional de <b>${nota}</b>, 
                representa el menor riesgo de integración y el mayor expertiz técnico para la vacante.
            `;
        }

        // Top 3 List
        if (top3List) {
            top3List.innerHTML = allCandidates.slice(0, 3).map((c, i) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:6px 12px; border-radius:6px; border-left:3px solid ${i===0?'#10b981':'#22d3ee'};">
                   <div style="font-size:12px; font-weight:bold;">${i+1}. ${c.nombre_completo.split(' ')[0]} ${c.nombre_completo.split(' ')[1] || ''}</div>
                   <div style="font-size:10px; font-family:'JetBrains Mono'; color:var(--accent);">${Math.round(calculateDeepScore(c))}%</div>
                </div>
            `).join('');
        }

        // Global Audit Risk (Worst case among top 3)
        const top3Risks = allCandidates.slice(0, 3).map(calculateRisk);
        const worstRisk = top3Risks.sort((a,b) => {
            const weights = { 'HIGH': 3, 'MED': 2, 'LOW': 1 };
            return weights[b.level] - weights[a.level];
        })[0];

        if (riskLevel) {
            riskLevel.textContent = worstRisk.level;
            riskLevel.style.color = worstRisk.color;
        }
        if (riskLabel) {
            riskLabel.textContent = worstRisk.msg;
            riskLabel.style.color = worstRisk.color;
        }

        // Action Buttons Setup
        const btnHire = $('#btnHireWinner');
        const btnSend = $('#btnSendToClient');

        if (btnHire) {
            btnHire.onclick = () => updateCandidateStatus(winner.id, 'Contratado', winner.nombre_completo);
        }
        if (btnSend) {
            btnSend.onclick = () => updateCandidateStatus(winner.id, 'Presentado a Cliente', winner.nombre_completo);
        }
    }

    async function updateCandidateStatus(id, status, name) {
        if (!confirm(`¿Confirmar acción operativa: [${status}] para ${name}?`)) return;
        
        const { error } = await window.supabase
            .from('candidates')
            .update({ status: status })
            .eq('id', id);

        if (error) {
            alert('Error en protocolo: ' + error.message);
        } else {
            alert(`SISTEMA: ${name} ha sido marcado como "${status.toUpperCase()}".`);
            location.reload();
        }
    }

    function renderMatrix(candidates) {
        if (!matrixHeader || !matrixBody) return;

        let headHtml = '<th>FACTOR TÁCTICO</th>';
        candidates.forEach(c => {
            headHtml += `<th style="text-align:center;">${c.nombre_completo.split(' ')[0]}</th>`;
        });
        matrixHeader.innerHTML = headHtml;

        const factors = [
            { label: 'EXPERIENCIA', key: 'experiencia_total', suffix: ' AÑOS' },
            { label: 'CALIFICACIÓN', key: 'nota', prefix: '⭐ ' },
            { label: 'STARK MATCH', key: 'match_score', suffix: '%' },
            { label: 'AUDIT DOCS', val: (c) => calculateRisk(c).level }
        ];

        let bodyHtml = '';
        factors.forEach(f => {
            bodyHtml += `<tr><td style="font-size:10px; font-weight:800; opacity:0.6;">${f.label}</td>`;
            candidates.forEach(c => {
                let val = f.val ? f.val(c) : ((f.prefix || '') + (c[f.key] || '—') + (f.suffix || ''));
                let color = '#fff';
                if (val === 'HIGH') color = '#ef4444';
                else if (val === 'MED') color = '#f59e0b';
                else if (val === 'LOW' || val.includes('7') || (f.key === 'match_score' && Number(val.replace('%','')) > 80)) color = '#10b981';
                
                bodyHtml += `<td style="text-align:center; color:${color}; font-weight:bold; font-size:12px;">${val}</td>`;
            });
            bodyHtml += '</tr>';
        });
        matrixBody.innerHTML = bodyHtml;
    }

    function renderDetailedGrid(candidates) {
        if (!container) return;
        container.innerHTML = '';

        candidates.forEach((c, idx) => {
            const confidence = calculateDeepScore(c);
            const risk = calculateRisk(c);
            const isWinner = allCandidates[0].id === c.id;

            const div = document.createElement('div');
            div.className = `card stark-card ${isWinner ? 'winner-card' : ''}`;
            div.style.border = isWinner ? '1px solid var(--ok)' : '1px solid rgba(255,255,255,0.05)';

            div.innerHTML = `
                ${isWinner ? '<div class="best-option-badge" style="background:var(--ok); color:#000; font-weight:900; font-size:9px; padding:2px 8px; position:absolute; top:-10px; left:20px; border-radius:4px;">RECOMENDACIÓN_TOP</div>' : ''}
                <div class="card__body" style="padding:20px; display:flex; flex-direction:column; height:100%;">
                    <div class="stark-header" style="margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px;">
                        <div style="font-size:9px; opacity:0.5; font-family:'JetBrains Mono';">RANKING: #${allCandidates.findIndex(x => x.id === c.id)+1}</div>
                        <h4 style="margin:5px 0; font-size:16px; color:${isWinner?'var(--ok)':'#fff'};">${c.nombre_completo}</h4>
                        <div style="font-size:10px; color:${risk.color}; font-weight:bold;">AUDIT: ${risk.level}</div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                        <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div style="font-size:18px; font-weight:900; color:var(--accent);">${Math.round(confidence)}%</div>
                            <div style="font-size:9px; opacity:0.5;">CONFIANZA</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                            <div style="font-size:18px; font-weight:900;">${c.nota || '—'}</div>
                            <div style="font-size:9px; opacity:0.5;">NOTA_OP</div>
                        </div>
                    </div>

                    <div style="margin-bottom:20px; font-size:12px; line-height:1.5; color:rgba(255,255,255,0.7); overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
                        ${c.evaluacion_general || 'Análisis ejecutivo pendiente de sincronización profunda...'}
                    </div>

                    <div style="margin-top:auto; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <button class="btn btn-sm" style="background:rgba(255,255,255,0.05); font-size:10px;" onclick="location.href='candidates.html?id=${c.id}'">VER MÁS</button>
                        <button class="btn btn-sm" style="background:#10b981; color:#000; border:none; font-weight:bold; font-size:10px;" onclick="updateCandidateStatus('${c.id}', 'Contratado', '${c.nombre_completo}')">CONTRATAR</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    init();
})();
