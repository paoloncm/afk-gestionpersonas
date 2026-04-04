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
