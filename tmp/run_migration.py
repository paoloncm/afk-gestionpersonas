import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

url_a = "https://xqcyrjzocrglkkzmvdgm.supabase.co"
key_a = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3lyanpvY3JnbGtrem12ZGdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4MzQzNSwiZXhwIjoyMDc5NjU5NDM1fQ.n-Qsb_a7fQIr9tPHbL0OskT-YS1ubzTMt8qzZnoG-tg"

url_b = "https://xuflwdcmyhopjnepinsq.supabase.co"
key_b = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Zmx3ZGNteWhvcGpuZXBpbnNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE2OTIxOCwiZXhwIjoyMTAxNzQ1MjE4fQ.dqZKDLt4FkcBL5vW734WQm3DsFHpqoLZX1vBc85bZyQ"

print("🔍 Conectando a Supabase Origen y Destino...")
client_a = create_client(url_a, key_a)
client_b = create_client(url_b, key_b)

table_name = "clientes"

# 1. Verificar existencia en Destino
try:
    check_b = client_b.table(table_name).select("*", count="exact").limit(1).execute()
    print(f"✅ Tabla '{table_name}' detectada en el Destino. Filas actuales en Destino: {check_b.count}")
except Exception as e:
    print(f"❌ Error al consultar la tabla '{table_name}' en Destino: {e}")
    sys.exit(1)

# 2. Leer filas de Origen
try:
    res_a = client_a.table(table_name).select("*", count="exact").execute()
    data_a = res_a.data
    total_a = res_a.count if res_a.count is not None else len(data_a)
    print(f"📊 Registros encontrados en Origen ({url_a}): {total_a}")
    
    if total_a == 0:
        print("ℹ️ La tabla de origen está vacía. Estructura verificada y lista para recibir datos.")
    else:
        # 3. Migrar por lotes
        batch_size = 500
        migrated = 0
        while migrated < total_a:
            batch = data_a[migrated:migrated + batch_size]
            client_b.table(table_name).upsert(batch).execute()
            migrated += len(batch)
            print(f"  ➡️ {migrated}/{total_a} registros transferidos...")
        
        print(f"🎉 ¡Migración completada con éxito! {migrated} filas copiadas.")

    # 4. Verificación final
    check_b_final = client_b.table(table_name).select("*", count="exact").execute()
    print(f"🏆 Verificación final en Destino: {check_b_final.count} filas en 'clientes'.")

except Exception as e:
    print(f"❌ Error durante la migración: {e}")
