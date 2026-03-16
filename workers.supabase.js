// workers.supabase.js
(async function () {
  const $ = (s) => document.querySelector(s);
  const tableBody = $("#workersTable");

  let allWorkers = [];
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

  async function init() {
    if (!tableBody) {
      console.error("No se encontró el contenedor #workersTable");
      return;
    }

    if (!window.supabase) {
      setTimeout(init, 500);
      return;
    }

    setupFilters();
    await loadWorkers();
  }

  init();

  async function loadWorkers() {
    try {
      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Cargando listado de trabajadores...
        </div>
      `;

      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;

      allWorkers = data || [];
      renderWorkers(allWorkers);
    } catch (err) {
      console.error("Error loading workers:", err);
      tableBody.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Error al cargar trabajadores.
        </div>
      `;
    }
  }

  function renderWorkers(items) {
    const header = `
      <div class="t-head">
        <div style="width:40px"><input type="checkbox" id="selectAll"></div>
        <div>Nombre</div>
        <div>RUT</div>
        <div>Empresa / Faena</div>
        <div>Email</div>
        <div>Estado</div>
      </div>
    `;

    let html = header;

    if (!items || items.length === 0) {
      html += `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          No se encontraron trabajadores.
        </div>
      `;
    } else {
      items.forEach((w) => {
        const id = w.id;
        const name = escapeHtml(w.full_name || "Desconocido");
        const rut = escapeHtml(w.rut || "N/A");
        const company = escapeHtml(w.company_name || "Sin asignar");
        const email = escapeHtml(w.email || "-");
        const status = normalizeStatus(w.status);
        const statusClass =
          status === "Activo" ? "badge--active" : "badge--inactive";

        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          w.full_name || "Desconocido"
        )}&background=random&color=fff`;

        html += `
          <div class="t-row" data-id="${escapeHtml(id)}">
            <div style="width:40px">
              <input
                type="checkbox"
                class="worker-check"
                value="${escapeHtml(id)}"
                ${selectedWorkers.has(String(id)) ? "checked" : ""}
              >
            </div>

            <div class="emp t-col-name" data-label="Nombre">
              <img class="avatar" src="${avatar}" alt="${name}">
              <div>
                <a
                  href="worker.html?id=${encodeURIComponent(id)}"
                  class="emp__name"
                  style="color:var(--text); text-decoration:none; border-bottom:1px solid transparent;"
                  onmouseover="this.style.borderColor='var(--accent)'"
                  onmouseout="this.style.borderColor='transparent'"
                >
                  ${name}
                </a>
              </div>
            </div>

            <div class="t-col-rut" data-label="RUT">${rut}</div>

            <div class="faena-cell t-col-faena" data-label="Empresa">
              <span class="faena-text">${company}</span>
              <button
                class="btn btn--mini btn-assign"
                style="padding:2px 6px; font-size:10px; margin-left:8px; opacity:0.7; display:${company === "Sin asignar" ? "inline-block" : "none"}"
              >
                Asignar
              </button>
            </div>

            <div class="t-col-email" data-label="Email">${email}</div>

            <div class="t-col-status" data-label="Estado">
              <span class="badge ${statusClass}">${status}</span>
            </div>
          </div>
        `;
      });
    }

    tableBody.innerHTML = html;

    const selectAll = $("#selectAll");

    if (selectAll) {
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

    tableBody.querySelectorAll(".worker-check").forEach((c) => {
      c.onchange = (e) => {
        const value = String(e.target.value);
        if (e.target.checked) selectedWorkers.add(value);
        else {
          selectedWorkers.delete(value);
          if (selectAll) selectAll.checked = false;
        }
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

          await loadWorkers();
        } catch (err) {
          console.error("Error actualizando faena:", err);
          alert("Error: " + err.message);
        }
      };
    });
  }

  async function generateTec02() {
    const project = $("#projectName")?.value?.trim() || "Proyecto Sin Nombre";

    if (selectedWorkers.size === 0) {
      alert("Por favor, selecciona al menos un trabajador.");
      return;
    }

    const ids = Array.from(selectedWorkers).join(",");
    window.location.href = `reports.html?type=tec02&project=${encodeURIComponent(
      project
    )}&workers=${encodeURIComponent(ids)}`;
  }

  const btnGen = $("#btnGenerateTec02");
  if (btnGen) btnGen.onclick = generateTec02;

  function setupFilters() {
    const searchInput = $("#workerSearch");
    const statusFilter = $("#filterStatus");
    const resetBtn = $("#btnResetFilters");

    if (!searchInput || !statusFilter || !resetBtn) {
      console.warn("Faltan elementos de filtros en el DOM");
      return;
    }

    const applyFilters = () => {
      const query = searchInput.value.trim().toLowerCase();
      const status = statusFilter.value.trim().toLowerCase();

      const filtered = allWorkers.filter((w) => {
        const fullName = String(w.full_name || "").toLowerCase();
        const rut = String(w.rut || "").toLowerCase();
        const company = String(w.company_name || "").toLowerCase();
        const workerStatus = String(w.status || "").trim().toLowerCase();

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
})();