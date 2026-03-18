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
    // Buscar la barra lateral o el header para añadir el botón de logout
    const nav = document.querySelector('.nav');
    if (nav && !document.getElementById('btnLogout')) {
      // Inyectar Links adicionales
      if (!document.querySelector('a[href="tenders.html"]')) {
        const tendersLink = document.createElement('a');
        tendersLink.href = 'tenders.html';
        tendersLink.innerHTML = '<span class="label">Licitaciones</span>';
        nav.appendChild(tendersLink);
      }

      const adminLink = document.createElement('a');
      adminLink.href = 'admin.html';
      adminLink.innerHTML = '<span class="label">Administrar Clientes</span>';
      nav.appendChild(adminLink);

      const logoutBtn = document.createElement('a');
      logoutBtn.id = 'btnLogout';
      logoutBtn.href = '#';
      logoutBtn.style.marginTop = 'auto';
      logoutBtn.style.color = '#f87171'; // Un rojo suave
      logoutBtn.innerHTML = '<span class="label">Cerrar Sesión</span>';

      logoutBtn.onclick = async (e) => {
        e.preventDefault();
        const { error } = await window.supabase.auth.signOut();
        if (error) alert("Error cerrando sesión: " + error.message);
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
      await window.supabase.auth.signOut();
      window.location.href = 'login.html';
    },
    getSession: async () => {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session;
    }
  };
})();
