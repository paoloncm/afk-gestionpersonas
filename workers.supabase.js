console.log("[workers.supabase.js] archivo cargado");

(async function () {
  const $ = (s) => document.querySelector(s);
  const tableBody = $("#workersTable");

  let allWorkers = [];
  let allExamRecords = [];
  let selectedWorkers = new Set();

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeStatus(status) {
    const s = String(status || "").trim().toLowerCase();
    if (s === "activo" || s === "active") return "Activo";
    if (s === "inactivo" || s === "inactive") return "Inactivo";
    return status || "Activo";
  }

  function safeNum(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function normalizeRut(value) {
    return String(value || "")
      .replace(/\./g, "")
      .replace(/-/g, "")
      .replace(/\s+/g, "")
      .trim()
      .toUpperCase();
  }

  function sameRut(a, b) {
    const ra = normalizeRut(a);
    const rb = normalizeRut(b);
    return ra && rb && ra === rb;
  }

  function isInfpsico(record) {
    const examType = String(record?.exam_type || "").toLowerCase();
    const name = String(record?.credential_name || "").toUpperCase();
    return examType === "infpsico" || name.includes("INFPSICO");
  }

  function toDateOrEmpty(value) {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d;
  }

  function sortExamsNewest(exams) {
    return [...exams].sort((a, b) => {
      const da = a.exam_date ? new Date(a.exam_date).getTime() : 0;
      const db = b.exam_date ? new Date(b.exam_date).getTime() : 0;
      return db - da;
    });
  }

  function getWorkerDocs(workerId) {
    const worker = allWorkers.find((w) => String(w.id) === String(workerId));
    if (!worker) return [];

    return allExamRecords.filter((r) => sameRut(r.rut, worker.rut));
  }

  function getComplianceSummary(workerId) {
    const now = new Date();
    const docs = getWorkerDocs(workerId);

    if (!docs.length) {
      return {
        total: 0,
        expired: 0,
        upcoming: 0,
        noExpiry: 0,
        healthy: 0,
        badgeClass: "badge--inactive",
        badgeText: "Sin documentos",
        dotClass: "dot dot--gray",
        faenaClass: "badge--inactive",
        faenaText: "Sin información",
      };
    }

    let expired = 0;
    let upcoming = 0;
    let noExpiry = 0;
    let healthy = 0;

    docs.forEach((doc) => {
      if (isInfpsico(doc)) {
        noExpiry += 1;
        return;
      }

      if (!doc.expiry_date) {
        noExpiry += 1;
        return;
      }

      const expiry = new Date(doc.expiry_date);
      if (Number.isNaN(expiry.getTime())) {
        noExpiry += 1;
        return;
      }

      const diffMs = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) expired += 1;
      else if (diffDays <= 30) upcoming += 1;
      else healthy += 1;
    });

    if (expired > 0) {
      return {
        total: docs.length,
        expired,
        upcoming,
        noExpiry,
        healthy,
        badgeClass: "badge--danger",
        badgeText: `${expired} vencido${expired > 1 ? "s" : ""}`,
        dotClass: "dot dot--red",
        faenaClass: "badge--danger",
        faenaText: "No habilitado",
      };
    }

    if (upcoming > 0) {
      return {
        total: docs.length,
        expired,
        upcoming,
        noExpiry,
        healthy,
        badgeClass: "badge--warning",
        badgeText: `${upcoming} por vencer`,
        dotClass: "dot dot--yellow",
        faenaClass: "badge--warning",
        faenaText: "En riesgo",
      };
    }

    return {
      total: docs.length,
      expired,
      upcoming,
      noExpiry,
      healthy,
      badgeClass: "badge--success",
      badgeText: "Al día",
      dotClass: "dot dot--green",
      faenaClass: "badge--success",
      faenaText: "Habilitado",
    };
  }

  function buildExamRows(workers, examRecords) {
    const rows = [];

    workers.forEach((worker) => {
      const workerExams = sortExamsNewest(
        examRecords.filter((r) => sameRut(r.rut, worker.rut))
      );

      if (!workerExams.length) {
        rows.push({
          obs: "",
          faena: worker.company_name || "",
          rut: worker.rut || "",
          colaborador: worker.full_name || "",
          fecha: new Date(),
          examen: "SIN EXAMEN REGISTRADO",
          peso: null,
          talla: null,
          cintura: null,
          imc: null,
          presion: "",
          frec_card: null,
          actividad_fisica: "",
          framingham: "",
          ecg: "",
          audiometria: "",
          audiometria_conclusion: "",
          test_ruffier: "",
          rx_torax: "",
          rx_neumoconiosis_oit: "",
          epworth: "",
          lake_louise: "",
          glucosa: null,
          creatinina: null,
          colesterol_total: null,
          hdl: null,
          ldl: null,
          trigliceridos: null,
          inr: null,
          protrombina: null,
          bilirrubina_total: null,
          gpt: null,
          hemoglobina: null,
          hematocrito: null,
          plaquetas: null,
          creatininuria: null,
          anfetaminas: "",
          benzodiazepinas: "",
          canabinoides: "",
          cocaina: "",
          observacion_general: "",
          fecha_informe_revisado: "",
          riesgo_evaluado: "",
          observaciones: "",
          proximo_control: "",
          contraindicacion_achs: "",
          fecha_registro_contraind: "",
          riesgo_contraindicado: "",
          tipo_contraindicacion: "",
          recomendacion_interna: ""
        });
        return;
      }

      workerExams.forEach((exam) => {
        rows.push({
          obs: exam.obs || exam.observation || "",
          faena: exam.faena || worker.company_name || "",
          rut: exam.rut || worker.rut || "",
          colaborador: exam.full_name || worker.full_name || "",
          fecha: exam.exam_date ? new Date(exam.exam_date) : new Date(),
          examen: [
            exam.credential_name || "EXAMEN",
            exam.exam_type ? `(${exam.exam_type})` : ""
          ].join(" ").trim(),

          peso: safeNum(exam.peso),
          talla: safeNum(exam.talla),
          cintura: safeNum(exam.cintura),
          imc: safeNum(exam.imc),
          presion: exam.presion || "",
          frec_card: safeNum(exam.frec_card),
          actividad_fisica: exam.actividad_fisica || "",
          framingham: exam.framingham || "",
          ecg: exam.ecg || "",
          audiometria: exam.audiometria || "",
          audiometria_conclusion: exam.audiometria_conclusion || "",
          test_ruffier: exam.test_ruffier || "",
          rx_torax: exam.rx_torax || "",
          rx_neumoconiosis_oit: exam.rx_neumoconiosis_oit || "",
          epworth: exam.epworth || "",
          lake_louise: exam.lake_louise || "",
          glucosa: safeNum(exam.glucosa),
          creatinina: safeNum(exam.creatinina),
          colesterol_total: safeNum(exam.colesterol_total),
          hdl: safeNum(exam.hdl),
          ldl: safeNum(exam.ldl),
          trigliceridos: safeNum(exam.trigliceridos),
          inr: safeNum(exam.inr),
          protrombina: safeNum(exam.protrombina_pct),
          bilirrubina_total: safeNum(exam.bilirrubina_total),
          gpt: safeNum(exam.gpt),
          hemoglobina: safeNum(exam.hemoglobina),
          hematocrito: safeNum(exam.hematocrito),
          plaquetas: safeNum(exam.plaquetas),
          creatininuria: safeNum(exam.creatininuria),
          anfetaminas: exam.anfetaminas || "",
          benzodiazepinas: exam.benzodiazepinas || "",
          canabinoides: exam.canabinoides || "",
          cocaina: exam.cocaina || "",
          observacion_general: exam.recomendaciones_generales || "",
          fecha_informe_revisado: toDateOrEmpty(exam.reviewed_date),
          riesgo_evaluado: exam.riesgo_evaluado || "",
          observaciones: exam.observaciones || exam.observation || "",
          proximo_control: toDateOrEmpty(exam.next_control_date),
          contraindicacion_achs: exam.contraindicacion_achs || "",
          fecha_registro_contraind: toDateOrEmpty(exam.fecha_registro_contraind),
          riesgo_contraindicado: exam.riesgo_contraindicado || "",
          tipo_contraindicacion: exam.tipo_contraindicacion || "",
          recomendacion_interna: exam.recomendacion_interna || ""
        });
      });
    });

    return rows;
  }

  async function init() {
    if (!tableBody) {
      console.error("No se encontró #workersTable");
      return;
    }

    if (!window.db) {
      console.error("[workers.supabase.js] window.db no está disponible");
      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Error: no se pudo inicializar la conexión con Supabase.
        </div>
      `;
      return;
    }

    console.log("[workers.supabase.js] init ok");
    setupFilters();
    await loadAllData();
  }

  async function loadAllData() {
    try {
      console.log("[workers.supabase.js] cargando datos...");

      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Cargando trabajadores y documentación...
        </div>
      `;

      const [
        { data: workers, error: workersError },
        { data: exams, error: examsError }
      ] = await Promise.all([
        window.db.from("workers").select("*").order("full_name", { ascending: true }),
        window.db.from("medical_exam_records").select("*")
      ]);

      if (workersError) throw workersError;
      if (examsError) throw examsError;

      console.log("[workers.supabase.js] workers:", workers?.length || 0);
      console.log("[workers.supabase.js] exams:", exams?.length || 0);

      allWorkers = (workers || []).map(w => ({
        ...w,
        _complianceSummary: getComplianceSummary(w.id)
      }));
      allExamRecords = exams || [];

      renderWorkers(allWorkers);
      updateTopSummary(allWorkers);

      // Renderizar analíticas si la función existe
      if (window.renderWorkerAnalytics) {
        window.renderWorkerAnalytics(allWorkers, allExamRecords);
        $("#analyticsSection").style.display = "block";
      }

      setupAnalyticsToggle();
    } catch (err) {
      console.error("Error cargando datos:", err);
      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Error al cargar trabajadores.
        </div>
      `;
    }
  }

  function setupAnalyticsToggle() {
    const btn = $("#toggleAnalytics");
    const section = $("#analyticsBody");
    if (!btn || !section) return;

    btn.onclick = () => {
      const isHidden = section.style.display === "none";
      section.style.display = isHidden ? "block" : "none";
      btn.textContent = isHidden ? "Ver menos" : "Ver más";
    };
  }

  function updateTopSummary(items) {
    const totals = items.reduce(
      (acc, w) => {
        const s = getComplianceSummary(w.id);
        acc.total += 1;

        if (s.faenaText === "No habilitado") acc.notEnabled += 1;
        else if (s.faenaText === "En riesgo") acc.atRisk += 1;
        else if (s.faenaText === "Habilitado") acc.enabled += 1;
        else acc.noInfo += 1;

        return acc;
      },
      { total: 0, enabled: 0, atRisk: 0, notEnabled: 0, noInfo: 0 }
    );

    // Actualizar Tarjetas Decision-Grid
    if ($('#kpi_w_total')) $('#kpi_w_total').textContent = totals.total;
    if ($('#kpi_w_blocked')) $('#kpi_w_blocked').textContent = totals.notEnabled;
    if ($('#kpi_w_risk')) $('#kpi_w_risk').textContent = totals.atRisk;
    
    // Quick Stats en el Hero
    const quickStats = $('#quickStats');
    if (quickStats) {
      quickStats.innerHTML = `
        <div class="badge badge--success">${totals.enabled} Habilitados</div>
        ${totals.atRisk > 0 ? `<div class="badge badge--warning">${totals.atRisk} En Riesgo</div>` : ''}
        ${totals.notEnabled > 0 ? `<div class="badge badge--danger">${totals.notEnabled} Bloqueados</div>` : ''}
      `;
    }
  }

  function renderWorkers(items) {
    const header = `
      <div class="t-head workers-pro-head">
        <div style="width:40px"><input type="checkbox" id="selectAll"></div>
        <div class="t-col-name">Trabajador</div>
        <div class="t-col-faena">Empresa / Faena</div>
        <div>Estado Operacional</div>
        <div>Próximos Vencimientos</div>
        <div>Acciones</div>
      </div>
    `;

    let html = header;

    if (!items || items.length === 0) {
      html += `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          No se encontraron trabajadores.
        </div>
      `;
      tableBody.innerHTML = html;
      attachHeaderEvents(items);
      updateTopSummary(items);
      return;
    }

    items.forEach((w) => {
      const id = String(w.id || "");
      const name = escapeHtml(w.full_name || "Desconocido");
      const rut = escapeHtml(w.rut || "N/A");
      const company = escapeHtml(w.company_name || "Sin asignar");
      const email = escapeHtml(w.email || "-");
      const status = normalizeStatus(w.status);
      const statusClass = status === "Activo" ? "badge--active" : "badge--inactive";
      const summary = getComplianceSummary(id);

      const initials = (w.full_name || "Desconocido")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase() || "")
        .join("");

      html += `
        <div class="t-row worker-row-pro" data-id="${id}">
          <div style="width:40px" data-label="Seleccionar">
            <input
              type="checkbox"
              class="worker-check"
              value="${id}"
              ${selectedWorkers.has(id) ? "checked" : ""}
            >
          </div>

          <div class="emp t-col-name" data-label="Trabajador">
            <div class="avatar" style="display:flex; align-items:center; justify-content:center; font-weight:700;">
              ${escapeHtml(initials)}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; min-width:0;">
              <a
                href="worker.html?id=${encodeURIComponent(id)}"
                class="emp__name"
                style="color:var(--text); text-decoration:none;"
              >
                ${name}
              </a>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <span class="badge ${statusClass}">${status}</span>
                <span style="font-size:12px; color:var(--muted)">ID ${escapeHtml(id.slice(0, 8))}</span>
              </div>
            </div>
          </div>

          <div class="faena-cell t-col-faena" data-label="Empresa / Faena">
            <span class="faena-text">${company}</span>
            <button class="btn btn--mini btn-assign" style="padding:2px 6px; font-size:10px; margin-left:8px; opacity:.8;">
              ${company === "Sin asignar" ? "Asignar" : "Editar"}
            </button>
          </div>

          <div data-label="Estado Operacional">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="${summary.dotClass}"></span>
              <span class="badge ${summary.faenaClass}" style="min-width:110px;">${summary.faenaText}</span>
            </div>
          </div>

          <div data-label="Próximos Vencimientos">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span class="badge ${summary.badgeClass}">${summary.badgeText}</span>
              <span style="font-size:11px; color:var(--muted)">
                ${summary.total} docs totales
              </span>
            </div>
          </div>

          <div data-label="Acciones">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <a href="worker.html?id=${encodeURIComponent(id)}" class="btn btn--mini">Ver ficha</a>
              <button class="btn btn--mini btn-generate-one" data-worker-id="${id}">
                Exámenes
              </button>
            </div>
          </div>
        </div>
      `;
    });

    tableBody.innerHTML = html;
    attachHeaderEvents(items);
    attachRowEvents();
    updateTopSummary(items);
  }

  function attachHeaderEvents(items) {
    const selectAll = $("#selectAll");
    if (!selectAll) return;

    const visibleIds = items.map((w) => String(w.id));
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedWorkers.has(id));

    selectAll.checked = allVisibleSelected;

    selectAll.onchange = (e) => {
      const checks = tableBody.querySelectorAll(".worker-check");
      checks.forEach((c) => {
        c.checked = e.target.checked;
        if (c.checked) selectedWorkers.add(String(c.value));
        else selectedWorkers.delete(String(c.value));
      });
    };
  }

  function attachRowEvents() {
    tableBody.querySelectorAll(".worker-check").forEach((c) => {
      c.onchange = (e) => {
        const value = String(e.target.value);
        if (e.target.checked) selectedWorkers.add(value);
        else selectedWorkers.delete(value);
      };
    });

    tableBody.querySelectorAll(".btn-assign").forEach((btn) => {
      btn.onclick = async (e) => {
        const row = e.target.closest(".t-row");
        const id = row?.dataset?.id;
        if (!id) return;

        const newFaena = prompt("Ingrese el nombre de la Faena o Empresa:");
        if (!newFaena || !newFaena.trim()) return;

        try {
          const { data, error } = await window.db
            .from("workers")
            .update({ company_name: newFaena.trim() })
            .eq("id", id)
            .select();

          if (error) throw error;
          
          if (!data || data.length === 0) {
             throw new Error("No se pudo guardar. Es posible que no tengas permisos para editar este trabajador (RLS) o el ID sea incorrecto.");
          }

          // Si guardó bien, recargar la pantalla
          await loadAllData();
        } catch (err) {
          console.error("Error actualizando faena:", err);
          alert("Error: " + err.message);
        }
      };
    });

    tableBody.querySelectorAll(".btn-generate-one").forEach((btn) => {
      btn.onclick = async (e) => {
        try {
          const workerId = e.currentTarget.dataset.workerId;
          selectedWorkers = new Set([String(workerId)]);
          await exportExamSheetFromTemplate();
        } catch (err) {
          console.error("Error generando planilla individual:", err);
          alert("No se pudo generar la planilla: " + err.message);
        }
      };
    });
  }

  async function fetchSelectedWorkersForExamSheet() {
    const ids = Array.from(selectedWorkers);

    if (!ids.length) {
      throw new Error("No hay trabajadores seleccionados.");
    }

    const { data: workers, error: workersError } = await window.db
      .from("workers")
      .select("*")
      .in("id", ids)
      .order("full_name", { ascending: true });

    if (workersError) throw workersError;

    const selectedRuts = (workers || [])
      .map((w) => w.rut)
      .filter(Boolean);

    if (!selectedRuts.length) {
      return { workers: workers || [], exams: [] };
    }

    const { data: exams, error: examsError } = await window.db
      .from("medical_exam_records")
      .select("*")
      .eq("credential_category", "examen")
      .order("exam_date", { ascending: false });

    if (examsError) throw examsError;

    const filteredExams = (exams || []).filter((exam) =>
      selectedRuts.some((rut) => sameRut(rut, exam.rut))
    );

    console.log("[export] workers:", workers);
    console.log("[export] selectedRuts:", selectedRuts);
    console.log("[export] filteredExams:", filteredExams);

    return {
      workers: workers || [],
      exams: filteredExams
    };
  }

  async function exportExamSheetFromTemplate() {
    if (!window.ExcelJS) {
      throw new Error("No está cargada la librería ExcelJS.");
    }

    const { workers, exams } = await fetchSelectedWorkersForExamSheet();

    const nombreProyecto = document.querySelector("#projectName")?.value?.trim() || "";

    if (!nombreProyecto) {
      alert("Completa el Nombre del Proyecto.");
      return;
    }

    const templateUrl = "/templates/planilla_examenes_preocupacionales.xlsx";
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`No se encontró ${templateUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet("Hoja1") || workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("No se encontró la hoja principal.");
    }

    const rows = buildExamRows(workers, exams);

    console.log("[export] rows:", rows);

    if (!rows.length) {
      alert("No se encontraron datos para generar la planilla.");
      return;
    }

    worksheet.getCell("G1").value = nombreProyecto;

    const startRow = 2;

    if (rows.length > 1) {
      worksheet.spliceRows(startRow + 1, 0, ...new Array(rows.length - 1).fill([]));
    }

    rows.forEach((r, index) => {
      const rowNumber = startRow + index;

      worksheet.getCell(`A${rowNumber}`).value = r.obs || "";
      worksheet.getCell(`B${rowNumber}`).value = r.faena || "";
      worksheet.getCell(`C${rowNumber}`).value = r.rut || "";
      worksheet.getCell(`D${rowNumber}`).value = r.colaborador || "";
      worksheet.getCell(`E${rowNumber}`).value = r.fecha || new Date();

      worksheet.getCell(`G${rowNumber}`).value = r.examen || "";

      worksheet.getCell(`F${rowNumber}`).value = r.peso;
      worksheet.getCell(`H${rowNumber}`).value = r.talla;
      worksheet.getCell(`I${rowNumber}`).value = r.cintura;
      worksheet.getCell(`J${rowNumber}`).value = r.imc;
      worksheet.getCell(`K${rowNumber}`).value = r.presion || "";
      worksheet.getCell(`L${rowNumber}`).value = r.frec_card;
      worksheet.getCell(`M${rowNumber}`).value = r.actividad_fisica || "";
      worksheet.getCell(`N${rowNumber}`).value = r.framingham || "";
      worksheet.getCell(`O${rowNumber}`).value = r.ecg || "";
      worksheet.getCell(`P${rowNumber}`).value = r.audiometria || "";
      worksheet.getCell(`Q${rowNumber}`).value = r.audiometria_conclusion || "";
      worksheet.getCell(`R${rowNumber}`).value = r.test_ruffier || "";
      worksheet.getCell(`S${rowNumber}`).value = r.rx_torax || "";
      worksheet.getCell(`T${rowNumber}`).value = r.rx_neumoconiosis_oit || "";
      worksheet.getCell(`U${rowNumber}`).value = r.epworth || "";
      worksheet.getCell(`V${rowNumber}`).value = r.lake_louise || "";
      worksheet.getCell(`W${rowNumber}`).value = r.glucosa;
      worksheet.getCell(`X${rowNumber}`).value = r.creatinina;
      worksheet.getCell(`Y${rowNumber}`).value = r.colesterol_total;
      worksheet.getCell(`Z${rowNumber}`).value = r.hdl;
      worksheet.getCell(`AA${rowNumber}`).value = r.ldl;
      worksheet.getCell(`AB${rowNumber}`).value = r.trigliceridos;
      worksheet.getCell(`AC${rowNumber}`).value = r.inr;
      worksheet.getCell(`AD${rowNumber}`).value = r.protrombina;
      worksheet.getCell(`AE${rowNumber}`).value = r.bilirrubina_total;
      worksheet.getCell(`AF${rowNumber}`).value = r.gpt;
      worksheet.getCell(`AG${rowNumber}`).value = r.hemoglobina;
      worksheet.getCell(`AH${rowNumber}`).value = r.hematocrito;
      worksheet.getCell(`AI${rowNumber}`).value = r.plaquetas;
      worksheet.getCell(`AJ${rowNumber}`).value = r.creatininuria;
      worksheet.getCell(`AK${rowNumber}`).value = r.anfetaminas || "";
      worksheet.getCell(`AL${rowNumber}`).value = r.benzodiazepinas || "";
      worksheet.getCell(`AM${rowNumber}`).value = r.canabinoides || "";
      worksheet.getCell(`AN${rowNumber}`).value = r.cocaina || "";
      worksheet.getCell(`AO${rowNumber}`).value = r.observacion_general || "";
      worksheet.getCell(`AP${rowNumber}`).value = r.fecha_informe_revisado || "";
      worksheet.getCell(`AQ${rowNumber}`).value = r.riesgo_evaluado || "";
      worksheet.getCell(`AR${rowNumber}`).value = r.observaciones || "";
      worksheet.getCell(`BE${rowNumber}`).value = r.proximo_control || "";
      worksheet.getCell(`BF${rowNumber}`).value = r.contraindicacion_achs || "";
      worksheet.getCell(`BG${rowNumber}`).value = r.fecha_registro_contraind || "";
      worksheet.getCell(`BH${rowNumber}`).value = r.riesgo_contraindicado || "";
      worksheet.getCell(`BI${rowNumber}`).value = r.tipo_contraindicacion || "";
      worksheet.getCell(`BJ${rowNumber}`).value = r.recomendacion_interna || "";

      worksheet.getCell(`E${rowNumber}`).numFmt = "dd-mm-yyyy";

      if (r.fecha_informe_revisado instanceof Date) {
        worksheet.getCell(`AP${rowNumber}`).numFmt = "dd-mm-yyyy";
      }
      if (r.proximo_control instanceof Date) {
        worksheet.getCell(`BE${rowNumber}`).numFmt = "dd-mm-yyyy";
      }
      if (r.fecha_registro_contraind instanceof Date) {
        worksheet.getCell(`BG${rowNumber}`).numFmt = "dd-mm-yyyy";
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
      [buffer],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );

    const safeProject = nombreProyecto.replace(/[^\w\-]+/g, "_");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PLANILLA_Examenes_${safeProject}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function setupFilters() {
    const searchInput = $("#workerSearch");
    const statusFilter = $("#filterStatus");
    const resetBtn = $("#btnResetFilters");

    if (!searchInput || !statusFilter || !resetBtn) {
      console.warn("Faltan filtros en el DOM");
      return;
    }

    const applyFilters = () => {
      const query = searchInput.value.trim().toLowerCase();
      const status = statusFilter.value.trim().toLowerCase();

      const filtered = allWorkers.filter((w) => {
        const fullName = String(w.full_name || "").toLowerCase();
        const rut = String(w.rut || "").toLowerCase();
        const company = String(w.company_name || "").toLowerCase();
        const opStatus = String(w._complianceSummary?.faenaText || "").toLowerCase();

        const matchSearch =
          !query ||
          fullName.includes(query) ||
          rut.includes(query) ||
          company.includes(query);

        const matchStatus = !status || opStatus === status;

        return matchSearch && matchStatus;
      });

      renderWorkers(filtered);
      updateTopSummary(filtered);
      if (window.renderWorkerAnalytics) {
        window.renderWorkerAnalytics(filtered, allExamRecords);
      }
    };

    searchInput.oninput = applyFilters;
    statusFilter.onchange = applyFilters;

    // Copiloto IA Integrado
    const aiInput = $("#aiWorkerSearch");
    const aiBtn = $("#btnAiWorker");
    if (aiInput && aiBtn) {
      const execAi = () => {
        const val = aiInput.value.trim();
        if (!val) return;
        if (window.btnChat) window.btnChat.click();
        const chatIn = document.getElementById("chatInput");
        if (chatIn) {
          chatIn.value = val;
          document.getElementById("chatSend")?.click();
        }
        aiInput.value = "";
      };
      aiBtn.onclick = execAi;
      aiInput.onkeydown = (e) => { if (e.key === "Enter") execAi(); };
    }
  }

  const btnGen = $("#btnGenerateTec02");
  if (btnGen) {
    btnGen.onclick = async () => {
      try {
        if (selectedWorkers.size === 0) {
          alert("Selecciona al menos un trabajador.");
          return;
        }

        await exportExamSheetFromTemplate();
      } catch (err) {
        console.error(err);
        alert("No se pudo generar la planilla: " + err.message);
      }
    };
  }

  window.onChartDrillDown = function (type, value) {
    let filtered = [];
    if (type === "compliance") {
      filtered = allWorkers.filter(w => {
        const s = w._complianceSummary;
        if (!s) return value === "Sin información";
        return s.faenaText === value;
      });
    } else if (type === "imc") {
      filtered = allWorkers.filter(w => {
        const exams = allExamRecords.filter(e => sameRut(e.rut, w.rut));
        const last = exams.sort((a,b) => new Date(b.exam_date) - new Date(a.exam_date))[0];
        if (!last) return false;
        const imcNum = num(last.imc);
        if (value === "Bajo") return imcNum < 18.5;
        if (value === "Normal") return imcNum >= 18.5 && imcNum < 25;
        if (value === "Sobrepeso") return imcNum >= 25 && imcNum < 30;
        if (value === "Obeso I") return imcNum >= 30 && imcNum < 35;
        if (value === "Obeso II+") return imcNum >= 35;
        return false;
      });
    } else if (type === "worker_name") {
      filtered = allWorkers.filter(w => 
        String(w.full_name || "").toLowerCase().includes(String(value || "").toLowerCase())
      );
    }

    if (filtered.length > 0) {
      document.querySelector("#workerSearch").value = "";
      document.querySelector("#filterStatus").value = "";
      renderWorkers(filtered);
      updateTopSummary(filtered);
      document.getElementById("workersTable").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  init();
})();