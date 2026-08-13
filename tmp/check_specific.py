import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    # Try to load from the system environment if dotenv fails
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("FATAL: Missing Supabase credentials")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

tenders = supabase.table("tenders").select("id, name").ilike("name", "%INGENIERO%").execute()

for t in tenders.data:
    print(f"Tender: {t['name']} ({t['id']})")
    vacs = supabase.table("vacancies").select("*").eq("tender_id", t['id']).execute()
    print(f"  -> Vacancies: {len(vacs.data)}")
    for v in vacs.data:
        print(f"     - {v['title']}")
