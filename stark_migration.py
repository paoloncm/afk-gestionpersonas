import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def migrate():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ Error: Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")
        return

    supabase = create_client(url, key)
    
    print("🚀 Iniciando migración de columnas 'Stark Insight'...")
    
    # Intentar agregar las columnas vía RPC si está habilitado, 
    # o simplemente informar si fallan las inserciones después.
    # Nota: La mayoría de las veces Postgres vía cliente no permite ALTER TABLE directo 
    # a menos que haya una función rpc específica. 
    # Pero podemos verificar si las columnas existen intentando un select.
    
    try:
        test = supabase.table("candidates").select("experiencia_detallada, certificaciones_y_examenes, maquinaria_y_herramientas, experiencia_tec_master").limit(1).execute()
        print("✅ Las columnas tácticas Stark v3 ya existen en la tabla 'candidates'.")
    except Exception as e:
        print("⚠️ Faltan columnas críticas en la base de datos.")
        print("💡 Por favor, ejecuta este SQL en tu panel de Supabase (SQL Editor):")
        print("\nALTER TABLE candidates \nADD COLUMN IF NOT EXISTS experiencia_detallada JSONB, \nADD COLUMN IF NOT EXISTS certificaciones_y_examenes JSONB, \nADD COLUMN IF NOT EXISTS maquinaria_y_herramientas TEXT, \nADD COLUMN IF NOT EXISTS experiencia_tec_master TEXT;\n")

if __name__ == "__main__":
    migrate()
