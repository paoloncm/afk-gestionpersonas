// tenders.supabase.js - Lógica para gestión de licitaciones y evaluación de trabajadores

(function () {
  const $ = (s) => document.querySelector(s);
  const tendersList = $('#tendersList');
  const tenderModal = $('#tenderModal');
  const tenderForm = $('#tenderForm');
  const reqContainer = $('#reqContainer');
  const matchModal = $('#matchModal');
  const matchBody = $('#matchBody');

  // --- GESTIÓN DE INTERFAZ ---

  function openModal(m) { m.classList.add('is-open'); }
  function closeModal(m) { m.classList.remove('is-open'); }

  document.querySelectorAll('.close-modal').forEach(b => {
    b.onclick = () => { closeModal(tenderModal); closeModal(matchModal); };
  });

  $('#btnNewTender').onclick = () => {
    tenderForm.reset();
    reqContainer.innerHTML = '';
    addReqInput(); // Al menos uno
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

  // --- LÓGICA DE BASE DE DATOS ---

  async function loadTenders() {
    const { data, error } = await window.supabase
      .from('tenders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      tendersList.innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      tendersList.innerHTML = '<p class="text-muted">No has creado ninguna licitación todavía.</p>';
      return;
    }

    tendersList.innerHTML = data.map(t => `
      <div class="card tender-card" data-id="${t.id}">
        <div class="card__head">
          <strong style="font-size:1.1rem">${t.name}</strong>
        </div>
        <div class="card__body">
          <p style="font-size:13px; color:var(--muted); margin-bottom:12px;">${t.description || 'Sin descripción'}</p>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:16px;">
            ${t.requirements.map(r => `<span class="badge" style="background:rgba(255,255,255,0.1)">${r}</span>`).join('')}
          </div>
          <button class="btn btn--primary btn-match" data-id="${t.id}" style="width:100%">Ver Candidatos Aptos</button>
        </div>
      </div>
    `).join('');

    // Eventos de Matchmaking
    document.querySelectorAll('.btn-match').forEach(btn => {
      btn.onclick = () => runMatchmaking(data.find(x => x.id === btn.dataset.id));
    });
  }

  tenderForm.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(tenderForm);
    const reqs = Array.from(document.querySelectorAll('.req-input')).map(i => i.value.trim()).filter(v => v);

    const { data: { user } } = await window.supabase.auth.getUser();

    const { error } = await window.supabase.from('tenders').insert({
      name: formData.get('name'),
      description: formData.get('description'),
      requirements: reqs,
      user_id: user.id
    });

    if (error) alert(error.message);
    else {
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
          const reqLower = req.toLowerCase().trim();
          
          // Buscamos si tiene algún documento que coincida con el requerimiento (por nombre o tipo)
          const found = myDocs.find(d => {
            const nameMatch = (d.credential_name || "").toLowerCase().includes(reqLower);
            const typeMatch = (d.exam_type || "").toLowerCase().includes(reqLower);
            const categoryMatch = (d.credential_category || "").toLowerCase().includes(reqLower);
            return nameMatch || typeMatch || categoryMatch;
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
