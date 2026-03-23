// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores

(function () {
  const $ = (s) => document.querySelector(s);
  const tendersList = $('#tendersList');
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const matchBody = $('#matchBody');
  const tenderIdInput = $('#tenderId');
  const tenderNameInput = $('#tenderName');
  const tenderDescInput = $('#tenderDesc');

  function normalizeText(text) {
    if (!text) return '';
    return text.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  // --- GESTIÓN DE INTERFAZ ---

  function openModal(m) { m.classList.add('is-open'); }
  function closeModal(m) { m.classList.remove('is-open'); }

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { closeModal(tenderModal); closeModal(matchModal); };
  });

  $('#btnNewTender').onclick = () => {
    tenderIdInput.value = '';
    tenderForm.reset();
    reqContainer.innerHTML = '';
    addReqInput();
    openModal(tenderModal);
  };

  $('#btnAddReq').onclick = () => addReqInput();

  function addReqInput(val = '') {
    const div = document.createElement('div');
    div.className = 'grid-2';
    div.style.gap = '8px';
    div.innerHTML = `
      <input class="input req-input" value="${val}" placeholder="Ej: Altura Física" required>
      <button type="button" class="btn btn--mini btn-del-req" style="color:#f87171">X</button>
    `;
    div.querySelector('.btn-del-req').onclick = () => div.remove();
    reqContainer.appendChild(div);
  }

  const tendersBody = $('#tendersBody');
  const searchInput = $('#searchTender');
  let allTenders = [];

  // --- LÓGICA DE BASE DE DATOS ---

  async function loadTenders() {
    try {
      if (tendersBody) {
        tendersBody.innerHTML = Array(3).fill(0).map(() => `
          <div class="t-row" style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="t-col-name"><div class="skeleton skeleton-text" style="width:150px"></div></div>
            <div class="t-col-desc"><div class="skeleton skeleton-text" style="width:100%"></div></div>
            <div class="t-col-reqs"><div class="skeleton skeleton-badge"></div></div>
          </div>
        `).join('');
      }

      const { data, error } = await window.supabase
        .from('tenders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      tendersBody.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">${error.message}</div>`;
      return;
    }

    allTenders = data || [];
    renderTenders();
    } catch (err) {
      console.error('Error cargando licitaciones:', err);
      if (tendersBody) {
        tendersBody.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">Error: ${err.message}</div>`;
      }
    }
  }

  function renderTenders() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    
    const filteredTenders = allTenders.filter(t => {
      const nom = (t.name || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const reqs = (t.requirements || []).join(" ").toLowerCase();
      return nom.includes(searchTerm) || desc.includes(searchTerm) || reqs.includes(searchTerm);
    });

    if (filteredTenders.length === 0) {
      tendersBody.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--muted);">
          ${allTenders.length === 0 ? "No has creado ninguna licitación todavía." : "No se encontraron licitaciones para tu búsqueda."}
        </div>
      `;
      return;
    }

    tendersBody.innerHTML = filteredTenders.map(t => `
      <div class="t-row" style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: start;">
        <div class="t-col-name" style="font-weight: 600;">${escapeHtml(t.name)}</div>
        <div class="t-col-desc" style="color: var(--muted); font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(t.description || 'Sin descripción')}
        </div>
        <div class="t-col-reqs" style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${t.requirements.slice(0, 3).map(r => `<span class="badge" style="background:rgba(255,255,255,0.1)">${escapeHtml(r)}</span>`).join('')}
          ${t.requirements.length > 3 ? `<span class="badge" style="background:rgba(255,255,255,0.05)">+${t.requirements.length - 3}</span>` : ''}
        </div>
        <div class="t-col-actions" style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
          <button class="btn btn--mini btn--primary btn-match" data-id="${t.id}">Evaluar</button>
          <button class="btn btn--mini btn-edit" data-id="${t.id}" title="Editar">✏️</button>
          <button class="btn btn--mini btn-delete" data-id="${t.id}" title="Eliminar" style="color:#f87171">🗑️</button>
        </div>
      </div>
    `).join('');

    // Eventos
    document.querySelectorAll('.btn-match').forEach(btn => {
      btn.onclick = () => runMatchmaking(filteredTenders.find(x => x.id === btn.dataset.id));
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => editTender(filteredTenders.find(x => x.id === btn.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.onclick = () => deleteTender(btn.dataset.id);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTenders();
    });
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  async function deleteTender(id) {
    if (!confirm('¿Estás seguro de eliminar esta licitación?')) return;
    const { error } = await window.supabase.from('tenders').delete().eq('id', id);
    if (error) window.notificar?.(error.message, 'error');
    else {
      window.notificar?.('Licitación eliminada', 'success');
      loadTenders();
    }
  }

  function editTender(tender) {
    tenderIdInput.value = tender.id;
    tenderNameInput.value = tender.name;
    tenderDescInput.value = tender.description || '';
    reqContainer.innerHTML = '';
    if (tender.requirements && tender.requirements.length > 0) {
      tender.requirements.forEach(r => addReqInput(r));
    } else {
      addReqInput();
    }
    openModal(tenderModal);
  }

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = tenderIdInput.value;
    const name = tenderNameInput.value;
    const description = tenderDescInput.value;
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

    const { data: { user } } = await window.supabase.auth.getUser();

    let res;
    if (id) {
      res = await window.supabase.from('tenders').update({
        name, description, requirements: reqs
      }).eq('id', id);
    } else {
      res = await window.supabase.from('tenders').insert({
        name, description, requirements: reqs, user_id: user.id
      });
    }

    if (res.error) window.notificar?.(res.error.message, 'error');
    else {
      window.notificar?.('Cambios guardados correctamente', 'success');
      closeModal(tenderModal);
      loadTenders();
    }
  };

  // --- LÓGICA DE MATCHMAKING (CORE) ---

  async function runMatchmaking(tender) {
    $('#matchTitle').textContent = `Aptitud para: ${tender.name}`;
    matchBody.innerHTML = '<p style="padding:20px">Calculando compatibilidad...</p>';
    openModal(matchModal);

    try {
      // 1. Obtener todos los trabajadores
      const { data: workers, error: wErr } = await window.supabase.from('workers').select('*');
      if (wErr) throw wErr;

      // 2. Obtener TODAS las credenciales y exámenes (unificamos fuentes para máxima cobertura)
      const [
        { data: creds, error: cErr },
        { data: exams, error: eErr }
      ] = await Promise.all([
        window.supabase.from('worker_credentials').select('*'),
        window.supabase.from('medical_exam_records').select('*')
      ]);

      if (cErr) throw cErr;
      if (eErr) throw eErr;

      const normalize = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();

      const results = workers.map(w => {
        const wRutNormalized = normalize(w.rut);
        
        // Unificamos registros de ambas tablas que pertenezcan a este trabajador
        const myDocs = [
          ...(creds || []).filter(c => c.worker_id === w.id || normalize(c.rut) === wRutNormalized),
          ...(exams || []).filter(e => normalize(e.rut) === wRutNormalized)
        ];

        const missing = [];
        const expired = [];
        const today = new Date();

        tender.requirements.forEach(req => {
          const reqNorm = normalizeText(req);
          
          // Buscamos si tiene algún documento que coincida con el requerimiento (por nombre o tipo)
          const found = myDocs.find(d => {
            const nameNorm = normalizeText(d.credential_name);
            const typeNorm = normalizeText(d.exam_type);
            const catNorm = normalizeText(d.credential_category);
            return nameNorm.includes(reqNorm) || typeNorm.includes(reqNorm) || catNorm.includes(reqNorm);
          });

          if (!found) {
            missing.push(req);
          } else {
            // Verificar vigencia si tiene fecha de expiración
            if (found.expiry_date && new Date(found.expiry_date) < today) {
              expired.push(req);
            }
          }
        });

        const isApto = missing.length === 0 && expired.length === 0;

        return {
          worker: w,
          isApto,
          missing,
          expired
        };
      });

      // 3. Renderizar resultados
      matchBody.innerHTML = results.map(r => `
        <div class="t-row">
          <div class="t-col-name">
            <strong>${r.worker.full_name}</strong><br>
            <span style="font-size:11px; color:var(--muted)">${r.worker.rut}</span>
          </div>
          <div class="t-col-prof">
            <span class="badge ${r.isApto ? 'badge--success' : 'badge--danger'}">
              ${r.isApto ? 'APTO' : 'NO APTO'}
            </span>
          </div>
          <div class="t-col-status" style="font-size:12px;">
            ${r.isApto ? '<span style="color:var(--primary)">✓ Cumple todos los requisitos</span>' :
          (r.missing.length ? `<span style="color:#f87171">Faltan: ${r.missing.join(', ')}</span><br>` : '') +
          (r.expired.length ? `<span style="color:#fbbf24">Vencidos: ${r.expired.join(', ')}</span>` : '')
        }
          </div>
        </div>
      `).join('');

    } catch (err) {
      matchBody.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadTenders();
  });

})();
