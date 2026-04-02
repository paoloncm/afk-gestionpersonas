// chat.js — cliente ligero para n8n (Webhook -> Respond to Webhook)

(() => {
  // Unificar a un único Chatbot Maestro (n8n Agent)
  const WEBHOOK_URL = 'https://primary-production-aa252.up.railway.app/webhook/a35e75ae-9003-493b-a00e-8edd8bd2b12a';
  const CHAT_API = window.AFK_CHAT_WEBHOOK || WEBHOOK_URL;

  const USE_BASIC_AUTH = false, BASIC_USER = 'user', BASIC_PASS = 'pass';
  const BEARER_TOKEN = '';
  const BOT_WELCOME = 'Hola 👋 Soy el asistente de AFK. ¿En qué te ayudo?';
  const TIMEOUT_MS = 180000; // 3 minutos como pidió el usuario
  const RETRIES = 1;

  const d = document;
  const drawer = d.getElementById('chatbot'),
    body = d.getElementById('chatBody'),
    input = d.getElementById('chatInput'),
    btnOpen = d.getElementById('btnChat'),
    btnOpen2 = d.getElementById('openChatbot'),
    btnClose = d.getElementById('closeChat'),
    btnSend = d.getElementById('chatSend');

  // Cargar Marked.js dinámicamente si no existe
  if (typeof marked === 'undefined') {
    const s = d.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    d.head.appendChild(s);
  }

  if (!drawer || !body || !input || !btnSend) return;

  let history = [];
  try {
    const saved = localStorage.getItem('afk_chat_history');
    if (saved) history = JSON.parse(saved);
  } catch (e) { }

  const sessionId =
    localStorage.getItem('afk_chat_session') ||
    (Date.now().toString(36) + Math.random().toString(36).slice(2));

  localStorage.setItem('afk_chat_session', sessionId);

  const append = (role, text) => {
    const m = d.createElement('div');
    m.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
    
    if (role === 'user') {
      m.textContent = text;
    } else {
      // Usar Marked si está disponible, si no, fallback a textContent
      if (typeof marked !== 'undefined') {
        m.innerHTML = marked.parse(text);
      } else {
        m.textContent = text;
      }
    }
    
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  };

  // Restaurar historial visualmente
  history.forEach(h => {
    // n8n responde a veces con assistant o bot, lo mapeamos visualmente
    append(h.role === 'user' ? 'user' : 'bot', h.content);
  });

  const typing = (on = true) => {
    let el = d.getElementById('afk-typing');
    if (on) {
      if (!el) {
        el = d.createElement('div');
        el.id = 'afk-typing';
        el.className = 'chat-msg bot';
        el.style.opacity = '.75';
        el.textContent = 'Escribiendo…';
        body.appendChild(el);
      }
    } else {
      el && el.remove();
    }
    body.scrollTop = body.scrollHeight;
  };

  function buildHeaders() {
    const h = {
      'Content-Type': 'application/json',
      'X-AFK-Secret': 'AFK_PRO_2024_SECURE_KEY' // Blindaje de seguridad
    };
    if (USE_BASIC_AUTH) h['Authorization'] = 'Basic ' + btoa(`${BASIC_USER}:${BASIC_PASS}`);
    if (BEARER_TOKEN) h['Authorization'] = 'Bearer ' + BEARER_TOKEN;
    return h;
  }

  // Normaliza cualquier respuesta de n8n
  function pickReply(data) {
    if (typeof data === 'string') return data;

    if (Array.isArray(data) && data.length) {
      const it = data[0];
      const j = it?.json || it?.data || it || {};
      return j.reply || j.output || j.message || j.text || '';
    }

    if (data && typeof data === 'object') {
      return data.reply || data.output || data.message || data.text || '';
    }

    return '';
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(id);
    }
  }

  async function callChatApi(payload) {
    let lastErr;
    for (let i = 0; i <= RETRIES; i++) {
      try {
        const res = await fetchWithTimeout(CHAT_API, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(payload),
        });

        const ct = res.headers.get('content-type') || '';
        const data = ct.includes('application/json')
          ? await res.json()
          : await res.text();

        return { ok: res.ok, status: res.status, data };
      } catch (e) {
        lastErr = e;
        if (i === RETRIES) throw e;
      }
    }
    throw lastErr;
  }

  const localReply = t =>
    /hola|buenas/i.test(t)
      ? '¡Hola! ¿Qué necesitas de RRHH hoy?'
      : 'Anotado ✅';

  async function send(callback) {
    const text = input.value.trim();
    if (!text) return;

    append('user', text);
    input.value = '';
    typing(true);

    // Extraer contexto visual de la pantalla (lo que el usuario está viendo)
    const scrapeScreen = () => {
      if (window.AFK_PAGE_CONTEXT) return window.AFK_PAGE_CONTEXT;
      const cards = Array.from(d.querySelectorAll('.card'));
      if (!cards.length) return '';
      // Unir los textos visibles y truncar a 2000 caracteres para no ocluir el ancho de banda del LLM
      const text = cards.map(c => c.innerText.replace(/\n+/g, ' ').trim()).join(' | ');
      return text.substring(0, 2000);
    };

    const payload = {
      message: text,
      history,
      sessionId,
      meta: {
        page: location.pathname,
        ts: Date.now(),
        screen_context: scrapeScreen()
      }
    };

    try {
      const { ok, status, data } = await callChatApi(payload);
      typing(false);

      if (!ok) {
        append('bot', `Error ${status}`);
        return;
      }

      const reply = pickReply(data) || '…';
      append('bot', reply);

      history.push(
        { role: 'user', content: text },
        { role: 'assistant', content: reply }
      );

      // Limitar historial a los últimos 10 mensajes (5 interacciones) para no sobrecargar n8n
      if (history.length > 10) {
        history = history.slice(-10);
      }

      localStorage.setItem('afk_chat_history', JSON.stringify(history));

      if (typeof callback === 'function') callback(reply);

    } catch (e) {
      console.error('[AFK/chat] Error:', e);
      typing(false);
      // Only show connection error if it's actually a network/logic error, 
      // not a callback type error we just fixed above.
      append('bot', 'No pude conectar con el servidor del chat.');
      if (typeof callback === 'function') callback('Error de conexión');
    }
  }

  window.afkChatSend = (text, callback) => {
    input.value = text;
    send(callback);
  };

  btnOpen && (btnOpen.onclick = () => {
    drawer.classList.add('is-open');
    setTimeout(() => input.focus(), 0);
  });

  btnOpen2 && (btnOpen2.onclick = e => {
    e.preventDefault();
    drawer.classList.add('is-open');
    setTimeout(() => input.focus(), 0);
  });

  btnClose && (btnClose.onclick = () => drawer.classList.remove('is-open'));

  btnSend.onclick = send;

  input.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  if (!history.length && !body.querySelector('.chat-msg')) {
    append('bot', BOT_WELCOME);
  }

  // Agregamos un botón para limpiar el chat sin borrar la memoria explícita (opcional)
  // Pero por ahora solo manejamos el borrado desde console.
})();
