import os
import sys
import argparse
from typing import List
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def get_clients():
    url_a = os.getenv("SUPABASE_URL_A") or os.getenv("SUPABASE_URL")
    key_a = os.getenv("SUPABASE_SERVICE_ROLE_KEY_A") or os.getenv("SUPABASE_SERVICE_KEY_A") or os.getenv("SUPABASE_KEY")
    
    url_b = os.getenv("SUPABASE_URL_B")
    key_b = os.getenv("SUPABASE_SERVICE_ROLE_KEY_B") or os.getenv("SUPABASE_SERVICE_KEY_B")

    print("--- 🔍 Verificando Credenciales de Supabase ---")
    print(f"Origen (A): URL = {url_a or '❌ Faltante'}")
    print(f"Destino (B): URL = {url_b or '❌ Faltante'}")

    if not url_a or not key_a:
        print("\n❌ Error: Faltan credenciales del Proyecto Origen (A).")
        print("Configura SUPABASE_URL_A y SUPABASE_SERVICE_ROLE_KEY_A en tu .env")
        sys.exit(1)

    if not url_b or not key_b:
        print("\n❌ Error: Faltan credenciales del Proyecto Destino (B).")
        print("Configura SUPABASE_URL_B y SUPABASE_SERVICE_ROLE_KEY_B en tu .env")
        sys.exit(1)

    client_a = create_client(url_a, key_a)
    client_b = create_client(url_b, key_b)
    return client_a, client_b

def migrate_table(client_a: Client, client_b: Client, table_name: str, batch_size: int = 500):
    print(f"\n📦 ---- Migrando Tabla: '{table_name}' ----")
    try:
        # Obtener total de registros en el Origen
        count_res = client_a.table(table_name).select("*", count="exact").limit(1).execute()
        total_rows = count_res.count if count_res.count is not None else 0
        print(f"📊 Registros encontrados en Origen: {total_rows}")

        if total_rows == 0:
            print("⚠️ Tabla vacía en Origen. Saltando...")
            return

        # Migrar por lotes
        migrated = 0
        while migrated < total_rows:
            end = min(migrated + batch_size - 1, total_rows - 1)
            response = client_a.table(table_name).select("*").range(migrated, end).execute()
            data = response.data

            if not data:
                break

            # Insertar en Destino
            client_b.table(table_name).upsert(data).execute()
            migrated += len(data)
            print(f"  ➡️ Progreso: {migrated}/{total_rows} filas copiadas ({int(migrated/total_rows*100)}%)")

        print(f"✅ ¡Tabla '{table_name}' migrada exitosamente! ({migrated} filas en total)")
    except Exception as e:
        print(f"❌ Error migrando la tabla '{table_name}': {e}")
        print("💡 Nota: Asegúrate de haber creado la estructura/esquema de esta tabla en el proyecto destino.")

def main():
    parser = argparse.ArgumentParser(description="Script para migrar datos de un Proyecto de Supabase A a B")
    parser.add_argument(
        "--tables", "-t", 
        nargs="+", 
        default=["document_chunks", "documents", "candidates", "workers"], 
        help="Lista de nombres de tablas a migrar (separadas por espacio)"
    )
    parser.add_argument("--batch", "-b", type=int, default=500, help="Tamaño de lote para la transferencia")
    args = parser.parse_args()

    client_a, client_b = get_clients()

    print("\n🚀 Iniciando Migración entre Proyectos de Supabase...")
    for table in args.tables:
        migrate_table(client_a, client_b, table, batch_size=args.batch)

    print("\n🎉 ¡Proceso de migración finalizado!")

if __name__ == "__main__":
    main()
