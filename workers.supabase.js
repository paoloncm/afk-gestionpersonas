// workers.supabase.js
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

  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("es-CL");
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

      if (diffDays <= 0) {
        expired += 1;
      } else if (diffDays <= 30) {
        upcoming += 1;
      } else {
        healthy += 1;
      }
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
        supabase
          .from("worker_credentials")
          .select("id, worker_id, credential_name, expiry_date, result_status")
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
        acc.docs += s.total;

        if (s.faenaText === "No habilitado") acc.notEnabled += 1;
        else if (s.faenaText === "En riesgo") acc.atRisk += 1;
        else if (s.faenaText === "Habilitado") acc.enabled += 1;
        else acc.noInfo += 1;

        return acc;
      },
      {
        total: 0,
        docs: 0,
        enabled: 0,
        atRisk: 0,
        notEnabled: 0,
        noInfo: 0
      }
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
        <div data-label="Semáforo">Semáforo</div>
        <div data-label="Estado Faena">Estado Faena</div>
        <div data-label="Documentos">Documentos</div>
        <div data-label="Acciones">Acciones</div>
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
            <button
              class="btn btn--mini btn-assign"
              style="padding:2px 6px; font-size:10px; margin-left:8px; opacity:.8;"
            >
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
              <button class="btn btn--mini btn-generate-one" data-worker-id="${id}" data-worker-name="${name}">
                TEC-02
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

        const selectAll = $("#selectAll");
        if (selectAll && !e.target.checked) selectAll.checked = false;
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
          const workerName = e.currentTarget.dataset.workerName || "Trabajador";
          const project = $("#projectName")?.value?.trim() || "Proyecto Sin Nombre";

          const { data, error } = await supabase
            .from("workers")
            .select("*")
            .eq("id", workerId)
            .single();

          if (error) throw error;

          const rows = buildTec02Rows([data]);
          exportTec02Excel(rows, project || workerName);
        } catch (err) {
          console.error("Error generando TEC-02 individual:", err);
          alert("No se pudo generar el TEC-02 individual: " + err.message);
        }
      };
    });
  }

  async function fetchSelectedWorkersFullData() {
    const ids = Array.from(selectedWorkers);

    if (!ids.length) {
      throw new Error("No hay trabajadores seleccionados.");
    }

    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .in("id", ids)
      .order("full_name", { ascending: true });

    if (error) throw error;

    return data || [];
  }

  function buildTec02Rows(workers) {
    return workers.map((w, index) => ({
      nro: index + 1,
      nombre_completo: w.full_name || "",
      rut: w.rut || "",
      cargo: w.position || w.role_name || w.job_title || w.cargo || "",
      titulo_profesional: w.profession || w.professional_title || w.titulo_profesional || "",
      experiencia_a: w.exp_a ?? w.years_experience ?? "",
      experiencia_b: w.exp_b ?? "",
      experiencia_c: w.exp_c ?? "",
      experiencia_d: w.exp_d ?? "",
      empresa_faena: w.company_name || "",
      email: w.email || "",
      telefono: w.phone || "",
      estado: normalizeStatus(w.status || "")
    }));
  }

  function exportTec02Excel(rows, projectName) {
    if (!window.XLSX) {
      alert("Falta cargar la librería XLSX.");
      return;
    }

    const wb = XLSX.utils.book_new();

    const wsData = [
      ["CORPORACIÓN NACIONAL DEL COBRE DE CHILE"],
      ["FORMULARIO TEC-02"],
      ["NÓMINA Y ANTECEDENTES DEL PERSONAL CLAVE"],
      [],
      ["Proyecto", projectName || "Proyecto Sin Nombre"],
      ["Fecha", new Date().toLocaleDateString("es-CL")],
      [],
      [
        "N°",
        "Nombre Completo",
        "RUT",
        "Cargo a Desempeñar",
        "Título Profesional",
        "Años Exp. A",
        "Años Exp. B",
        "Años Exp. C",
        "Años Exp. D",
        "Empresa / Faena",
        "Email",
        "Teléfono",
        "Estado"
      ]
    ];

    rows.forEach((r) => {
      wsData.push([
        r.nro,
        r.nombre_completo,
        r.rut,
        r.cargo,
        r.titulo_profesional,
        r.experiencia_a,
        r.experiencia_b,
        r.experiencia_c,
        r.experiencia_d,
        r.empresa_faena,
        r.email,
        r.telefono,
        r.estado
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 16 },
      { wch: 28 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 24 },
      { wch: 26 },
      { wch: 16 },
      { wch: 14 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "TEC-02");

    const safeProject = (projectName || "Proyecto").replace(/[^\w\-]+/g, "_");
    XLSX.writeFile(wb, `TEC-02_${safeProject}.xlsx`);
  }

  function exportTec02Pdf(rows, projectName) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("Falta cargar jsPDF.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CORPORACIÓN NACIONAL DEL COBRE DE CHILE", 148, 15, { align: "center" });

    doc.setFontSize(14);
    doc.text("FORMULARIO TEC-02", 148, 24, { align: "center" });

    doc.setFontSize(11);
    doc.text("NÓMINA Y ANTECEDENTES DEL PERSONAL CLAVE", 148, 31, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Proyecto: ${projectName || "Proyecto Sin Nombre"}`, 14, 40);
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 240, 40);

    const body = rows.map((r) => [
      r.nro,
      r.nombre_completo,
      r.cargo,
      r.titulo_profesional,
      r.experiencia_a,
      r.experiencia_b,
      r.experiencia_c,
      r.experiencia_d
    ]);

    doc.autoTable({
      startY: 46,
      head: [[
        "N°",
        "Nombre Completo",
        "Cargo",
        "Título Profesional",
        "A",
        "B",
        "C",
        "D"
      ]],
      body,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [180, 214, 197],
        textColor: 20,
        lineColor: 80,
        lineWidth: 0.2
      },
      bodyStyles: {
        lineColor: 120,
        lineWidth: 0.15
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 55 },
        2: { cellWidth: 55 },
        3: { cellWidth: 55 },
        4: { cellWidth: 12 },
        5: { cellWidth: 12 },
        6: { cellWidth: 12 },
        7: { cellWidth: 12 }
      },
      margin: { left: 10, right: 10 }
    });

    const safeProject = (projectName || "Proyecto").replace(/[^\w\-]+/g, "_");
    doc.save(`TEC-02_${safeProject}.pdf`);
  }

  async function generateTec02(format = "xlsx") {
    try {
      const project = $("#projectName")?.value?.trim() || "Proyecto Sin Nombre";

      if (selectedWorkers.size === 0) {
        alert("Por favor, selecciona al menos un trabajador.");
        return;
      }

      const workers = await fetchSelectedWorkersFullData();
      const rows = buildTec02Rows(workers);

      if (!rows.length) {
        alert("No se encontraron datos para los trabajadores seleccionados.");
        return;
      }

      if (format === "pdf") {
        exportTec02Pdf(rows, project);
      } else {
        exportTec02Excel(rows, project);
      }
    } catch (err) {
      console.error("Error generando TEC-02:", err);
      alert("No se pudo generar el TEC-02: " + err.message);
    }
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
    btnGen.onclick = () => generateTec02("xlsx");
  }

  const btnGenPdf = $("#btnGenerateTec02Pdf");
  if (btnGenPdf) {
    btnGenPdf.onclick = () => generateTec02("pdf");
  }
})();