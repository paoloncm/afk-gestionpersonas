// auth.js - Gestión de Sesiones y Autenticación con Supabase
(function () {
  async function checkSession() {
    const isLoginPage = window.location.pathname.endsWith('login.html');

    // Robust check for Supabase initialization
    if (!window.supabase || typeof window.supabase.auth === 'undefined') {
      console.warn("[auth.js] Supabase client not ready, retrying...");
      setTimeout(checkSession, 500);
      return;
    }

    try {
      const { data: { session }, error } = await window.supabase.auth.getSession();
      if (error) throw error;

      if (!session && !isLoginPage) {
        console.log("[auth.js] No hay sesión activa. Redirigiendo a login.");
        window.location.href = 'login.html';
      } else if (session && isLoginPage) {
        console.log("[auth.js] Sesión activa detectada en login. Redirigiendo a dashboard.");
        window.location.href = 'index.html';
      }

      if (session) {
        setupLogoutButton();
      }
    } catch (err) {
      console.error("[auth.js] Error verificando sesión:", err);
    }
  }

  function setupLogoutButton() {
    const nav = document.querySelector('.nav');
    if (nav && !document.getElementById('btnLogout')) {
      if (!document.getElementById('navConfig')) {
        const cat = document.createElement('div');
        cat.id = 'navConfig';
        cat.className = 'nav-category';
        cat.style.marginTop = '20px';
        cat.textContent = 'Configuración';
        nav.appendChild(cat);

        const tendersLink = document.createElement('a');
        tendersLink.href = 'tenders.html';
        if (window.location.pathname.endsWith('tenders.html')) tendersLink.className = 'is-active';
        tendersLink.innerHTML = '<span class="label">Licitaciones</span>';
        nav.appendChild(tendersLink);
      }

      const logoutBtn = document.createElement('a');
      logoutBtn.id = 'btnLogout';
      logoutBtn.href = '#';
      logoutBtn.style.marginTop = 'auto';
      logoutBtn.style.paddingTop = '20px';
      logoutBtn.style.color = '#f87171';
      logoutBtn.innerHTML = '<span class="label">Cerrar Sesión</span>';

      logoutBtn.onclick = async (e) => {
        e.preventDefault();
        localStorage.removeItem('afk_chat_history');
        localStorage.removeItem('afk_chat_session');
        await window.supabase.auth.signOut();
        window.location.href = 'login.html';
      };
      nav.appendChild(logoutBtn);
    }
  }

  document.addEventListener('DOMContentLoaded', checkSession);

  window.authApp = {
    signOut: async () => {
      localStorage.removeItem('afk_chat_history');
      localStorage.removeItem('afk_chat_session');
      await window.supabase.auth.signOut();
      window.location.href = 'login.html';
    },
    getSession: async () => {
      if (!window.supabase) return null;
      const { data: { session } } = await window.supabase.auth.getSession();
      return session;
    }
  };
})();
