from langchain.tools import tool
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing Supabase URL or Key in .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

@tool
def get_company_sql_data(query: str) -> str:
    """
    Útil para consultar información ESTRUCTURADA de la empresa, como ventas, usuarios, clientes o registros de base de datos.
    Usa esta herramienta cuando necesites buscar datos exactos en la base de datos SQL.
    """
    # En producción, aquí puedes usar langchain SQLDatabase chain
    # o hacer peticiones específicas a Supabase usando el cliente REST.
    try:
        # client = get_supabase_client()
        # Simulación de respuesta
        return f"Resultados estructurados de DB para la consulta: {query} (Por conectar a tablas reales)"
    except Exception as e:
        return f"Error consultando SQL: {str(e)}"
