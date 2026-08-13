import os
import sys
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
print("OPENAI_API_KEY configurada:", "SI" if openai_key else "NO")

url_b = "https://xuflwdcmyhopjnepinsq.supabase.co"
key_b = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Zmx3ZGNteWhvcGpuZXBpbnNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE2OTIxOCwiZXhwIjoyMTAxNzQ1MjE4fQ.dqZKDLt4FkcBL5vW734WQm3DsFHpqoLZX1vBc85bZyQ"

from supabase import create_client
sb = create_client(url_b, key_b)

try:
    res = sb.table("document_chunks").select("id").limit(1).execute()
    print("Tabla 'document_chunks' en Supabase Destino existe y esta lista.")
except Exception as e:
    print("Tabla 'document_chunks' aun no existe en el nuevo Supabase:", e)
