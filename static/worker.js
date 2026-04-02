(async function () {
  const $ = (s) => document.querySelector(s);
  const n8n_webhook_url = 'https://primary-production-aa252.up.railway.app/webhook/39501108-66d4-4117-99d1-7bc9cd21ca08';

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

      const [
        { data: credentials, error: cErr },
        { data: exams, error: eErr }
      ] = await Promise.all([
        supabase
          .from("worker_credentials")
          .select("*")
          .eq("worker_id", workerId)
          .order("expiry_date", { ascending: false }),
        supabase
          .from("medical_exam_records")
          .select("*")
      ]);

      if (cErr) throw cErr;
      if (eErr) throw eErr;

      // Filtrar exámenes por RUT usando la misma lógica que el listado (workers.supabase.js)
      const normalize = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();
      const workerRut = normalize(worker.rut);
      const filteredExams = (exams || []).filter(e => normalize(e.rut) === workerRut);

      // Combinar ambos (usamos un Set para evitar duplicados exactos si ambos sistemas guardaron lo mismo)
      // Pero por ahora, simplemente concatenamos para mostrar TODO lo que el sistema lee.
      renderProfile(worker, [...(credentials || []), ...filteredExams]);
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
            <button class="btn btn--primary" id="btnEditProfile" style="width:100%; margin-top:20px;">
              ✏️ Editar Perfil
            </button>
          </div>
        </div>

        <div class="profile-main">
          <div class="card" style="margin-bottom:24px;">
            <div class="card__body">
              <h2 class="h1" style="font-size:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                Cumplimiento y Documentación
                <div style="display:flex; gap:8px; align-items:center;">
                  <span class="badge badge--info">${creds.length} documentos</span>
                  <button class="btn btn--mini btn--primary" id="btnUploadDoc">➕ Subir</button>
                </div>
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

    const btnEdit = $("#btnEditProfile");
    if (btnEdit) btnEdit.onclick = () => openEditModal(w);

    const btnUpload = $("#btnUploadDoc");
    if (btnUpload) btnUpload.onclick = openUploadModal;
  }

  function openEditModal(w) {
    let modal = $("#editModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "editModal";
      modal.className = "modal";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal__content" style="max-width:400px;">
        <div class="modal__header">
          <h2 class="h1" style="font-size:1.5rem">Editar Perfil</h2>
          <button class="close-modal">&times;</button>
        </div>
        <form id="editForm">
          <div class="form-group">
            <label>Nombre Completo</label>
            <input name="full_name" class="input" value="${escapeHtml(w.full_name || "")}" required>
          </div>
          <div class="form-group">
            <label>RUT</label>
            <input name="rut" class="input" value="${escapeHtml(w.rut || "")}" readonly style="opacity:0.6">
          </div>
          <div class="form-group">
            <label>Empresa / Faena</label>
            <input name="company_name" class="input" value="${escapeHtml(w.company_name || "")}">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input name="email" class="input" type="email" value="${escapeHtml(w.email || "")}">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input name="phone" class="input" value="${escapeHtml(w.phone || "")}">
          </div>
          <div style="display:flex; gap:10px; margin-top:20px;">
            <button type="submit" class="btn btn--primary" style="flex:1">Guardar cambios</button>
            <button type="button" class="btn close-modal" style="flex:1">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add("is-open");

    const close = () => modal.classList.remove("is-open");
    modal.querySelectorAll(".close-modal").forEach(b => b.onclick = close);

    const form = modal.querySelector("#editForm");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = {
        full_name: formData.get("full_name"),
        company_name: formData.get("company_name"),
        email: formData.get("email"),
        phone: formData.get("phone")
      };

      try {
        const { error } = await supabase.from("workers").update(payload).eq("id", workerId);
        if (error) throw error;
        window.notificar?.("Perfil actualizado exitosamente", "success");
        close();
        loadWorkerData();
      } catch (err) {
        window.notificar?.("Error al actualizar: " + err.message, "error");
      }
    };
  }

  function openUploadModal() {
    let modal = $("#uploadModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "uploadModal";
      modal.className = "modal";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal__content" style="max-width:500px;">
        <div class="modal__header">
          <h2 class="h1" style="font-size:1.5rem">Subir Documento</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal__body">
          <p style="font-size:13px; color:var(--muted); margin-bottom:20px;">
            Sube un examen médico o certificado. La IA lo vectorizará automáticamente.
          </p>
          <div id="dropzone" style="border:2px dashed var(--border); border-radius:12px; padding:40px; text-align:center; cursor:pointer; margin-bottom:20px;">
            Arrastra archivos aquí o haz clic para seleccionar
            <input type="file" id="fileInput" hidden accept=".pdf,.png,.jpg,.jpeg">
          </div>
          <div id="uploadQueue"></div>
          <button id="btnStartUpload" class="btn btn--primary" style="width:100%; margin-top:10px;">Comenzar Carga</button>
        </div>
      </div>
    `;

    modal.classList.add("is-open");
    const close = () => modal.classList.remove("is-open");
    modal.querySelectorAll(".close-modal").forEach(b => b.onclick = close);

    const dropzone = modal.querySelector("#dropzone");
    const fileInput = modal.querySelector("#fileInput");
    const queue = modal.querySelector("#uploadQueue");
    const startBtn = modal.querySelector("#btnStartUpload");

    let fileToUpload = null;

    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        fileToUpload = e.target.files[0];
        queue.innerHTML = `<div style="padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;">📄 ${fileToUpload.name}</div>`;
      }
    };

    startBtn.onclick = async () => {
      if (!fileToUpload) return window.notificar?.("Selecciona un archivo primero", "warning");
      
      startBtn.disabled = true;
      startBtn.textContent = "Subiendo...";

      try {
        // 1. Storage
        const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `uploads/${Date.now()}_${safeName}`;
        const { error: stErr } = await supabase.storage.from('tenders_and_docs').upload(storagePath, fileToUpload);
        if (stErr) throw stErr;

        // 2. Metadata entry
        const { data: dbData, error: dbErr } = await supabase.from('client_documents').insert({
          file_name: fileToUpload.name,
          file_size: fileToUpload.size,
          storage_path: storagePath,
          category: 'Worker Detail'
        }).select().single();
        if (dbErr) throw dbErr;

        // 3. Webhook (Vectorization)
        const { data: signedData } = await supabase.storage.from('tenders_and_docs').createSignedUrl(storagePath, 600);
        
        await fetch(n8n_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AFK-Secret': 'AFK_PRO_2024_SECURE_KEY' },
          body: JSON.stringify({
            document_id: dbData.id,
            worker_id: workerId,
            file_name: fileToUpload.name,
            storage_path: storagePath,
            signed_url: signedData?.signedUrl
          })
        });

        window.notificar?.("Documento subido. Vectorizando con IA...", "success");
        close();
        setTimeout(loadWorkerData, 2000);
      } catch (err) {
        window.notificar?.("Error en carga: " + err.message, "error");
      } finally {
        startBtn.disabled = false;
        startBtn.textContent = "Comenzar Carga";
      }
    };
  }

  init();
})();