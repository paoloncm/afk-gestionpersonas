import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://xqcyrjzocrglkkzmvdgm.supabase.co/rest/v1/clientes?select=*"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3lyanpvY3JnbGtrem12ZGdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4MzQzNSwiZXhwIjoyMDc5NjU5NDM1fQ.n-Qsb_a7fQIr9tPHbL0OskT-YS1ubzTMt8qzZnoG-tg"

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Range": "0-9",
    "Prefer": "count=exact"
}

res = requests.get(url, headers=headers)
print("Status:", res.status_code)
print("Content-Range:", res.headers.get("Content-Range"))
print("Rows fetched:", len(res.json()))
if res.json():
    print("Sample row:", json.dumps(res.json()[0], indent=2))
