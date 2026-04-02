// ==========================
// AFK RRHH — candidate.js
// Adaptado a tabla: candidates
// ==========================
(async function () {
  const $ = s => document.querySelector(s);
  const num = x => (x == null || x === '') ? NaN : Number(String(x).replace(',', '.'));

  const qs = new URLSearchParams(window.location.search);
  const candidateId = qs.get('id') || qs.get('trabajador_uuid') || qs.get('worker_id');
  const candidateId2 = qs.get('id_2');
  
  console.log('🔍 Raw search string:', window.location.search);
  console.log('🔍 All search params:', Array.from(qs.keys()));
  console.log('🔍 Candidate ID detected:', candidateId);
  
  if (!candidateId) {
    console.warn('⚠️ No se encontró ID en URL:', window.location.href);
    const main = $('main');
    if (main) {
        main.innerHTML = `
            <div class="card" style="margin-top:20px;">
                <div class="card__body" style="text-align:center; padding:40px;">
                    <h2 class="h1">Candidato no especificado</h2>
                    <p class="text-muted">No se pudo encontrar el identificador del candidato en la URL.</p>
                    <div style="font-family:monospace; background:rgba(0,0,0,0.5); padding:10px; border-radius:4px; margin:10px 0; font-size:12px;">
                        Query: ${window.location.search || '(vacío)'}
                    </div>
                    <p style="font-size:12px; color:#888;">Por favor revisa la consola (F12) para más detalles técnicos.</p>
                    <a href="index.html" class="btn btn--primary" style="margin-top:20px; display:inline-block; text-decoration:none;">Volver al Dashboard</a>
                </div>
            </div>
        `;
    }
    return;
  }

  async function fetchCandidate(id) {
    console.log('📡 Fetching candidate:', id);
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
        console.error('❌ Supabase fetch error:', error);
        throw error;
    }
    console.log('✅ Candidate data received:', data);
    return data;
  }

  let row = null;
  let row2 = null;

  try {
    row = await fetchCandidate(candidateId);

    if (candidateId2 && candidateId2 !== candidateId) {
      row2 = await fetchCandidate(candidateId2);
    }
  } catch (err) {
    console.error('❌ Error cargando candidato:', err);
    // FALLBACK: Si no lo encuentra en candidates, podría ser que ya sea worker
    console.log('🔍 Fallback: Checking if ID belongs to a worker...');
    try {
        const { data: workerData, error: workerErr } = await supabase
            .from('workers')
            .select('id')
            .eq('id', candidateId)
            .single();
        
        if (workerData) {
            console.log('✅ Worker found! Redirecting to worker profile');
            const isServer = window.location.protocol.startsWith('http');
            const wBase = isServer ? 'worker' : 'worker.html';
            window.location.href = `${wBase}?id=${workerData.id}`;
            return;
        }
    } catch (wErr) {
        console.warn('⚠️ No worker fallback found either.');
    }
    return;
  }

  if (!row) {
    console.error('❌ No se encontró candidato');
    return;
  }

  if (row) {
    // Si tiene vacante, buscamos su nombre manualmente (fallback de FK)
    if (row.vacancy_id) {
       const { data: vData } = await supabase.from('vacancies').select('title').eq('id', row.vacancy_id).single();
       if (vData) row.vacancy_title = vData.title;
    }
    fill(row);
    radar(row, row2);
    expTimeline(row);
    renderTimeline([]);
    renderDocsFromCandidate(row);
    fillCompetencias(row);
  }

  function fill(r) {
    const seed = encodeURIComponent(r.nombre_completo || 'AFK');
    const avatar = $('#phAvatar');
    if (avatar) avatar.src = `https://i.pravatar.cc/72?u=${seed}`;

    const name = $('#phName');
    if (name) name.textContent = r.nombre_completo || '—';

    const prof = $('#phProf');
    if (prof) prof.textContent = r.profesion || '—';

    const contact = $('#phContact');
    if (contact) contact.textContent = [r.correo, r.telefono].filter(Boolean).join(' · ') || '—';

    const ultima = $('#phUltima');
    if (ultima) ultima.textContent = r.ultima_exp_laboral_empresa || '—';

    const cargo = $('#phCargo');
    if (cargo) cargo.textContent = r.cargo || '—';

    const per = $('#phPeriodo');
    if (per) per.textContent = r.periodo || '—';

    const e = num(r.experiencia_total);
    const exp = $('#phExp');
    if (exp) exp.textContent = Number.isFinite(e) ? `${e.toFixed(1)} años` : '—';

    const n = num(r.nota);
    const nota = $('#phNota');
    if (nota) nota.textContent = Number.isFinite(n) ? n.toFixed(1) : '—';

    const rk = num(r.ranking);
    const rankingEl = $('#phRanking');
    if (rankingEl) rankingEl.textContent = Number.isFinite(rk) ? rk.toFixed(0) : '—';

    const matchCont = $('#aiMatchContainer');
    const matchVal = $('#matchScoreVal');
    const btnGuide = $('#btnAiGuide');
    if (matchCont && matchVal) {
        if (r.match_score) {
            matchCont.style.display = 'block';
            matchVal.textContent = r.match_score;
            if (btnGuide) btnGuide.style.display = 'block';
        } else {
            matchCont.style.display = 'none';
            if (btnGuide) btnGuide.style.display = 'none';
        }
    }

    const evalg = $('#phEval');
    if (evalg) evalg.textContent = r.evaluacion_general || '—';

    const activeProc = $('#activeProcess');
    if (activeProc) {
        const hasProcess = r.vacancy_id || r.vacancies;
        const vTitle = r.vacancy_title || (r.vacancies ? r.vacancies.title : null);
        
        if (hasProcess) {
            const currentStatus = r.status || r.estado || 'Postulado';
            activeProc.innerHTML = `<span class="tag clickable-tag" id="statusTag" style="background:rgba(0,255,100,0.1); color:#00ff64; font-size:12px; cursor:pointer;" title="Click para cambiar estado">Fase: ${currentStatus} ${vTitle ? `(${vTitle})` : ''}</span>`;
            
            $('#statusTag').onclick = async () => {
                const nextStatuses = ['Postulado', 'Entrevista inicial', 'Prueba técnica', 'Entrevista final', 'Oferta', 'Contratado', 'Rechazado'];
                const currentStatus = r.status || r.estado || 'Postulado';
                const currentIdx = nextStatuses.indexOf(currentStatus);
                const nextIdx = (currentIdx + 1) % nextStatuses.length;
                const newStatus = nextStatuses[nextIdx];
                
                if (confirm(`¿Cambiar estado de "${currentStatus}" a "${newStatus}"?`)) {
                    const { error } = await supabase
                        .from('candidates')
                        .update({ status: newStatus })
                        .eq('id', r.id);
                    
                    if (error) alert('Error: ' + error.message);
                    else {
                        await logHistory(r.id, 'status_change', currentStatus, newStatus);
                        const updated = await fetchCandidate(r.id);
                        // Refresh manually merged data
                        if (updated.vacancy_id) {
                            const { data: vData } = await supabase.from('vacancies').select('title').eq('id', updated.vacancy_id).single();
                            if (vData) updated.vacancy_title = vData.title;
                        }
                        fill(updated);
                        loadHistory();
                    }
                }
            };
        } else {
            activeProc.innerHTML = `<span class="tag" style="background:rgba(255,255,255,0.05); font-size:12px;">Sin vacante vinculada</span>`;
        }
    }
  }

  function radar(r, compareCandidate = null) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));

    function calcEdadYears(fechaNacimiento) {
      if (!fechaNacimiento) return NaN;
      const d = new Date(fechaNacimiento);
      if (Number.isNaN(d.getTime())) return NaN;
      const diff = Date.now() - d.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }

    function buildProfile(row) {
      const expYears = num(row.experiencia_total);
      const edadYears = calcEdadYears(row.fecha_nacimiento);
      const nota = num(row.nota);
      const notaTec = num(row.nota);
      const ranking = num(row.ranking);

      const expN = clamp((Number.isFinite(expYears) ? expYears : 0) / 2, 0, 10);
      const edadN = clamp((Number.isFinite(edadYears) ? edadYears : 0) / 6, 0, 10);
      const notaTecN = clamp(notaTec, 0, 10);
      const rankingN = clamp(ranking, 0, 10);
      const notaN = clamp(nota, 0, 10);

      return {
        label: row.nombre_completo || 'Candidato',
        values: [expN, edadN, notaTecN, rankingN, notaN]
      };
    }

    const labels = ['Experiencia', 'Edad', 'Nota técnica', 'Ranking', 'Nota'];

    const base = buildProfile(r);
    const datasets = [{
      label: base.label,
      data: base.values,
      pointRadius: 3,
      borderWidth: 2,
      fill: true
    }];

    if (compareCandidate) {
      const cmp = buildProfile(compareCandidate);
      datasets.push({
        label: cmp.label,
        data: cmp.values,
        pointRadius: 3,
        borderWidth: 2,
        fill: true
      });
    }

    const canvas = $('#radar');
    if (!canvas) return;

    if (!window._afkRadar) {
      window._afkRadar = new Chart(canvas, {
        type: 'radar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 700, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              display: datasets.length > 1,
              labels: { color: '#fff' }
            },
            tooltip: { enabled: true }
          },
          scales: {
            r: {
              min: 0,
              max: 10,
              ticks: {
                stepSize: 2,
                backdropColor: 'transparent',
                color: '#aaa'
              },
              grid: { color: 'rgba(255,255,255,0.10)' },
              angleLines: { color: 'rgba(255,255,255,0.15)' },
              pointLabels: { color: '#fff', font: { size: 12, weight: '600' } }
            }
          }
        }
      });
      return;
    }

    window._afkRadar.data.labels = labels;
    window._afkRadar.data.datasets = datasets;
    window._afkRadar.options.plugins.legend.display = datasets.length > 1;
    window._afkRadar.update();
  }

  function expTimeline(r) {
    const y = num(r.experiencia_total) || 0;
    const el = $('#expTimeline');
    if (!el) return;

    if (window._afkExpTimeline) window._afkExpTimeline.destroy();
    window._afkExpTimeline = new Chart(el, {
      type: 'bar',
      data: {
        labels: [r.ultima_exp_laboral_empresa || 'Experiencia'],
        datasets: [{ data: [y * 12] }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderTimeline(items) {
    const el = $('#stageTimeline');
    if (!el) return;

    el.innerHTML = items.length
      ? items.map(i => `
          <li>
            <strong>${escapeHtml(i.etapa)}</strong> · ${escapeHtml(i.fecha)}
            ${i.detalles ? `<div class="text-muted" style="font-size:12px; margin-top:4px; font-style:italic;">"${escapeHtml(i.detalles)}"</div>` : ''}
          </li>
        `).join('')
      : '<li>Sin historial</li>';
  }

  function renderDocsFromCandidate(r) {
    const docs = [];

    if (r.cv_url) {
      docs.push({ name: 'CV original', url: r.cv_url });
    }

    if (r.pdf_tec02a_url) {
      docs.push({ name: 'TEC-02A PDF', url: r.pdf_tec02a_url });
    }

    if (r.sheet_url) {
      docs.push({ name: 'Ficha Google Sheet', url: r.sheet_url });
    }

    renderDocs(docs);

    const viewer = $('#pdfViewer');
    if (viewer) {
      viewer.src = r.pdf_tec02a_url || '';
    }
  }

  function renderDocs(docs) {
    const el = $('#docList');
    if (!el) return;

    el.innerHTML = docs.length
      ? docs.map(d => {
        const name = escapeHtml(d.name || 'Documento');
        const url = d.url || '#';
        return `<a href="${url}" target="_blank" rel="noopener">📄 ${name}</a>`;
      }).join('<br>')
      : 'Sin documentos';
  }

  function tokenize(t) {
    return String(t || '')
      .split(/,|\n|;/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  function fillCompetencias(r) {
    const ul1 = $('#phConoc');
    const ul2 = $('#phOtrasExp');

    if (ul1) {
      ul1.innerHTML = tokenize(r.experiencia_especifica)
        .map(x => `<li>${escapeHtml(x)}</li>`)
        .join('');
    }

    if (ul2) {
      ul2.innerHTML = tokenize(r.otras_experiencias)
        .map(x => `<li>${escapeHtml(x)}</li>`)
        .join('');
    }
  }

  // AI Summary Logic
  const btnAi = $('#btnAiSummary');
  const summaryBox = $('#aiSummaryContent');

  if (btnAi) {
    btnAi.onclick = async () => {
      summaryBox.innerHTML = '<i>Analizando perfil con IA...</i>';
      
      // Dispatch event to chat.js if needed, or call n8n directly
      const candidateInfo = `Candidato: ${row.nombre_completo}, Profesión: ${row.profesion}, Experiencia: ${row.experiencia_total} años, Nota: ${row.nota}. Evaluación actual: ${row.evaluacion_general}`;
      const prompt = `Por favor, genera un resumen ejecutivo de 3 puntos clave para este candidato: ${candidateInfo}. Sé breve y profesional.`;

      // We can use the window.afkChat function if we expose it in chat.js
      if (window.afkChatSend) {
          window.afkChatSend(prompt, (reply) => {
              summaryBox.innerHTML = reply.replace(/\n/g, '<br>');
          });
      } else {
          summaryBox.innerHTML = 'El chatbot no está listo. Intenta de nuevo en un momento.';
      }
    };
  }

  // Recruitment Management Logic
  const selectVacancy = $('#selectVacancy');
  const btnLink = $('#btnLinkVacancy');
  const inputDate = $('#interviewDate');
  const btnSchedule = $('#btnScheduleInterview');

  async function loadVacancies() {
    const { data, error } = await supabase.from('vacancies').select('id, title').eq('status', 'Abierta');
    if (error) return console.error('Error loading vacancies:', error);
    
    selectVacancy.innerHTML = '<option value="">Seleccionar vacante...</option>';
    data.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.title;
      if (v.id === row.vacancy_id) opt.selected = true;
      selectVacancy.appendChild(opt);
    });
  }

  if (btnLink) {
    btnLink.onclick = async () => {
      const vacancyId = selectVacancy.value;
      if (!vacancyId) return alert('Selecciona una vacante');
      
      const { error } = await supabase
        .from('candidates')
        .update({ vacancy_id: vacancyId })
        .eq('id', candidateId);

      if (error) alert('Error al vincular: ' + error.message);
      else {
          alert('Candidato vinculado con éxito');
          await logHistory(candidateId, 'vacancy_link', row.vacancy_id || 'Ninguna', vacancyId);
          const updated = await fetchCandidate(candidateId);
          // Refresh manually merged data
          if (updated.vacancy_id) {
              const { data: vData } = await supabase.from('vacancies').select('title').eq('id', updated.vacancy_id).single();
              if (vData) updated.vacancy_title = vData.title;
          }
          row = updated;
          fill(updated);
          loadHistory();
      }
    };
  }

  if (btnSchedule) {
    btnSchedule.onclick = async () => {
      const date = inputDate.value;
      if (!date) return alert('Selecciona una fecha y hora');
      
      const { error } = await supabase
        .from('interviews')
        .insert([{
          candidate_id: candidateId,
          vacancy_id: selectVacancy.value || null,
          interview_date: new Date(date).toISOString(),
          status: 'Programada'
        }]);

      if (error) alert('Error al programar: ' + error.message);
      else {
          alert('Entrevista programada');
          loadCandidateInterviews(); // Refrescar si existe
      }
    };
  }

  async function logHistory(cid, type, oldVal, newVal) {
      await supabase.from('candidate_history').insert([{
          candidate_id: cid,
          event_type: type,
          old_value: String(oldVal),
          new_value: String(newVal)
      }]);
  }

  async function loadHistory() {
      // Fetch interviews
      const { data: interviews } = await supabase
          .from('interviews')
          .select('id, interview_date, status, notes')
          .eq('candidate_id', candidateId);
      
      // Fetch audit logs
      const { data: logs } = await supabase
          .from('candidate_history')
          .select('*')
          .eq('candidate_id', candidateId);

      const items = [];

      if (interviews) {
          interviews.forEach(i => items.push({
              etapa: `Entrevista: ${i.status}`,
              fecha: i.interview_date,
              detalles: i.notes,
              sort: new Date(i.interview_date)
          }));
      }

      if (logs) {
          logs.forEach(l => {
              let label = 'Evento';
              if (l.event_type === 'status_change') label = `Cambio de fase: ${l.new_value}`;
              if (l.event_type === 'vacancy_link') label = `Vinculación a vacante`;
              
              items.push({
                  etapa: label,
                  fecha: l.created_at,
                  detalles: (l.old_value && l.old_value !== 'null') ? `De "${l.old_value}" a "${l.new_value}"` : `Nuevo valor: "${l.new_value}"`,
                  sort: new Date(l.created_at)
              });
          });
      }

      items.sort((a,b) => b.sort - a.sort);
      
      renderTimeline(items.map(i => ({
          etapa: i.etapa,
          fecha: new Date(i.fecha).toLocaleString('es-ES'),
          detalles: i.detalles
      })));
  }

  loadVacancies();
  loadHistory();

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();