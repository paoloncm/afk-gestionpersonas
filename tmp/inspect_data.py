
import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

print("--- EXAM RECORDS ---")
try:
    res = supabase.table("medical_exam_records").select("*").limit(3).execute()
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error fetching medical_exam_records: {e}")

print("\n--- WORKER RECORDS ---")
try:
    res = supabase.table("workers").select("id, full_name, imc, weight, height").limit(3).execute()
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error fetching workers: {e}")
