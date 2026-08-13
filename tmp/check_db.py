import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("Missing env vars")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

# Get tenders
tenders = supabase.table("tenders").select("id, name").execute()
print(f"Total Tenders: {len(tenders.data)}")

# Get vacancies
vacancies = supabase.table("vacancies").select("*").execute()
print(f"Total Vacancies: {len(vacancies.data)}")

# Print which tenders have vacancies
t_with_v = {}
for v in vacancies.data:
    tid = v.get('tender_id')
    t_with_v[tid] = t_with_v.get(tid, 0) + 1

for t in tenders.data:
    count = t_with_v.get(t['id'], 0)
    print(f"Tender: {t['name']} - Vacancies: {count}")

