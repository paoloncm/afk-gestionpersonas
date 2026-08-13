import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

url_b = "https://xuflwdcmyhopjnepinsq.supabase.co"
key_b = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Zmx3ZGNteWhvcGpuZXBpbnNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE2OTIxOCwiZXhwIjoyMTAxNzQ1MjE4fQ.dqZKDLt4FkcBL5vW734WQm3DsFHpqoLZX1vBc85bZyQ"

supabase = create_client(url_b, key_b)

print("🔍 Probando tablas de CPNNet en Destino...")

tables = ["document_chunks", "documents", "cpnnet_docs", "cpnnet"]
for t in tables:
    try:
        res = supabase.table(t).select("*", count="exact").limit(1).execute()
        print(f"✅ Tabla '{t}': existe ({res.count} filas)")
    except Exception as e:
        print(f"❌ Tabla '{t}': no existe aún ({e})")
