// documents.supabase.js - Lógica para subida y lectura segura de documentos desde Supabase Storage

(function () {
  const d = document;
  const dropzone = d.getElementById('dropzone');
  const fileInput = d.getElementById('fileInput');
  const pickFilesBtn = d.getElementById('pickFiles');
  const filesQueue = d.getElementById('files');
  const uploadBtn = d.getElementById('uploadNow');

  // Agregar un contenedor para los documentos ya subidos bajo el formulario (si no existe lo creamos)
  let uploadedList = d.getElementById('uploadedDocs');
  if (!uploadedList) {
    uploadedList = d.createElement('div');
    uploadedList.id = 'uploadedDocs';
    uploadedList.style.marginTop = '40px';
    uploadedList.innerHTML = `<h2 class="h2" style="margin-bottom:16px;">Mis Documentos Subidos</h2><div id="uploadedListItems" class="files">Cargando...</div>`;
    d.querySelector('.card__body').appendChild(uploadedList);
  }
  const uploadedListItems = d.getElementById('uploadedListItems');

  let filesToUpload = [];
  let currentUser = null;

  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  const ALLOWED_EXTS = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];

  // Formatear bytes a texto
  const bytesToText = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

  async function checkAuth() {
    // Esperar a que el auth.js cargue y Supabase inicialice
    if (!window.supabase) {
      setTimeout(checkAuth, 100);
      return;
    }
    const { data: { user } } = await window.supabase.auth.getUser();
    if (user) {
      currentUser = user;
      loadMyDocuments();
    } else {
      console.error("No hay usuario autenticado.");
    }
  }

  // --- RENDER DE ARCHIVOS EN COLA (Local) ---
  function renderQueue() {
    filesQueue.innerHTML = '';
    filesToUpload.forEach((f, i) => {
      const row = d.createElement('div');
      row.className = 'file';
      row.innerHTML = `
        <span class="dot" style="background:#fbbf24"></span>
        <div class="name">${f.name} <span class="size">· ${bytesToText(f.size)}</span></div>
        <button class="btn btn-remove-queue" style="color:var(--danger)">X</button>
      `;
      row.querySelector('.btn-remove-queue').onclick = () => {
        filesToUpload.splice(i, 1);
        renderQueue();
      };
      filesQueue.appendChild(row);
    });
  }

  function handleFiles(newFiles) {
    for (const f of newFiles) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        window.notificar?.(`Formato no permitido: ${f.name}`, 'warning');
        continue;
      }
      if (f.size > MAX_SIZE) {
        window.notificar?.(`Archivo muy pesado (Máx 25MB): ${f.name}`, 'warning');
        continue;
      }
      filesToUpload.push(f);
    }
    renderQueue();
  }

  // Eventos Drag & Drop
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault();
    dropzone.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
  }));

  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  pickFilesBtn.onclick = () => fileInput.click();
  fileInput.onchange = e => handleFiles(e.target.files);

  // --- SUBIDA SEGURA ---
  uploadBtn.onclick = async () => {
    if (!filesToUpload.length) return window.notificar?.('No hay archivos para subir.', 'warning');
    if (!currentUser) return window.notificar?.('Falta autenticación.', 'error');

    uploadBtn.textContent = 'Subiendo...';
    uploadBtn.disabled = true;

    try {
      for (const file of filesToUpload) {
        // 1. Generar path seguro en Storage: [user_id]/[timestamp]-[nombre]
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${currentUser.id}/${Date.now()}_${safeName}`;

        // Subir binario al bucket privado
        const { error: uploadError } = await window.supabase.storage
          .from('tenders_and_docs')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        // 2. Insertar Metadatos en la tabla segura con RLS
        const { data: dbData, error: dbError } = await window.supabase
          .from('client_documents')
          .insert({
            user_id: currentUser.id,
            file_name: file.name,
            file_size: file.size,
            storage_path: storagePath
          }).select().single();

        if (dbError) throw dbError;

        // 2.5 Generar URL firmada temporal de 10 minutos (600s) para que n8n pueda descargar el PDF real y no choque con el muro de privacidad
        const { data: signedData, error: signErr } = await window.supabase.storage
          .from('tenders_and_docs')
          .createSignedUrl(storagePath, 600);

        const downloadUrl = signedData ? signedData.signedUrl : '';

        // 3. Avisar a n8n (Webhook) para inicializar Vectorización AI
        try {
          const n8nUrl = 'https://primary-production-aa252.up.railway.app/webhook/39501108-66d4-4117-99d1-7bc9cd21ca08';
          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

          await fetch(n8nUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-AFK-Secret': 'AFK_PRO_2024_SECURE_KEY' // Blindaje de seguridad
            },
            body: JSON.stringify({
              document_id: dbData.id,
              user_id: currentUser.id,
              file_name: file.name,
              file_type: ext, // Para que n8n sepa si vectorizar (PDF) o extraer (Excel)
              storage_path: storagePath,
              signed_url: downloadUrl,
              bucket: 'tenders_and_docs'
            })
          });
          window.notificar?.(`Procesando ${file.name} con IA...`, 'success');
        } catch (whErr) {
          console.warn('Hubo un error temporal enviando aviso a n8n:', whErr);
        }
      }

      window.notificar?.(`Se subieron ${filesToUpload.length} documentos correctamente.`, 'success');
      filesToUpload = [];
      renderQueue();
      loadMyDocuments();

    } catch (err) {
      console.error('Error al subir documento:', err);
      window.notificar?.('Error en la carga: ' + err.message, 'error');
    } finally {
      uploadBtn.textContent = 'Subir ahora';
      uploadBtn.disabled = false;
      fileInput.value = '';
    }
  };


  // --- CARGA DE DOCUMENTOS DEL USUARIO ---
  async function loadMyDocuments() {
    if (!currentUser) return;
    uploadedListItems.innerHTML = '<p class="text-muted">Cargando...</p>';

    // 1. Obtener registros (RLS nativo solo devuelve los propios)
    const { data: docs, error: dbErr } = await window.supabase
      .from('client_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbErr) {
      uploadedListItems.innerHTML = `<p class="error text-danger">Error: ${dbErr.message}</p>`;
      return;
    }

    if (!docs || docs.length === 0) {
      uploadedListItems.innerHTML = '<p class="text-muted" style="padding:16px;">Aún no has subido documentos a tu boveda privada.</p>';
      return;
    }

    // 2. Renderizar lista
    uploadedListItems.innerHTML = '';

    // Obtenemos URLs firmadas temporales si queremos permitir descarga real,
    // o simplemente listamos y generamos la URL cuando hagan clic.
    for (const doc of docs) {
      const row = d.createElement('div');
      row.className = 'file';
      row.style.background = 'rgba(255,255,255,0.02)';
      row.style.marginBottom = '6px';

      const date = new Date(doc.created_at).toLocaleDateString();

      row.innerHTML = `
        <span class="dot" style="background:#10b981"></span>
        <div class="name" style="flex:1">
          <strong>${doc.file_name}</strong> 
          <span class="size" style="margin-left:8px; font-size:12px; color:var(--muted);">· ${bytesToText(doc.file_size)} · Subido el ${date}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-mini btn-download" data-path="${doc.storage_path}">Descargar</button>
          <button class="btn btn-mini btn-delete-doc text-danger" data-id="${doc.id}" data-path="${doc.storage_path}">🗑️</button>
        </div>
      `;

      // Evento de descarga segura
      row.querySelector('.btn-download').onclick = async (e) => {
        const path = e.target.dataset.path;
        const { data, error } = await window.supabase.storage.from('tenders_and_docs').createSignedUrl(path, 60); // 60s
        if (error) return window.notificar?.(\"Error al firmar URL: \" + error.message, 'error');
        window.open(data.signedUrl, '_blank');
      };

      // Evento de borrado
      row.querySelector('.btn-delete-doc').onclick = async (e) => {
        if (!confirm('¿Eliminar documento definitivamente?')) return;
        const path = e.target.dataset.path;
        const id = e.target.dataset.id;

        // Primero borramos el binario del storage
        const { error: stErr } = await window.supabase.storage.from('tenders_and_docs').remove([path]);
        if (stErr) return window.notificar?.(\"Error en Storage: \" + stErr.message, 'error');

        // Luego borramos el registro central
        await window.supabase.from('client_documents').delete().eq('id', id);

        // Doble escudo: si el borrado automático de la base de datos (Cascade) no alcanzó a los documentos antiguos,
        // este script los forzará a borrarse usando el ID que está guardado en texto dentro de la metadata.
        const { error: vecErr } = await window.supabase.from('document_chunks').delete().contains('metadata', { document_id: id });
        if (vecErr) console.warn("No se borraron vectores huérfanos:", vecErr.message);

        loadMyDocuments();
      };

      uploadedListItems.appendChild(row);
    }
  }

  // Inicializar todo
  d.addEventListener('DOMContentLoaded', checkAuth);

})();
