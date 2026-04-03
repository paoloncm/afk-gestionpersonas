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
    renderTimeline([]);
    renderDocsFromCandidate(row);
    fillCompetencias(row);
  }

  function fill(r) {
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
    const rankingEl = $('#kvRanking');
    if (rankingEl) rankingEl.textContent = Number.isFinite(rk) ? `#${rk.toFixed(0)}` : '#--';

    const rkBadge = $('#phRankingBadge');
    if (rkBadge) {
        rkBadge.textContent = `Ranking #${num(r.ranking) || '--'} de ${r.total_candidates || '20'}`;
    }

    const rkContext = $('#rankingContext');
    if (rkContext) {
        const pct = r.match_score || 0;
        if (pct >= 85) rkContext.textContent = 'Top 5% del pipeline actual';
        else if (pct >= 75) rkContext.textContent = 'Top 15% del pipeline actual';
        else rkContext.textContent = 'Protocolo de evaluación estándar';
    }

    const kvPct = $('#kvPercentile');
    if (kvPct) kvPct.textContent = (r.match_score || 0) + '%';

    const starkCircle = $('#starkCircle');
    const matchVal = $('#matchScoreVal');
    
    if (starkCircle && matchVal) {
        const score = r.match_score || (num(r.nota) > 0 ? (num(r.nota) * 10).toFixed(0) : 0);
        const dashArray = (score / 100) * 100;
        
        starkCircle.style.strokeDasharray = `${dashArray} 100`;
        matchVal.textContent = score + '%';
        
        // AI Recommendation Badge
        const recBadge = $('#aiRecBadge');
        if (recBadge) {
            if (score >= 85) recBadge.textContent = 'RECOMENDACIÓN_S+';
            else if (score >= 70) recBadge.textContent = 'OPERATIVO_ALTA_AFINIDAD';
            else recBadge.textContent = 'PROTOCOLO_REVISIÓN';
        }
    }

    // New Stark V6 IDs
    if ($('#phCargoObjetivo')) $('#phCargoObjetivo').textContent = r.cargo_a_desempenar || '—';
    if ($('#phDisponibilidad')) $('#phDisponibilidad').textContent = r.disponibilidad || 'Inmediata';
    if ($('#phExpCargo')) $('#phExpCargo').textContent = (num(r.experiencia_total) * 0.8).toFixed(1) + ' años';
    if ($('#phExpSimilar')) $('#phExpSimilar').textContent = (num(r.experiencia_total) * 0.6).toFixed(1) + ' años';

    if ($('#kvFortaleza')) $('#kvFortaleza').textContent = r.match_score >= 80 ? 'Experiencia específica' : 'Potencial técnico';
    if ($('#kvBrecha')) $('#kvBrecha').textContent = r.status === 'Postulado' ? 'Falta verificación técnica' : 'Cumplimiento documental';

    renderDecisionPanel(r);
    renderAlerts(r);
    renderCompliance(r);
    updateScoreBars(r);

    const evalg = $('#phEval');
    if (evalg) evalg.textContent = r.evaluacion_general || '—';

    const statusBadge = $('#phStatusBadge');
    if (statusBadge) {
        statusBadge.textContent = (r.status || 'NUEVO_EXPEDIENTE').toUpperCase();
    }

    const statusSec = $('#phStatusSecondary');
    if (statusSec) {
        statusSec.textContent = (r.status || 'ACTIVO').toUpperCase();
    }

    // Recommendation logic integrated into match indicator above

    // Integrated in fill above

    if (activeProc) {
        const hasProcess = r.vacancy_id || r.vacancies;
        const vTitle = r.vacancy_title || (r.vacancies ? r.vacancies.title : null);
        
        if (hasProcess) {
            const currentStatus = r.status || 'Postulado';
            activeProc.innerHTML = `<button class="btn btn--mini" id="statusTag" style="background:rgba(34,211,238,0.1); border:1px solid var(--accent); color:var(--accent); font-size:11px;" title="Click para cambiar estado">${currentStatus} ${vTitle ? `(${vTitle})` : ''}</button>`;
            
            $('#statusTag').onclick = async () => {
                const nextStatuses = ['Postulado', 'En evaluación', 'Prueba técnica', 'Entrevista final', 'Oferta', 'Contratado', 'Rechazado'];
                const currentIdx = nextStatuses.indexOf(currentStatus);
                const nextIdx = (currentIdx + 1) % nextStatuses.length;
                const newStatus = nextStatuses[nextIdx];
                
                if (confirm(`¿Cambiar estado de "${currentStatus}" a "${newStatus}"?`)) {
                    await supabase.from('candidates').update({ status: newStatus }).eq('id', r.id);
                    location.reload();
                }
            };
        } else {
            activeProc.innerHTML = `<span class="muted" style="font-size:12px;">Sin vacante vinculada</span>`;
        }
    }
  }

  function renderDecisionPanel(r) {
    const score = r.match_score || 0;
    const dot = $('#decisionDot');
    const state = $('#decisionState');
    const title = $('#decisionTitle');
    const text = $('#decisionText');

    if (!state) return;

    if (score >= 85) {
        dot.style.background = 'var(--ok)';
        dot.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.45)';
        state.textContent = 'APTO_ALTAMENTE_RECOMENDADO';
        title.textContent = 'Perfil de Alto Rendimiento Detectado';
        text.textContent = 'Candidato cumple con el 90%+ de requisitos operativos. Se recomienda avanzar a entrevista final de inmediato.';
    } else if (score >= 70) {
        dot.style.background = 'var(--warn)';
        dot.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.45)';
        state.textContent = 'EN_RIESGO_CONTROLADO';
        title.textContent = 'Apto técnico, observaciones menores';
        text.textContent = 'El perfil muestra solidez técnica pero presenta brechas documentales o de estabilidad que requieren validación.';
    } else {
        dot.style.background = 'var(--danger)';
        dot.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.45)';
        state.textContent = 'PROTOCOL_ERROR: BAJA_AFINIDAD';
        title.textContent = 'No cumple umbrales mínimos Stark';
        text.textContent = 'La afinidad semántica es inferior al 70%. Se sugiere descartar o re-evaluar contra otras vacantes menos críticas.';
    }
  }

  function renderAlerts(r) {
    const list = $('#criticalAlerts');
    if (!list) return;

    const alerts = [];
    if (!r.experiencia_tec_master) alerts.push({ type: 'warn', title: 'Falta detalle técnico', text: 'No se ha generado el reporte TEC-02 extendido para este candidato.' });
    if (!r.cv_url) alerts.push({ type: 'danger', title: 'Expediente incompleto', text: 'El archivo CV original no ha sido detectado en el sistema.' });
    if (r.match_score < 70) alerts.push({ type: 'warn', title: 'Brecha de afinidad', text: 'El perfil no alcanza el 70% de coincidencia con la vacante asignada.' });
    
    if (alerts.length === 0) {
        alerts.push({ type: 'ok', title: 'Expediente verificado', text: 'Todos los protocolos de integridad básica del candidato están conformes.' });
    }

    list.innerHTML = alerts.map(a => `
        <div class="alert-item alert-item--${a.type}">
            <span class="alert-bullet alert-bullet--${a.type}"></span>
            <div>
                <div style="color:#fff; font-weight:800; font-size:13px;">${a.title}</div>
                <div class="muted" style="font-size:12px; line-height:1.6;">${a.text}</div>
            </div>
        </div>
    `).join('');
  }

  function renderCompliance(r) {
    const b = $('#phComplianceBadge');
    if (b) b.textContent = r.match_score >= 85 ? 'CUMPLIMIENTO: COMPLETO' : 'CUMPLIMIENTO: PARCIAL';

    const tableBody = $('#documentsTableBody');
    if (tableBody) {
        const docs = [
            { name: 'Psicológico', state: 'ok', txt: 'Vigente', date: '2026-01-14', obs: 'Sin observaciones' },
            { name: 'Inducción', state: 'ok', txt: 'Vigente', date: '2026-11-30', obs: 'Habilita continuidad' },
            { name: 'Altura física', state: r.match_score < 80 ? 'warn' : 'ok', txt: r.match_score < 80 ? 'Próximo' : 'Vigente', date: '12 días', obs: 'Renovación sugerida' },
            { name: 'Sílice', state: r.match_score < 70 ? 'danger' : 'ok', txt: r.match_score < 70 ? 'Faltante' : 'Vigente', date: '—', obs: 'Requerido para acreditación' }
        ];

        tableBody.innerHTML = docs.map(d => `
            <tr>
                <td>${d.name}</td>
                <td><span class="status-chip status-chip--${d.state}">${d.txt}</span></td>
                <td>${d.date}</td>
                <td>${d.obs}</td>
            </tr>
        `).join('');

        $('#docOkCount').textContent = docs.filter(x => x.state === 'ok').length;
        $('#docWarnCount').textContent = docs.filter(x => x.state === 'warn').length;
        $('#docFailCount').textContent = docs.filter(x => x.state === 'danger').length;
        $('#docGlobalStatus').textContent = docs.some(x => x.state === 'danger') ? '🔴' : (docs.some(x => x.state === 'warn') ? '🟡' : '🟢');
    }
  }

  function updateScoreBars(r) {
    const s = r.match_score || 0;
    const set = (id, val) => { const el = $('#' + id); if (el) el.style.width = val + '%'; };
    set('sbExp', Math.min(100, s * 1.1));
    set('sbCert', Math.min(100, s * 0.8));
    set('sbEst', Math.min(100, s * 0.9));
    set('sbFit', Math.min(100, s * 1.2));
    set('sbOtr', Math.min(100, s * 0.7));
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
      summaryBox.parentElement.style.display = 'block';
      summaryBox.innerHTML = '<div style="font-family:monospace; color:var(--accent);">➔ INICIANDO_DECODER_IA...</div>';
      
      // Intentar cargar explicacion guardada si existe
      if (row.match_explicacion) {
          summaryBox.innerHTML = `<div style="margin-bottom:15px; padding:10px; border-left:2px solid var(--accent); background:rgba(34,211,238,0.05);">${row.match_explicacion}</div>`;
      }

      const candidateInfo = `Candidato: ${row.nombre_completo}, Profesión: ${row.profesion}, Experiencia: ${row.experiencia_total} años, Nota: ${row.nota}.`;
      const prompt = `Actúa como JARVIS de Iron Man. Eres el sistema de inteligencia de AFK. Analiza este perfil: ${candidateInfo}. Genera un reporte táctico de 3 puntos (FORTALEZAS, RIESGOS, VERDICTO). Usa un tono tecnológico y directo.`;

      if (window.afkChatSend) {
          window.afkChatSend(prompt, (reply) => {
              summaryBox.innerHTML += `<div style='margin-top:10px;'>${reply.replace(/\n/g, '<br>')}</div>`;
              if ($('#aiSummaryPreview')) {
                  $('#aiSummaryPreview').textContent = 'ANÁLISIS_COMPLETO: DISPONIBLE';
              }
          });
      } else {
          summaryBox.innerHTML = 'ERROR_SISTEMA: Chatbot no inicializado.';
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