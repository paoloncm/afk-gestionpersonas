import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url_a = "https://xqcyrjzocrglkkzmvdgm.supabase.co/rest/v1/clientes?select=*"
key_a = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3lyanpvY3JnbGtrem12ZGdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4MzQzNSwiZXhwIjoyMDc5NjU5NDM1fQ.n-Qsb_a7fQIr9tPHbL0OskT-YS1ubzTMt8qzZnoG-tg"

headers_a = {
    "apikey": key_a,
    "Authorization": f"Bearer {key_a}",
    "Prefer": "count=exact"
}

res = requests.get(url_a, headers=headers_a)
print("Status Code:", res.status_code)
print("Content-Range:", res.headers.get("Content-Range"))
data = res.json()
print("Count of rows fetched:", len(data))
if data:
    print("\nEjemplo de fila [0]:")
    print(json.dumps(data[0], indent=2, ensure_ascii=False))
