// supabase.js
(function () {
  const SUPABASE_URL = "https://pmdmvtykkhmvpfxuqjfm.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[supabase.js] SDK de Supabase no disponible");
    return;
  }

  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("[supabase.js] cliente inicializado");
})();