import os
import sys
from supabase import create_client

# Force utf-8 output encoding for windows console
sys.stdout.reconfigure(encoding='utf-8')

url = "https://xqcyrjzocrglkkzmvdgm.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3lyanpvY3JnbGtrem12ZGdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4MzQzNSwiZXhwIjoyMDc5NjU5NDM1fQ.n-Qsb_a7fQIr9tPHbL0OskT-YS1ubzTMt8qzZnoG-tg"

supabase = create_client(url, key)

print("Conectado con éxito a:", url)

# Lista de tablas posibles a inspeccionar
tables = [
    "clientes", "usuarios", "users", "chats", "messages", "mensajes",
    "document_chunks", "documents", "documentos", "empresa", "empresas",
    "prompts", "settings", "config", "logs", "sessions"
]

found = {}
for t in tables:
    try:
        res = supabase.table(t).select("*", count="exact").limit(5).execute()
        count = res.count if res.count is not None else len(res.data)
        found[t] = {
            "count": count,
            "sample_keys": list(res.data[0].keys()) if res.data else []
        }
        print(f"✅ Tabla '{t}': {count} registros. Columnas: {found[t]['sample_keys']}")
    except Exception as e:
        err_msg = str(e)
        if "PGRST205" in err_msg:
            pass # No existe esta tabla
        else:
            print(f"⚠️ Tabla '{t}': error -> {err_msg}")

print("\n--- Tablas Encontradas ---")
for k, v in found.items():
    print(f"- {k}: {v['count']} filas. Campos: {v['sample_keys']}")
