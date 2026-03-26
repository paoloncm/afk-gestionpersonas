(async function () {
  const $ = (s) => document.querySelector(s);

  const table = $("#candidatesTable");
  const searchInput = $("#candSearch");
  const filterEstado = $("#filterEstado");
  const filterCargo = $("#filterCargo");
  const btnResetFilters = $("#btnResetFilters");
  const btnCompare = $("#btnCompare");
  const compareCount = $("#compareCount");
  const btnNewCandidate = $("#btnNewCandidate");
  const btnGenerateTec02 = $("#btnGenerateTec02FromCandidates");
  const btnGenerateTec02A = $("#btnGenerateTec02AFromCandidates");
  const selectAllCandidates = $("#selectAllCandidates");

  const kpiTotal = $("#kpi_total");
  const kpiPromNota = $("#kpi_prom_nota");
  const kpiPromExp = $("#kpi_prom_exp");
  const kpiPctN6 = $("#kpi_pct_n6");
  const topCandidatesEl = $("#topCandidates");

  const modal = $("#candidateModal");
  const closeModalBtn = $(".close-modal");
  const candidateForm = $("#candidateForm");

  let allCandidates = [];
  let filteredCandidates = [];
  let selectedCandidates = new Set();

  function num(x) {
    if (x == null || x === "") return NaN;
    return Number(String(x).replace(",", "."));
  }

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function init() {
    if (!window.supabase) {
      setTimeout(init, 300);
      return;
    }

    bindEvents();
    await loadCandidates();
  }

  function bindEvents() {
    if (searchInput) searchInput.oninput = applyFilters;
    if (filterEstado) filterEstado.onchange = applyFilters;
    if (filterCargo) filterCargo.onchange = applyFilters;

    if (btnResetFilters) {
      btnResetFilters.onclick = () => {
        if (searchInput) searchInput.value = "";
        if (filterEstado) filterEstado.value = "";
        if (filterCargo) filterCargo.value = "";
        applyFilters();
      };
    }

    if (btnNewCandidate) {
      btnNewCandidate.onclick = () => {
        if (modal) modal.classList.add("is-open");
      };
    }

    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        if (modal) modal.classList.remove("is-open");
      };
    }

    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove("is-open");
      };
    }

    if (candidateForm) {
      candidateForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const formData = new FormData(candidateForm);

          const payload = {
            nombre_completo: formData.get("nombre_completo") || "",
            rut: formData.get("rut") || "",
            profesion: formData.get("profesion") || "",
            nota: num(formData.get("nota")) || 0,
            correo: formData.get("correo") || "",
            telefono: formData.get("telefono") || "",
            cargo_a_desempenar: formData.get("cargo_a_desempenar") || "",
            experiencia_total: num(formData.get("experiencia_total")) || 0,
            experiencia_en_empresa_actual: num(formData.get("experiencia_en_empresa_actual")) || 0,
            exp_cargo_actual: num(formData.get("exp_cargo_actual")) || 0,
            exp_proy_similares: num(formData.get("exp_proy_similares")) || 0,
            antecedentes_academicos: formData.get("antecedentes_academicos") || "",
            status: "Postulado"
          };

          const { error } = await supabase.from("candidates").insert([payload]);
          if (error) throw error;

          candidateForm.reset();
          modal.classList.remove("is-open");
          await loadCandidates();
        } catch (err) {
          console.error('Error guardando candidato:', err);
          window.notificar?.('No se pudo guardar el candidato: ' + err.message, 'error');
        }
      };
    }

    if (btnGenerateTec02) {
      btnGenerateTec02.onclick = generateTec02FromSelectedCandidates;
    }

    if (btnGenerateTec02A) {
      btnGenerateTec02A.onclick = generateTec02AFromSelectedCandidates;
    }

    if (btnCompare) {
      btnCompare.onclick = () => {
        const ids = Array.from(selectedCandidates);
        if (ids.length < 2) return;
        const base = window.location.protocol === 'file:' ? 'comparison.html' : 'comparison';
        window.location.href = `${base}?ids=${encodeURIComponent(ids.join(','))}`;
      };
    }

    // Use event delegation for the table to handle dynamic Select All and row checkboxes
    if (table) {
      table.onchange = (e) => {
        if (e.target.id === "selectAllCandidates") {
          const checked = e.target.checked;
          const rows = filteredCandidates;
          rows.forEach(c => {
            if (checked) selectedCandidates.add(String(c.id));
            else selectedCandidates.delete(String(c.id));
          });
          renderCandidates(filteredCandidates);
        } else if (e.target.classList.contains("candidate-checkbox")) {
          const id = e.target.dataset.id;
          if (e.target.checked) selectedCandidates.add(id);
          else selectedCandidates.delete(id);
          renderCandidates(filteredCandidates);
        }
      };
    }
  }

  async function loadCandidates() {
    try {
      // Shimmer Loading State
      if (table) {
        table.innerHTML = `
          <div class="t-head">
            <div class="t-col-cb"><input type="checkbox" disabled></div>
            <div class="t-col-name">Nombre</div>
            <div class="t-col-prof">Profesión</div>
            <div class="t-col-vac">Cargo a desempeñar</div>
            <div class="t-col-score">Puntaje</div>
            <div class="t-col-loc">Ubicación</div>
            <div class="t-col-exp">Años exp.</div>
            <div class="t-col-status">Estado</div>
          </div>
          ` + Array(5).fill(0).map(() => `
          <div class="t-row">
            <div class="t-col-cb"></div>
            <div class="t-col-name"><div class="skeleton skeleton-text" style="width:80%"></div></div>
            <div class="t-col-prof"><div class="skeleton skeleton-text" style="width:60%"></div></div>
            <div class="t-col-vac"><div class="skeleton skeleton-text" style="width:70%"></div></div>
            <div class="t-col-score"><div class="skeleton skeleton-badge"></div></div>
            <div class="t-col-loc"><div class="skeleton skeleton-text" style="width:60%"></div></div>
            <div class="t-col-exp"><div class="skeleton skeleton-badge"></div></div>
            <div class="t-col-status"><div class="skeleton skeleton-badge"></div></div>
          </div>
          `).join('');
      }

      let { data, error } = await supabase
        .from("v_candidate_summary")
        .select("*")
        .order("nombre_completo", { ascending: true });

      if (error || !data) {
          console.warn("[candidates] v_candidate_summary falló, intentando tabla candidates...");
          const fallback = await supabase.from("candidates").select("*").order("nombre_completo", { ascending: true });
          data = fallback.data;
          error = fallback.error;
      }

      if (error) throw error;

      // Deduplicate by Name or RUT (keep newest)
      const candidateMap = new Map();
      (data || []).forEach(c => {
          const rawRut = String(c.rut || "").toUpperCase();
          const cleanRut = (rawRut === "NULL" || rawRut === "" || rawRut === "UNDEFINED") ? null : rawRut;
          const nameKey = String(c.nombre_completo || "").toLowerCase().trim();
          const key = cleanRut || nameKey;
          
          if (key && (!candidateMap.has(key) || (c.created_at && new Date(c.created_at) > new Date(candidateMap.get(key).created_at)))) {
              candidateMap.set(key, c);
          }
      });
      allCandidates = Array.from(candidateMap.values());
      populateFilters();
      applyFilters();
    } catch (err) {
      console.error("Error cargando candidatos:", err);
      if (table) {
        table.innerHTML += `
          <div style="padding:20px; color:var(--muted);">
            Error cargando candidatos.
          </div>
        `;
      }
    }
  }

  function populateFilters() {
    if (filterEstado) {
      const estados = [...new Set(allCandidates.map(c => c.status).filter(Boolean))].sort();
      filterEstado.innerHTML = `<option value="">Todos los estados</option>`;
      estados.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        filterEstado.appendChild(opt);
      });
    }

    if (filterCargo) {
      const cargos = [...new Set(allCandidates.map(c => c.cargo_a_desempenar).filter(Boolean))].sort();
      filterCargo.innerHTML = `<option value="">Todos los cargos</option>`;
      cargos.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        filterCargo.appendChild(opt);
      });
    }
  }

  function applyFilters() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const estado = (filterEstado?.value || "").trim();
    const cargo = (filterCargo?.value || "").trim();

    filteredCandidates = allCandidates.filter(c => {
      const name = String(c.nombre_completo || "").toLowerCase();
      const prof = String(c.profesion || "").toLowerCase();
      const correo = String(c.correo || "").toLowerCase();
      const cCargo = String(c.cargo_a_desempenar || "");
      const cEstado = String(c.status || "");

      const matchQuery =
        !q ||
        name.includes(q) ||
        prof.includes(q) ||
        correo.includes(q);

      const matchEstado = !estado || cEstado === estado;
      const matchCargo = !cargo || cCargo === cargo;

      return matchQuery && matchEstado && matchCargo;
    });

    renderCandidates(filteredCandidates);
    updateKPIs(filteredCandidates);
    updateTopList(filteredCandidates);

    if (window.renderAfkCharts) {
      window.renderAfkCharts(filteredCandidates);
    }
  }

  function renderCandidates(items) {
    if (!table) return;

    const allSelected = items.length > 0 && items.every(c => selectedCandidates.has(String(c.id)));

    // Render header ONLY IF it's empty or needs refresh
    const headHtml = `
      <div class="t-head">
        <div class="t-col-cb" style="display:flex; align-items:center; gap:4px;">
          <input type="checkbox" id="selectAllCandidates" ${allSelected ? "checked" : ""} title="Seleccionar todos">
          <span style="font-size:9px; color:var(--muted); font-weight:800; cursor:pointer;" onclick="document.getElementById('selectAllCandidates').click()">TODOS</span>
        </div>
        <div class="t-col-name">Nombre</div>
        <div class="t-col-prof">Profesión</div>
        <div class="t-col-vac">Cargo a desempeñar</div>
        <div class="t-col-score">Puntaje</div>
        <div class="t-col-loc">Ubicación / Dirección</div>
        <div class="t-col-exp">Años exp.</div>
        <div class="t-col-status">Estado</div>
      </div>
    `;

    let html = headHtml;

    if (!items.length) {
      html += `<div style="padding:20px; color:var(--muted);">No se encontraron candidatos.</div>`;
      table.innerHTML = html;
      return;
    }

    items.forEach(c => {
      const id = c.id;
      const name = escapeHtml(c.nombre_completo || "Sin nombre");
      const profesion = escapeHtml(c.profesion || "-");
      const cargo = escapeHtml(c.cargo_a_desempenar || "Sin asignar");
      const nota = Number.isFinite(num(c.score)) ? num(c.score).toFixed(1) : "-";
      const ubicacion = escapeHtml(c.comuna || "-");
      const direccion = escapeHtml(c.direccion || "-");
      const exp = Number.isFinite(num(c.experiencia_total)) ? num(c.experiencia_total).toFixed(1) : "-";
      const status = escapeHtml(c.status || "Postulado");

      html += `
        <div class="t-row" data-id="${escapeHtml(id)}">
          <div class="t-col-cb" data-label="Seleccionar">
            <input type="checkbox" class="candidate-check" value="${escapeHtml(id)}" ${selectedCandidates.has(String(id)) ? "checked" : ""}>
          </div>

          <div class="t-col-name" data-label="Nombre">
            <a href="candidate.html?id=${encodeURIComponent(id)}" style="color:var(--text); text-decoration:none; font-weight:700;">
              ${name}
            </a>
          </div>

          <div class="t-col-prof" data-label="Profesión">${profesion}</div>
          <div class="t-col-vac" data-label="Cargo">${cargo}</div>
          <div class="t-col-score" data-label="Puntaje">${nota}</div>
          <div class="t-col-loc" data-label="Ubicación" title="${direccion}">${ubicacion}${direccion !== '-' ? ' (' + direccion + ')' : ''}</div>
          <div class="t-col-exp" data-label="Experiencia">${exp}</div>
          <div class="t-col-status" data-label="Estado">
            <span class="badge">${status}</span>
          </div>
        </div>
      `;
    });

    table.innerHTML = html;

    table.querySelectorAll(".candidate-check").forEach(chk => {
      chk.onchange = (e) => {
        const val = String(e.target.value);
        if (e.target.checked) selectedCandidates.add(val);
        else selectedCandidates.delete(val);
        
        // Update header checkbox
        const allChecked = Array.from(table.querySelectorAll(".candidate-check")).every(c => c.checked);
        if (selectAllCandidates) selectAllCandidates.checked = allChecked;
        const innerHeadCb = table.querySelector("#selectAllCandidatesInner");
        if (innerHeadCb) innerHeadCb.checked = allChecked;

        refreshCompareButton();
      };
    });

    const innerHeadCb = table.querySelector("#selectAllCandidatesInner");
    if (innerHeadCb) {
      innerHeadCb.onchange = (e) => {
        const checked = e.target.checked;
        if (selectAllCandidates) selectAllCandidates.checked = checked;
        items.forEach(c => {
          if (checked) selectedCandidates.add(String(c.id));
          else selectedCandidates.delete(String(c.id));
        });
        renderCandidates(items);
      };
    }

    refreshCompareButton();
  }

  function refreshCompareButton() {
    if (!btnCompare || !compareCount) return;
    compareCount.textContent = String(selectedCandidates.size);
    btnCompare.style.display = selectedCandidates.size >= 2 ? "inline-flex" : "none";
  }

  function updateKPIs(items) {
    const total = items.length;
    const notas = items.map(x => num(x.nota)).filter(Number.isFinite);
    const exps = items.map(x => num(x.experiencia_total)).filter(Number.isFinite);

    const promNota = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length) : 0;
    const promExp = exps.length ? (exps.reduce((a, b) => a + b, 0) / exps.length) : 0;
    const pctN6 = notas.length ? (notas.filter(n => n >= 6).length / notas.length) * 100 : 0;

    if (kpiTotal) kpiTotal.textContent = String(total);
    if (kpiPromNota) kpiPromNota.textContent = promNota.toFixed(1);
    if (kpiPromExp) kpiPromExp.textContent = promExp.toFixed(1);
    if (kpiPctN6) kpiPctN6.textContent = `${pctN6.toFixed(0)}%`;
  }

  function updateTopList(items) {
    if (!topCandidatesEl) return;

    const top = [...items]
      .sort((a, b) => (num(b.nota) || 0) - (num(a.nota) || 0))
      .slice(0, 5);

    topCandidatesEl.innerHTML = top.map(c => {
      const nota = Number.isFinite(num(c.nota)) ? num(c.nota).toFixed(1) : "-";
      const exp = Number.isFinite(num(c.experiencia_total)) ? num(c.experiencia_total).toFixed(1) : "-";
      return `<li>${escapeHtml(c.nombre_completo || "-")} — Nota ${nota} — Exp ${exp}</li>`;
    }).join("");
  }

  function getSelectedCandidateIds() {
    return Array.from(document.querySelectorAll(".candidate-check:checked"))
      .map(el => el.value)
      .filter(Boolean);
  }

  function buildTec02RowsFromCandidates(rows) {
    return rows.map((c, index) => ({
      nro: index + 1,
      nombre_completo: c.nombre_completo || "",
      cargo: c.cargo_a_desempenar || "",
      titulo_profesional: c.profesion || "",
      experiencia_a: parseFloat(c.experiencia_total) || 0,
      experiencia_b: parseFloat(c.experiencia_en_empresa_actual) || 0,
      experiencia_c: parseFloat(c.exp_cargo_actual) || 0,
      experiencia_d: parseFloat(c.exp_proy_similares) || 0
    }));
  }

  async function exportTec02FromTemplate(rows, headerData) {
    if (!window.ExcelJS) {
      throw new Error("No está cargada la librería ExcelJS.");
    }

    const templateUrl = "./templates/tec02_template.xlsx";
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`No se encontró ${templateUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet("TEC-02") || workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("No se encontró la hoja TEC-02.");
    }

    if (headerData.legalName) worksheet.getCell("H9").value = headerData.legalName;
    if (headerData.legalRepresentative) worksheet.getCell("H11").value = headerData.legalRepresentative;

    worksheet.getCell("W11").value = new Date();
    worksheet.getCell("W11").numFmt = "dd-mm-yyyy";

    if (headerData.projectName) worksheet.getCell("H7").value = headerData.projectName;

    const startRow = 17;

    rows.forEach((w, index) => {
      const rowNumber = startRow + index;

      worksheet.getCell(`B${rowNumber}`).value = w.nro;
      worksheet.getCell(`C${rowNumber}`).value = w.nombre_completo;
      worksheet.getCell(`J${rowNumber}`).value = w.cargo;
      worksheet.getCell(`O${rowNumber}`).value = w.titulo_profesional;
      worksheet.getCell(`T${rowNumber}`).value = w.experiencia_a;
      worksheet.getCell(`V${rowNumber}`).value = w.experiencia_b;
      worksheet.getCell(`X${rowNumber}`).value = w.experiencia_c;
      worksheet.getCell(`Z${rowNumber}`).value = w.experiencia_d;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
      [buffer],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );

    const link = document.createElement("a");
    const safeName = (headerData.projectName || "Proyecto").replace(/[^\w\-]+/g, "_");

    link.href = URL.createObjectURL(blob);
    link.download = `TEC-02_${safeName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function generateTec02FromSelectedCandidates() {
    try {
      const selectedIds = getSelectedCandidateIds();

      if (!selectedIds.length) {
        window.notificar?.('Selecciona al menos un candidato.', 'warning');
        return;
      }

      const projectName = prompt("Nombre del proyecto:") || "Proyecto Sin Nombre";
      const legalName = prompt("Razón Social del Proponente:") || "";
      const legalRepresentative = prompt("Representante Legal:") || "";

      const { data, error } = await window.supabase
        .from("candidates")
        .select("*")
        .in("id", selectedIds)
        .order("nombre_completo", { ascending: true });

      if (error) throw error;

      const rows = buildTec02RowsFromCandidates(data || []);

      await exportTec02FromTemplate(rows, {
        projectName,
        legalName,
        legalRepresentative
      });
    } catch (err) {
      console.error('Error generando TEC-02 desde candidatos:', err);
      window.notificar?.('No se pudo generar el TEC-02: ' + err.message, 'error');
    }
  }

  async function generateTec02AFromSelectedCandidates() {
    try {
      const selectedIds = getSelectedCandidateIds();

      if (!selectedIds.length) {
        const msg = 'Selecciona al menos un candidato en la tabla de abajo.';
        if (window.notificar) window.notificar(msg, 'warning');
        else alert(msg);
        return;
      }

      const projectName = prompt("Nombre del proyecto:") || "Proyecto Sin Nombre";
      const legalName = prompt("Razón Social del Proponente:") || "";
      const legalRepresentative = prompt("Representante Legal:") || "";

      const { data, error } = await window.supabase
        .from("candidates")
        .select("*")
        .in("id", selectedIds)
        .order("nombre_completo", { ascending: true });

      if (error) throw error;

      await exportTec02AFromTemplate(data || [], {
        projectName,
        legalName,
        legalRepresentative
      });
    } catch (err) {
      console.error('Error generando TEC-02-A:', err);
      const msg = 'No se pudo generar el TEC-02-A: ' + err.message;
      if (window.notificar) window.notificar(msg, 'error');
      else alert(msg);
    }
  }

  async function exportTec02AFromTemplate(candidates, headerData) {
    if (!window.ExcelJS) throw new Error("No está cargada la librería ExcelJS.");

    const templateUrl = "./templates/tec02-A_template.xlsx";
    const response = await fetch(templateUrl);
    if (!response.ok) {
        const altUrl = "templates/tec02-A_template.xlsx";
        const altResp = await fetch(altUrl);
        if (!altResp.ok) throw new Error(`No se encontró el archivo ${templateUrl}`);
        response = altResp;
    }

    const arrayBuffer = await response.arrayBuffer();
    const mainWorkbook = new ExcelJS.Workbook();
    await mainWorkbook.xlsx.load(arrayBuffer);

    // Obtener la hoja de plantilla maestra
    const masterSheet = mainWorkbook.getWorksheet("FORMULARIO TEC-02A CV PERSONAL") || mainWorkbook.getWorksheet(1);
    const dateStr = new Date().toLocaleDateString("es-ES");

    const usedSheetNames = new Set();
    for (const c of candidates) {
      let baseName = (c.nombre_completo || "Candidato").substring(0, 31).replace(/[\\\/\?\*\[\]]/g, "_");
      let sheetName = baseName;
      let counter = 1;
      
      while (usedSheetNames.has(sheetName)) {
        const suffix = ` (${counter})`;
        sheetName = baseName.substring(0, 31 - suffix.length) + suffix;
        counter++;
      }
      usedSheetNames.add(sheetName);

      const newSheet = mainWorkbook.addWorksheet(sheetName);

      // CLONACIÓN PROFUNDA (Celdas, Estilos, Mezclas y Columnas)
      
      // 1. Clonar celdas combinadas (Muy importante para la estructura)
      if (masterSheet.model.merges) {
        masterSheet.model.merges.forEach(range => {
          newSheet.mergeCells(range);
        });
      }

      // 2. Clonar anchos de columna
      masterSheet.columns.forEach((col, i) => {
        if (col.width) newSheet.getColumn(i + 1).width = col.width;
      });

      // 3. Clonar celdas de forma masiva (Hasta la columna AJ y fila 80 para seguridad)
      for (let r = 1; r <= 80; r++) {
        const row = masterSheet.getRow(r);
        const newRow = newSheet.getRow(r);
        if (row.height) newRow.height = row.height;

        for (let colIndex = 1; colIndex <= 36; colIndex++) { // Hasta columna AJ aprox
          const fCell = row.getCell(colIndex);
          const tCell = newRow.getCell(colIndex);
          tCell.value = fCell.value;
          tCell.style = fCell.style;
        }
      }

      // AJUSTAR DATOS DINÁMICOS (Según captura de celdas final)
      // Nota: H=8, X=24, NOMBRE=17, PROF=19, CARGO=21
      
      // Encabezados comunes del proyecto
      newSheet.getCell("H10").value = headerData.legalName; // Razón Social en row 10
      newSheet.getCell("H12").value = headerData.legalRepresentative; // Representante en row 12
      newSheet.getCell("X12").value = dateStr; // Fecha en X12

      // Datos personales del candidato (Celdas blancas sobre las etiquetas grises)
      const cellName = newSheet.getCell("H16");
      cellName.value = c.nombre_completo;
      cellName.alignment = { vertical: 'middle', horizontal: 'center' };

      const cellProf = newSheet.getCell("H18");
      cellProf.value = c.profesion;
      cellProf.alignment = { vertical: 'middle', horizontal: 'center' };

      const cellCargo = newSheet.getCell("H20");
      cellCargo.value = c.cargo_a_desempenar || headerData.projectName;
      cellCargo.alignment = { vertical: 'middle', horizontal: 'center' };

      // Bloques de experiencia (Headers en 24, 31, 38, 44 - El contenido en la celda siguiente)
      // Ajuste: El contenido suele ir en la celda mezclada justo debajo del header.
      newSheet.getCell("B25").value = c.experiencia_general;
      newSheet.getCell("B32").value = c.experiencia_especifica;
      newSheet.getCell("B39").value = c.otras_experiencias;
      newSheet.getCell("B45").value = c.antecedentes_academicos;

      // Forzar wrap text y ajuste de altura en los bloques de texto
      [25, 32, 39, 45].forEach(rowNum => {
        const cell = newSheet.getCell(`B${rowNum}`);
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        
        // Estimar altura si hay mucho texto (ExcelJS no auto-ajusta filas combinadas)
        const textLen = String(cell.value || "").length;
        if (textLen > 150) {
            newSheet.getRow(rowNum).height = Math.min(150, Math.max(60, textLen / 2.5));
        }
      });
    }

    // Opcional: Eliminar la hoja de plantilla original para que solo queden las de los trabajadores
    // mainWorkbook.removeWorksheet(masterSheet.id);

    const buffer = await mainWorkbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    const safeProject = (headerData.projectName || "Proyecto").replace(/[^\w\-]+/g, "_");
    
    link.href = URL.createObjectURL(blob);
    link.download = `TEC-02-A_${safeProject}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  init();
})();