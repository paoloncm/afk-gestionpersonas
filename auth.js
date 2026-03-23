// auth.js - Gestión de Sesiones y Autenticación con Supabase

(function () {
  /**
   * Verifica si hay una sesión activa.
   * Si no la hay y estamos en una página protegida, redirige al login.
   */
  async function checkSession() {
    const isLoginPage = window.location.pathname.endsWith('login.html');

    // Esperar a que el cliente de Supabase esté disponible
    if (!window.supabase) {
      console.error("[auth.js] Supabase client not found");
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

      // Si hay sesión, podemos inyectar un botón de Cerrar Sesión si no existe
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
      
      // 1. Crear categoría de Configuración si no existe
      if (!document.getElementById('navConfig')) {
        const cat = document.createElement('div');
        cat.id = 'navConfig';
        cat.className = 'nav-category';
        cat.style.marginTop = '20px';
        cat.textContent = 'Configuración';
        nav.appendChild(cat);

        // Link de Licitaciones
        const tendersLink = document.createElement('a');
        tendersLink.href = 'tenders.html';
        if (window.location.pathname.endsWith('tenders.html')) tendersLink.className = 'is-active';
        tendersLink.innerHTML = '<span class="label">Licitaciones</span>';
        nav.appendChild(tendersLink);

      }

      // 2. Botón de Cerrar Sesión (al final)
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

  // Ejecutar verificación de sesión inmediatamente
  document.addEventListener('DOMContentLoaded', checkSession);

  // Exponer funciones útiles globalmente
  window.authApp = {
    signOut: async () => {
      localStorage.removeItem('afk_chat_history');
      localStorage.removeItem('afk_chat_session');
      await window.supabase.auth.signOut();
      window.location.href = 'login.html';
    },
    getSession: async () => {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session;
    }
  };
})();
