// ==========================
// AFK RRHH — candidate.js PRO
// Nivel: Enterprise / Codelco Ready
// Adaptado para: Stark Tactical HUD v6
// ==========================
(async function () {

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const num = x => {
    if (x == null || x === "") return 0;
    const n = Number(String(x).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const qs = new URLSearchParams(window.location.search);
  const candidateId = qs.get("id") || qs.get("trabajador_uuid") || qs.get("worker_id");

  if (!candidateId) {
    console.error("❌ No se encontró ID en la URL");
    const main = $('main');
    if (main) {
        main.innerHTML = `
            <div class="stark-card" style="margin:40px auto; max-width:600px; text-align:center;">
                <h2 class="hero-name" style="font-size:24px;">EXPEDIENTE NO IDENTIFICADO</h2>
                <p class="soft">No se pudo encontrar el identificador del candidato en la URL.</p>
                <a href="index.html" class="btn btn--primary" style="margin-top:20px; display:inline-block;">Volver al Dashboard</a>
            </div>
        `;
    }
    return;
  }

  // ==========================
  // 🔥 FETCH DATA COMPLETA
  // ==========================
  async function fetchAll(id) {
    try {
        console.log("📡 Accediendo a base de datos central...");

        // 1. Candidate
        const { data: candidate, error: ce } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', id)
          .single();
        if (ce) throw ce;

        // 2. Worker (si existe)
        const { data: worker } = await supabase
          .from('workers')
          .select('*')
          .eq('candidate_id', id)
          .maybeSingle();

        // 3. Credenciales reales (usando ID de worker si existe)
        let credentials = [];
        if (worker) {
            const { data: creds } = await supabase
              .from('worker_credentials')
              .select('*')
              .eq('worker_id', worker.id);
            credentials = creds || [];
        }

        // 4. Documentos
        let docs = [];
        if (worker) {
            const { data: d } = await supabase
              .from('documents')
              .select('*')
              .eq('worker_id', worker.id);
            docs = d || [];
        }

        return { candidate, worker, credentials, docs };
    } catch (e) {
        console.error("❌ Error fetchAll:", e);
        return { candidate: null, worker: null, credentials: [], docs: [] };
    }
  }

  const { candidate: r, worker, credentials = [], docs = [] } = await fetchAll(candidateId);

  if (!r) {
      alert("No se encontró el candidato en la base de datos.");
      return;
  }

  // ==========================
  // 🔥 NORMALIZACIÓN
  // ==========================
  const score = r.match_score || (r.nota ? r.nota * 10 : 0);
  const today = new Date();

  // ==========================
  // 🔥 CUMPLIMIENTO REAL
  // ==========================
  function evaluateCompliance(creds) {
    let ok = 0, warn = 0, danger = 0;

    const rows = creds.map(c => {
      if (!c.expiry_date) {
        warn++;
        return {
          name: c.credential_name || "Documento sin nombre",
          state: "warn",
          txt: "Sin fecha",
          date: "-",
          obs: "Revisar manualmente"
        };
      }

      const expiry = new Date(c.expiry_date);
      const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) {
        danger++;
        return {
          name: c.credential_name,
          state: "danger",
          txt: "Vencido",
          date: c.expiry_date,
          obs: "Bloquea ingreso"
        };
      }

      if (diffDays < 30) {
        warn++;
        return {
          name: c.credential_name,
          state: "warn",
          txt: "Próximo",
          date: c.expiry_date,
          obs: `${Math.round(diffDays)} días`
        };
      }

      ok++;
      return {
        name: c.credential_name,
        state: "ok",
        txt: "Vigente",
        date: c.expiry_date,
        obs: "OK"
      };
    });

    let status = "ok";
    if (danger > 0) status = "danger";
    else if (warn > 0) status = "warn";

    return { rows, ok, warn, danger, status };
  }

  const compliance = evaluateCompliance(credentials);

  // ==========================
  // 🔥 RENDER HEADER
  // ==========================
  if ($('#phName')) $('#phName').textContent = r.nombre_completo || "SIN NOMBRE";
  if ($('#phProf')) $('#phProf').textContent = r.profesion || r.cargo_postulado || "Sin profesión definida";
  if ($('#phExp')) $('#phExp').textContent = (r.experiencia_total || 0) + " años";
  if ($('#phCargoObjetivo')) $('#phCargoObjetivo').textContent = r.cargo_postulado || "No especificado";
  if ($('#phUltima')) $('#phUltima').textContent = r.ultima_empresa || "Sin datos";

  // SCORE
  if ($('#matchScoreVal')) $('#matchScoreVal').textContent = Math.round(score) + "%";
  if ($('#starkCircle')) {
      const circle = $('#starkCircle');
      circle.style.strokeDasharray = `${score} 100`;
  }

  // ==========================
  // 🔥 DECISION ENGINE
  // ==========================
  const decision = (() => {
    if (compliance.danger > 0) {
      return {
        state: "NO APTO",
        color: "danger",
        text: "Tiene documentos vencidos críticos"
      };
    }

    if (score >= 85 && compliance.status === "ok") {
      return {
        state: "APTO",
        color: "ok",
        text: "Cumple técnica y documentalmente"
      };
    }

    if (score >= 70) {
      return {
        state: "EN RIESGO",
        color: "warn",
        text: "Buen perfil pero faltan validaciones"
      };
    }

    return {
      state: "NO APTO",
      color: "danger",
      text: "Bajo match con la vacante"
    };
  })();

  if ($('#decisionState')) $('#decisionState').textContent = decision.state;
  if ($('#decisionTitle')) $('#decisionTitle').textContent = decision.text;

  const dot = $('#decisionDot');
  if (dot) dot.style.background = `var(--${decision.color})`;

  // ==========================
  // 🔥 ALERTAS INTELIGENTES
  // ==========================
  function renderAlerts() {
    const alerts = [];

    if (compliance.danger > 0) {
      alerts.push({
        type: "danger",
        title: "Documentos vencidos",
        text: `${compliance.danger} credenciales críticas vencidas`
      });
    }

    if (compliance.warn > 0) {
      alerts.push({
        type: "warn",
        title: "Documentos por vencer",
        text: `${compliance.warn} requieren renovación inmediata`
      });
    }

    if (!worker) {
      alerts.push({
        type: "warn",
        title: "Perfil Externo",
        text: "Candidato no registrado como trabajador activo"
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        type: "ok",
        title: "Integridad Confirmada",
        text: "Sin riesgos operativos detectados"
      });
    }

    const container = $('#criticalAlerts');
    if (container) {
        container.innerHTML = alerts.map(a => `
          <div class="alert-item alert-item--${a.type}">
            <span class="alert-bullet alert-bullet--${a.type}"></span>
            <div>
              <b style="color:#fff;">${a.title}</b>
              <div class="soft" style="font-size:12px;">${a.text}</div>
            </div>
          </div>
        `).join('');
    }
  }

  renderAlerts();

  // ==========================
  // 🔥 DOCUMENTOS REALES
  // ==========================
  function renderDocs() {
    const tbody = $('#documentsTableBody');
    if (tbody) {
        if (compliance.rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-dim);">No hay credenciales registradas para este expediente.</td></tr>`;
        } else {
            tbody.innerHTML = compliance.rows.map(d => `
              <tr>
                <td><b style="color:#fff;">${d.name}</b></td>
                <td><span class="status-chip status-chip--${d.state}">${d.txt}</span></td>
                <td style="font-family:monospace;">${d.date}</td>
                <td class="soft">${d.obs}</td>
              </tr>
            `).join('');
        }
    }

    if ($('#docOkCount')) $('#docOkCount').textContent = compliance.ok;
    if ($('#docWarnCount')) $('#docWarnCount').textContent = compliance.warn;
    if ($('#docFailCount')) $('#docFailCount').textContent = compliance.danger;

    if ($('#docGlobalStatus')) {
        $('#docGlobalStatus').textContent =
          compliance.status === "danger" ? "🔴 BLOQUEADO" :
          compliance.status === "warn" ? "🟡 EN RIESGO" : "🟢 HABILITADO";
    }
  }

  renderDocs();

  // ==========================
  // 🔥 SCORE BREAKDOWN REALISTA
  // ==========================
  function updateScoreBars() {
    const set = (id, val) => {
      const bar = $(id);
      if (bar) {
          bar.style.width = val + '%';
          const valLabel = bar.parentElement.parentElement.querySelector('.val');
          if (valLabel) valLabel.textContent = Math.round(val) + '%';
      }
    };

    // Mapeo a los IDs actuales en candidatos.html
    set("#sbExp", Math.min(100, (r.experiencia_total || 0) * 8));
    set("#sbCert", compliance.ok > 0 ? (compliance.ok / (compliance.ok + compliance.warn + compliance.danger)) * 100 : 0);
    set("#sbEst", score * 0.9);
    set("#sbFit", score);
    set("#sbOtr", 40);
  }

  updateScoreBars();

  // ==========================
  // 🔥 SKILLS & EVALUACIÓN
  // ==========================
  function renderSkills() {
      const container = $('#phConoc');
      if (container && r.conocimientos) {
          const skills = Array.isArray(r.conocimientos) ? r.conocimientos : String(r.conocimientos).split(',').map(s => s.trim());
          container.innerHTML = skills.map(s => `<li>${s}</li>`).join('');
      }

      const evalText = $('#phEval');
      if (evalText) {
          evalText.textContent = r.resumen_ia || "Análisis técnico pendiente de validación por IA Stark.";
      }
  }
  renderSkills();

  // ==========================
  // 🔥 IA RESUMEN REAL
  // ==========================
  const aiBtn = $('#btnAiSummary');
  if (aiBtn) {
      aiBtn.onclick = async () => {
        const content = $('#aiSummaryContent');
        if (content) content.innerHTML = "<em>Procesando datos con Stark Intelligence...</em>";

        const prompt = `
            Analiza con rigor táctico este candidato:
            Nombre: ${r.nombre_completo}
            Profesión: ${r.profesion}
            Experiencia: ${r.experiencia_total} años
            Score Técnico: ${score}%
            Estado Doc: ${compliance.status.toUpperCase()}
            Credenciales OK: ${compliance.ok}
            Vencidas: ${compliance.danger}

            Entrega un informe estructurado:
            1. DIAGNÓSTICO OPERATIVO
            2. FORTALEZAS CLAVE
            3. RIESGOS DE SEGURIDAD/CUMPLIMIENTO
            4. RECOMENDACIÓN FINAL
        `;

        if (window.afkChatSend) {
          window.afkChatSend(prompt, (res) => {
            if (content) content.innerHTML = res.replace(/\n/g, "<br>");
          });
        } else {
            console.warn("afkChatSend no disponible");
            if (content) content.innerHTML = "Error: El motor de chat IA no está disponible en este momento.";
        }
      };
  }

})();