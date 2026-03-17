(async function () {
  const $ = (s) => document.querySelector(s);
  const qs = new URLSearchParams(window.location.search);
  const workerId = qs.get("id");
  const content = $("#profileContent");

  let currentCreds = [];

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("es-CL");
  }

  function normalizeStatus(status) {
    const s = String(status || "").trim().toLowerCase();
    if (s === "activo" || s === "active") return "Activo";
    if (s === "inactivo" || s === "inactive") return "Inactivo";
    return status || "Activo";
  }

  function isInfpsico(c) {
    const name = String(c?.credential_name || "").toUpperCase();
    return name.includes("INFPSICO");
  }

  function getCredentialVisualState(c) {
    const now = new Date();

    if (isInfpsico(c)) {
      return {
        badgeClass: "badge--info",
        badgeText: c.result_status || "Informe",
        expiryText: "Sin vencimiento",
      };
    }

    if (!c.expiry_date) {
      return {
        badgeClass: "badge--warning",
        badgeText: c.result_status || "Sin fecha",
        expiryText: "Pendiente de verificación",
      };
    }

    const expiry = new Date(c.expiry_date);
    if (Number.isNaN(expiry.getTime())) {
      return {
        badgeClass: "badge--warning",
        badgeText: c.result_status || "Fecha inválida",
        expiryText: "Pendiente de verificación",
      };
    }

    const isExpired = expiry <= now;

    return {
      badgeClass: isExpired ? "badge--danger" : "badge--success",
      badgeText: c.result_status || (isExpired ? "Vencido" : "Vigente"),
      expiryText: formatDate(c.expiry_date),
    };
  }

  async function init() {
    if (!content) {
      console.error("No se encontró #profileContent");
      return;
    }

    if (!window.supabase) {
      setTimeout(init, 400);
      return;
    }

    if (!workerId) {
      content.innerHTML = `<div class="card"><div class="card__body"><h2 class="h1">No se especificó un ID de trabajador.</h2></div></div>`;
      return;
    }

    await loadWorkerData();
  }

  async function loadWorkerData() {
    try {
      content.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--muted)">
          Cargando perfil del trabajador...
        </div>
      `;

      const { data: worker, error: wErr } = await supabase
        .from("workers")
        .select("*")
        .eq("id", workerId)
        .single();

      if (wErr) throw wErr;

      const { data: credentials, error: cErr } = await supabase
        .from("worker_credentials")
        .select("*")
        .eq("worker_id", workerId)
        .order("expiry_date", { ascending: false });

      if (cErr) throw cErr;

      renderProfile(worker, credentials || []);
    } catch (err) {
      console.error("Error loading worker profile:", err);
      content.innerHTML = `
        <div class="card">
          <div class="card__body">
            <h2 class="h1">Error al cargar datos</h2>
            <p style="color:var(--muted);">${escapeHtml(err.message || "Error desconocido")}</p>
          </div>
        </div>
      `;
    }
  }

  function showCredentialDetail(id) {
    const c = currentCreds.find((x) => String(x.id) === String(id));
    if (!c) return;

    let modal = document.getElementById("docModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "docModal";
      modal.className = "modal";
      document.body.appendChild(modal);
    }

    const state = getCredentialVisualState(c);

    modal.innerHTML = `
      <div class="modal__content" style="max-width:720px;">
        <div class="modal__header">
          <h3 class="h1" style="margin:0; font-size:18px;">
            ${escapeHtml(c.credential_name || "Documento")}
          </h3>
          <button class="close-modal" id="closeDocModalBtn">&times;</button>
        </div>

        <div style="display:grid; gap:16px;">
          <div class="form-group">
            <label>Categoría</label>
            <div>${escapeHtml(c.credential_category || "General")}</div>
          </div>

          <div class="form-group">
            <label>Tipo de examen</label>
            <div>${escapeHtml(c.exam_type || "-")}</div>
          </div>

          <div class="form-group">
            <label>Observaciones</label>
            <div>${escapeHtml(c.observation || "Sin observaciones registradas.")}</div>
          </div>

          <div class="form-group">
            <label>Restricciones / Recomendaciones</label>
            <div>${escapeHtml(c.restriction_notes || "Sin recomendaciones especiales.")}</div>
          </div>

          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <span class="badge ${state.badgeClass}">${escapeHtml(state.badgeText)}</span>
            <span class="badge">${escapeHtml(state.expiryText)}</span>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("is-open");

    const close = () => modal.classList.remove("is-open");

    modal.onclick = (e) => {
      if (e.target === modal) close();
    };

    const closeBtn = document.getElementById("closeDocModalBtn");
    if (closeBtn) closeBtn.onclick = close;
  }

  function renderProfile(w, creds) {
    currentCreds = creds;

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      w.full_name || "Trabajador"
    )}&size=128&background=random&color=fff`;

    const docsHtml =
      creds.length === 0
        ? `<p class="text-muted">No hay registros de exámenes o certificaciones.</p>`
        : creds
            .map((c) => {
              const state = getCredentialVisualState(c);
              const displayName = c.exam_type
                ? `${escapeHtml(c.credential_name)} (${escapeHtml(c.exam_type)})`
                : escapeHtml(c.credential_name || "Documento");

              return `
                <div class="credential-card" data-doc-id="${escapeHtml(c.id)}" style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 14px; border:1px solid var(--border); border-radius:12px; margin-bottom:10px; cursor:pointer; background:rgba(255,255,255,.02);">
                  <div style="display:flex; flex-direction:column; gap:4px; min-width:0;">
                    <strong>${displayName}</strong>
                    <span class="text-muted" style="font-size:12px;">
                      Tipo: ${escapeHtml(c.credential_category || "General")}
                    </span>
                    <span style="font-size:11px; color:var(--muted)">
                      ${escapeHtml(state.expiryText)}
                    </span>
                  </div>

                  <div class="badge ${state.badgeClass}">
                    ${escapeHtml(state.badgeText)}
                  </div>
                </div>
              `;
            })
            .join("");

    content.innerHTML = `
      <div class="profile-grid" style="display:grid; grid-template-columns:320px 1fr; gap:24px;">
        <div class="profile-sidebar">
          <div class="card" style="text-align:center; padding:30px;">
            <img src="${avatar}" alt="${escapeHtml(w.full_name || "Trabajador")}" style="width:120px; height:120px; border-radius:50%; margin-bottom:20px; border:4px solid var(--border); object-fit:cover;">
            <h1 class="h1" style="margin:0">${escapeHtml(w.full_name || "Sin nombre")}</h1>
            <p class="text-muted" style="margin:10px 0">${escapeHtml(w.rut || "-")}</p>

            <div class="badge ${
              normalizeStatus(w.status) === "Activo" ? "badge--active" : "badge--inactive"
            }" style="margin-bottom:20px">
              ${escapeHtml(normalizeStatus(w.status))}
            </div>

            <div style="text-align:left; border-top:1px solid var(--border); padding-top:20px; margin-top:20px; display:grid; gap:12px;">
              <div><strong>Empresa/Faena:</strong><br>${escapeHtml(w.company_name || "Sin asignar")}</div>
              <div><strong>Email:</strong><br>${escapeHtml(w.email || "-")}</div>
              <div><strong>Teléfono:</strong><br>${escapeHtml(w.phone || "-")}</div>
            </div>
          </div>
        </div>

        <div class="profile-main">
          <div class="card" style="margin-bottom:24px;">
            <div class="card__body">
              <h2 class="h1" style="font-size:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                Cumplimiento y Documentación
                <span class="badge badge--info">${creds.length} documentos</span>
              </h2>

              <div class="credentials-list">
                ${docsHtml}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__body">
              <h2 class="h1" style="font-size:18px; margin-bottom:14px;">Currículum Vitae</h2>
              <p class="text-muted">Documentos cargados en el sistema de almacenamiento seguro.</p>
              <button class="btn btn--primary" onclick="alert('Funcionalidad de CV de trabajador en desarrollo.')">
                Ver CV Digital
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    content.querySelectorAll(".credential-card").forEach((el) => {
      el.onclick = () => showCredentialDetail(el.dataset.docId);
    });
  }

  init();
})();