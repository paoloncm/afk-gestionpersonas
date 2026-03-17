(async function () {
  const $ = (s) => document.querySelector(s);
  const tableBody = $("#workersTable");

  let allWorkers = [];
  let allCredentials = [];
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

  function isInfpsico(credential) {
    const name = String(credential?.credential_name || "").toUpperCase();
    return name.includes("INFPSICO");
  }

  function getWorkerDocs(workerId) {
    return allCredentials.filter((c) => String(c.worker_id) === String(workerId));
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

  function safeNum(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function getStructuredExamData(credential) {
    if (!credential) return {};

    if (credential.structured_data && typeof credential.structured_data === "object") {
      return credential.structured_data;
    }

    if (credential.exam_data && typeof credential.exam_data === "object") {
      return credential.exam_data;
    }

    if (credential.metadata && typeof credential.metadata === "object") {
      return credential.metadata;
    }

    return {};
  }

  function mergeWorkerExamData(worker, credentials) {
    const workerCreds = credentials.filter(c => String(c.worker_id) === String(worker.id));

    const merged = {
      obs: "",
      faena: worker.company_name || "",
      rut: worker.rut || "",
      colaborador: worker.full_name || "",
      fecha: new Date(),

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
    };

    workerCreds.forEach(c => {
      const d = getStructuredExamData(c);

      merged.peso ??= safeNum(d.peso);
      merged.talla ??= safeNum(d.talla);
      merged.cintura ??= safeNum(d.cintura);
      merged.imc ??= safeNum(d.imc);
      merged.presion ||= d.presion || "";
      merged.frec_card ??= safeNum(d.frec_card);
      merged.actividad_fisica ||= d.actividad_fisica || "";
      merged.framingham ||= d.framingham || "";
      merged.ecg ||= d.ecg || "";
      merged.audiometria ||= d.audiometria || "";
      merged.audiometria_conclusion ||= d.audiometria_conclusion || "";
      merged.test_ruffier ||= d.test_ruffier || "";
      merged.rx_torax ||= d.rx_torax || "";
      merged.rx_neumoconiosis_oit ||= d.rx_neumoconiosis_oit || "";
      merged.epworth ||= d.epworth || "";
      merged.lake_louise ||= d.lake_louise || "";
      merged.glucosa ??= safeNum(d.glucosa);
      merged.creatinina ??= safeNum(d.creatinina);
      merged.colesterol_total ??= safeNum(d.colesterol_total);
      merged.hdl ??= safeNum(d.hdl);
      merged.ldl ??= safeNum(d.ldl);
      merged.trigliceridos ??= safeNum(d.trigliceridos);
      merged.inr ??= safeNum(d.inr);
      merged.protrombina ??= safeNum(d.protrombina);
      merged.bilirrubina_total ??= safeNum(d.bilirrubina_total);
      merged.gpt ??= safeNum(d.gpt);
      merged.hemoglobina ??= safeNum(d.hemoglobina);
      merged.hematocrito ??= safeNum(d.hematocrito);
      merged.plaquetas ??= safeNum(d.plaquetas);
      merged.creatininuria ??= safeNum(d.creatininuria);
      merged.anfetaminas ||= d.anfetaminas || "";
      merged.benzodiazepinas ||= d.benzodiazepinas || "";
      merged.canabinoides ||= d.canabinoides || "";
      merged.cocaina ||= d.cocaina || "";
      merged.observacion_general ||= d.observacion_general || c.observation || "";
      merged.fecha_informe_revisado ||= d.fecha_informe_revisado || "";
      merged.riesgo_evaluado ||= d.riesgo_evaluado || "";
      merged.observaciones ||= d.observaciones || "";
      merged.proximo_control ||= d.proximo_control || "";
      merged.contraindicacion_achs ||= d.contraindicacion_achs || "";
      merged.fecha_registro_contraind ||= d.fecha_registro_contraind || "";
      merged.riesgo_contraindicado ||= d.riesgo_contraindicado || "";
      merged.tipo_contraindicacion ||= d.tipo_contraindicacion || "";
      merged.recomendacion_interna ||= d.recomendacion_interna || "";
    });

    return merged;
  }

  async function init() {
    if (!tableBody) {
      console.error("No se encontró #workersTable");
      return;
    }

    if (!window.supabase) {
      setTimeout(init, 400);
      return;
    }

    setupFilters();
    await loadAllData();
  }

  init();

  async function loadAllData() {
    try {
      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Cargando trabajadores y documentación...
        </div>
      `;

      const [
        { data: workers, error: workersError },
        { data: credentials, error: credentialsError }
      ] = await Promise.all([
        supabase.from("workers").select("*").order("full_name", { ascending: true }),
        supabase.from("worker_credentials").select("*")
      ]);

      if (workersError) throw workersError;
      if (credentialsError) throw credentialsError;

      allWorkers = workers || [];
      allCredentials = credentials || [];

      renderWorkers(allWorkers);
      updateTopSummary(allWorkers);
    } catch (err) {
      console.error("Error cargando datos:", err);
      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Error al cargar trabajadores.
        </div>
      `;
    }
  }

  function updateTopSummary(items) {
    const targetId = "workersSummaryBar";
    let summary = document.getElementById(targetId);

    if (!summary) {
      summary = document.createElement("div");
      summary.id = targetId;
      summary.className = "card";
      summary.style.marginBottom = "16px";
      summary.innerHTML = `<div class="card__body"></div>`;

      const main = document.querySelector(".main");
      const toolbar = document.querySelector(".toolbar");
      if (main && toolbar) {
        main.insertBefore(summary, toolbar.nextSibling);
      }
    }

    const body = summary.querySelector(".card__body");

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

    body.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div class="mini-kpi">
          <div class="mini-kpi__label">Trabajadores visibles</div>
          <div class="mini-kpi__value">${totals.total}</div>
        </div>
        <div class="mini-kpi">
          <div class="mini-kpi__label">Habilitados</div>
          <div class="mini-kpi__value">${totals.enabled}</div>
        </div>
        <div class="mini-kpi">
          <div class="mini-kpi__label">En riesgo</div>
          <div class="mini-kpi__value">${totals.atRisk}</div>
        </div>
        <div class="mini-kpi">
          <div class="mini-kpi__label">No habilitados</div>
          <div class="mini-kpi__value">${totals.notEnabled}</div>
        </div>
        <div class="mini-kpi">
          <div class="mini-kpi__label">Sin información</div>
          <div class="mini-kpi__value">${totals.noInfo}</div>
        </div>
      </div>
    `;
  }

  function renderWorkers(items) {
    const header = `
      <div class="t-head workers-pro-head">
        <div style="width:40px"><input type="checkbox" id="selectAll"></div>
        <div class="t-col-name">Trabajador</div>
        <div class="t-col-rut">RUT</div>
        <div class="t-col-faena">Empresa / Faena</div>
        <div class="t-col-email">Email</div>
        <div>Semáforo</div>
        <div>Estado Faena</div>
        <div>Documentos</div>
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

      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        w.full_name || "Desconocido"
      )}&background=random&color=fff`;

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
            <img class="avatar" src="${avatar}" alt="${name}">
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

          <div class="t-col-rut" data-label="RUT">${rut}</div>

          <div class="faena-cell t-col-faena" data-label="Empresa / Faena">
            <span class="faena-text">${company}</span>
            <button class="btn btn--mini btn-assign" style="padding:2px 6px; font-size:10px; margin-left:8px; opacity:.8;">
              ${company === "Sin asignar" ? "Asignar" : "Editar"}
            </button>
          </div>

          <div class="t-col-email" data-label="Email">${email}</div>

          <div data-label="Semáforo">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="${summary.dotClass}"></span>
              <span class="badge ${summary.badgeClass}">${summary.badgeText}</span>
            </div>
          </div>

          <div data-label="Estado Faena">
            <span class="badge ${summary.faenaClass}">${summary.faenaText}</span>
          </div>

          <div data-label="Documentos">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span><strong>${summary.total}</strong> total</span>
              <span style="font-size:12px; color:var(--muted)">
                ${summary.expired} vencidos · ${summary.upcoming} por vencer
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
          const { error } = await supabase
            .from("workers")
            .update({ company_name: newFaena.trim() })
            .eq("id", id);

          if (error) throw error;
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
          // Exportar solo este trabajador sin tocar el Set global
          const worker = allWorkers.find(w => String(w.id) === String(workerId));
          if (!worker) throw new Error("Trabajador no encontrado");
          const credentials = allCredentials.filter(c => String(c.worker_id) === String(workerId));
          await exportExamSheetDirect([worker], credentials);
        } catch (err) {
          console.error("Error generando planilla individual:", err);
          alert("No se pudo generar la planilla: " + err.message);
        }
      };
    });
  }

  function syncSelectedFromDOM() {
    // Sincronizar selectedWorkers desde los checkboxes reales del DOM
    const checks = tableBody.querySelectorAll(".worker-check");
    checks.forEach((c) => {
      if (c.checked) selectedWorkers.add(String(c.value));
      else selectedWorkers.delete(String(c.value));
    });
  }

  function getSelectedWorkersData() {
    syncSelectedFromDOM();
    const ids = Array.from(selectedWorkers);

    if (!ids.length) {
      throw new Error("No hay trabajadores seleccionados.");
    }

    // Usar datos ya cargados en memoria (sin segundo request a Supabase)
    const workers = allWorkers
      .filter(w => ids.includes(String(w.id)))
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

    const credentials = allCredentials.filter(c => ids.includes(String(c.worker_id)));

    return { workers, credentials };
  }

  function getTemplateDataRows(worksheet) {
    // Collect rows that have cells in the main data columns (A=1 to BJ=62).
    // The template has spacer rows (e.g. rows 2, 4) that only contain
    // formula/summary cells in far-right columns (BL+). We skip those.
    const dataRows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 1) return; // skip header
      let hasMainColumn = false;
      row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
        if (colNumber <= 62) hasMainColumn = true; // A(1)..BJ(62)
      });
      if (hasMainColumn) dataRows.push(rowNumber);
    });
    return dataRows;
  }

  function writeWorkersToSheet(worksheet, workers, credentials) {
    const dataRows = getTemplateDataRows(worksheet);
    console.log(`[Planilla] Filas de template disponibles: ${dataRows.length}, Trabajadores: ${workers.length}`);

    workers.forEach((w, index) => {
      const rowNumber = dataRows[index];
      if (!rowNumber) {
        console.warn(`[Planilla] Sin fila de template para trabajador #${index + 1}: ${w.full_name}`);
        return;
      }
      const r = mergeWorkerExamData(w, credentials);

      worksheet.getCell(`A${rowNumber}`).value = r.obs || "";
      worksheet.getCell(`B${rowNumber}`).value = r.faena || "";
      worksheet.getCell(`C${rowNumber}`).value = r.rut || "";
      worksheet.getCell(`D${rowNumber}`).value = r.colaborador || "";
      worksheet.getCell(`E${rowNumber}`).value = r.fecha || new Date();

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
    });
  }

      worksheet.getCell(`A${rowNumber}`).value = r.obs || "";
      worksheet.getCell(`B${rowNumber}`).value = r.faena || "";
      worksheet.getCell(`C${rowNumber}`).value = r.rut || "";
      worksheet.getCell(`D${rowNumber}`).value = r.colaborador || "";
      worksheet.getCell(`E${rowNumber}`).value = r.fecha || new Date();

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
    });
  }

  async function loadTemplate() {
    if (!window.ExcelJS) {
      throw new Error("No está cargada la librería ExcelJS.");
    }
    const templateUrl = "/templates/planilla_examenes_preocupacionales.xlsx";
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`No se encontró ${templateUrl}`);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet("Hoja1") || workbook.getWorksheet(1);
    if (!worksheet) throw new Error("No se encontró la hoja principal.");
    return { workbook, worksheet };
  }

  async function downloadWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
      [buffer],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function exportExamSheetFromTemplate() {
    const { workers, credentials } = getSelectedWorkersData();
    console.log(`[Planilla] Exportando ${workers.length} trabajadores:`, workers.map(w => w.full_name));
    const { workbook, worksheet } = await loadTemplate();
    writeWorkersToSheet(worksheet, workers, credentials);
    await downloadWorkbook(workbook, "PLANILLA_Examenes_Preocupacionales.xlsx");
  }

  async function exportExamSheetDirect(workers, credentials) {
    console.log(`[Planilla] Exportando individual: ${workers.map(w => w.full_name)}`);
    const { workbook, worksheet } = await loadTemplate();
    writeWorkersToSheet(worksheet, workers, credentials);
    await downloadWorkbook(workbook, "PLANILLA_Examenes_Preocupacionales.xlsx");
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
        const workerStatus = String(normalizeStatus(w.status)).toLowerCase();

        const matchSearch =
          !query ||
          fullName.includes(query) ||
          rut.includes(query) ||
          company.includes(query);

        const matchStatus = !status || workerStatus === status;

        return matchSearch && matchStatus;
      });

      renderWorkers(filtered);
    };

    searchInput.oninput = applyFilters;
    statusFilter.onchange = applyFilters;

    resetBtn.onclick = () => {
      searchInput.value = "";
      statusFilter.value = "";
      renderWorkers(allWorkers);
    };
  }

  const btnGen = $("#btnGenerateTec02");
  if (btnGen) {
    btnGen.textContent = "Generar planilla exámenes";
    btnGen.onclick = async () => {
      try {
        await exportExamSheetFromTemplate();
      } catch (err) {
        console.error(err);
        alert("No se pudo generar la planilla: " + err.message);
      }
    };
  }
})();