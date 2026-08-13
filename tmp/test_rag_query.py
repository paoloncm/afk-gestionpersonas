import sys
import os
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

from database.vector_tools import get_company_rag_data, tenant_context_var

# Set context tenant_id to cpnnet
tenant_context_var.set("cpnnet")

query = "Qué soluciones ofrece Sonicwall y Sophos para ciberseguridad?"
print(f"❓ Consulta RAG de prueba: '{query}'")

res = get_company_rag_data.invoke({"query": query})
print("\n--- Respuesta de la Búsqueda Vectorial (RAG) ---")
print(res)
