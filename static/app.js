// ======================
// AFK RRHH — APP.JS CORE
// ======================

// --- Supabase Setup ---
const SUPABASE_URL = 'https://edqebyrdhmoukwqwzwdi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aY_VTNF5EDMs_yzO79bpOQ_FHK0TAqY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Helpers ---
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// --- Router Setup ---
const routes = {
  dashboard: renderDashboard,
  candidates: renderCandidates,
  alerts: renderAlerts,
  reports: renderReports,
};

// --- SPA Shell Init ---
function initShellBehaviors() {
  const drawer = $('#chatbot');
  const chatBody = $('#chatBody');
  const chatInput = $('#chatInput');

  $('#btnChat')?.addEventListener('click', () => {
    drawer.classList.add('is-open');
    chatInput?.focus();
  });
  $('#closeChat')?.addEventListener('click', () => {
    drawer.classList.remove('is-open');
  });

  $('#chatSend')?.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if (!msg) return;
    addMsg(msg, 'user');
    chatInput.value = '';
    mockReply(msg);
  });

  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#chatSend').click();
  });

  function addMsg(text, who = 'user') {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + who;
    el.textContent = text;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function mockReply(q) {
    const t = q.toLowerCase();
    const r = t.includes('reporte') ? 'Puedes generar reportes desde la pestaña Reportes.'
      : t.includes('documento') ? 'En la sección Dashboard puedes subir documentos.'
      : 'Procesando tu solicitud...';
    setTimeout(() => addMsg(r, 'bot'), 500);
  }

  // Navegación SPA
  $$('#nav a[data-route]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.route);
    });
  });
}

// --- Routing logic ---
function navigate(route = 'dashboard') {
  const view = routes[route] || routes.dashboard;
  $('#app').innerHTML = '';
  $('#app').innerHTML = view();
  setActive(route);
  afterRender(route);
}

function setActive(route) {
  $$('#nav a').forEach(a => a.classList.remove('is-active'));
  $(`#nav a[data-route="${route}"]`)?.classList.add('is-active');
}

function afterRender(route) {
  if (route === 'dashboard') initUploader();
  if (route === 'reports') bindRangeShortcuts();
}

// --- CANDIDATES Connected to Supabase ---
async function renderCandidates() {
  const { data, error } = await supabase.from('candidatos').select('*');
  if (error) {
    console.error('Error al cargar candidatos:', error);
    return `<section><h1>Candidates</h1><p>Error al conectar con la base de datos.</p></section>`;
  }

  return `
    <section>
      <h1 class="h1">Candidates</h1>
      <div class="card"><div class="table">
        <div class="t-head"><div>Name</div><div>Position</div><div>Source</div><div>Status</div><div>Date</div></div>
        ${data.map(r => `
          <div class="t-row">
            <div class="emp">
              <img class="avatar" src="https://i.pravatar.cc/48?u=${r.nombre}" alt="">
              <div><div class="emp__name">${r.nombre}</div><div class="muted">${r.cargo || ''}</div></div>
            </div>
            <div>${r.cargo}</div>
            <div>${r.fuente || '—'}</div>
            <div><span class="badge badge--${r.estado?.toLowerCase()}">${r.estado}</span></div>
            <div>${new Date(r.fecha).toLocaleDateString()}</div>
          </div>
        `).join('')}
      </div></div>
    </section>
  `;
}

// --- Enviar a n8n ---
async function enviarAFlujoN8N(candidato) {
  const resp = await fetch("https://primary-production-29c40.up.railway.app/webhook/afk-preuba-rrhh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(candidato)
  });

  if (!resp.ok) {
    console.error("Error al enviar datos a n8n");
  } else {
    const res = await resp.json();
    console.log("Respuesta de n8n:", res);
  }
}

// --- Cargar al iniciar ---
initShellBehaviors();
navigate(location.hash.replace('#', '') || 'dashboard');
window.addEventListener('hashchange', () => navigate(location.hash.replace('#', '')));
