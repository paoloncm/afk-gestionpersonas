import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url_a = "https://xqcyrjzocrglkkzmvdgm.supabase.co/rest/v1/"
key_a = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3lyanpvY3JnbGtrem12ZGdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4MzQzNSwiZXhwIjoyMDc5NjU5NDM1fQ.n-Qsb_a7fQIr9tPHbL0OskT-YS1ubzTMt8qzZnoG-tg"

url_b = "https://xuflwdcmyhopjnepinsq.supabase.co/rest/v1/"
key_b = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Zmx3ZGNteWhvcGpuZXBpbnNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE2OTIxOCwiZXhwIjoyMTAxNzQ1MjE4fQ.dqZKDLt4FkcBL5vW734WQm3DsFHpqoLZX1vBc85bZyQ"

headers_a = {"apikey": key_a, "Authorization": f"Bearer {key_a}"}
headers_b = {"apikey": key_b, "Authorization": f"Bearer {key_b}"}

print("--- Insponiendo Origen (A) ---")
res_a = requests.get(url_a, headers=headers_a)
spec_a = res_a.json() if res_a.status_code == 200 else {}
tables_a = list(spec_a.get("definitions", {}).keys())
print(f"Tablas en Origen (A): {tables_a}")

print("\n--- Insponiendo Destino (B) ---")
res_b = requests.get(url_b, headers=headers_b)
spec_b = res_b.json() if res_b.status_code == 200 else {}
tables_b = list(spec_b.get("definitions", {}).keys())
print(f"Tablas en Destino (B): {tables_b}")

for table in tables_a:
    if table in spec_a.get("definitions", {}):
        schema_info = spec_a["definitions"][table]
        props = schema_info.get("properties", {})
        print(f"\nEsquema de tabla '{table}' en A:")
        for prop_name, prop_val in props.items():
            print(f"  - {prop_name}: {prop_val.get('type', 'unknown')} ({prop_val.get('format', '')})")
