import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://xqcyrjzocrglkkzmvdgm.supabase.co/rest/v1/"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3lyanpvY3JnbGtrem12ZGdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4MzQzNSwiZXhwIjoyMDc5NjU5NDM1fQ.n-Qsb_a7fQIr9tPHbL0OskT-YS1ubzTMt8qzZnoG-tg"

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

res = requests.get(url, headers=headers)
if res.status_code == 200:
    spec = res.json()
    definitions = spec.get("definitions", {})
    print(f"Total tablas encontradas en OpenAPI spec: {len(definitions)}")
    for name, schema in definitions.items():
        props = list(schema.get("properties", {}).keys())
        print(f"\n📌 Tabla: {name}")
        print(f"   Campos: {props}")
else:
    print(f"Error {res.status_code}: {res.text}")
