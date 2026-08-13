import sys
import os
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

url_b = "https://xuflwdcmyhopjnepinsq.supabase.co"
key_b = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Zmx3ZGNteWhvcGpuZXBpbnNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE2OTIxOCwiZXhwIjoyMTAxNzQ1MjE4fQ.dqZKDLt4FkcBL5vW734WQm3DsFHpqoLZX1vBc85bZyQ"

sb = create_client(url_b, key_b)
try:
    res = sb.table("document_chunks").select("id", count="exact").limit(1).execute()
    print(f"Total fragmentos (chunks) en Supabase: {res.count}")
except Exception as e:
    print("Error consultando Supabase:", e)
