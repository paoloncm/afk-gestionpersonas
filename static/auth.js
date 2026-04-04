/**
 * auth.js - STARK ENTERPRISE GATEKEEPER BRIDGE
 * Sincronización de Sesión Supabase LocalStorage -> Backend HttpOnly Cookie
 */

async function setBackendSession(session) {
  if (!session || !session.access_token) return;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: session.access_token })
    });
    const data = await res.json();
    if (data.ok) console.log("[STARK-GATEKEEPER] Sesión sincronizada con éxito.");
  } catch (err) {
    console.error("[STARK-GATEKEEPER] Error al sincronizar sesión:", err);
  }
}

async function clearBackendSession() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
    console.log("[STARK-GATEKEEPER] Sesión purgada de forma segura.");
  } catch (err) {
    console.error("[STARK-GATEKEEPER] Error al purgar sesión:", err);
  }
}

// Escuchar cambios de estado en Supabase
if (window.supabase) {
  window.supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`[STARK-GATEKEEPER] Evento de sesión: ${event}`);
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await setBackendSession(session);
    } else if (event === 'SIGNED_OUT') {
      await clearBackendSession();
    }
  });

  // Sincronización proactiva inicial
  window.supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) setBackendSession(session);
  });
}
