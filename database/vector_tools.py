from langchain.tools import tool
import os
import contextvars
from langchain.tools import tool
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Variable de contexto para almacenar el tenant_id de forma segura por petición
tenant_context_var = contextvars.ContextVar("tenant_id", default="cpnnet")

@tool
def get_company_rag_data(query: str) -> str:
    """
    Útil para consultar CUALQUIER información interna de la empresa, servicios ofrecidos (como CPNNet), 
    productos, manuales, políticas corporativas o procedimientos (RAG).
    Usa esta herramienta SIEMPRE que te pregunten sobre qué hace la empresa, qué ofrecer a clientes, o reglas internas.
    """
    try:
        from langchain_openai import OpenAIEmbeddings
        
        # Leer el tenant_id actual del contexto de la petición
        current_tenant = tenant_context_var.get()
        
        # 1. Generar el vector de la pregunta
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        query_vector = embeddings.embed_query(query)
        
        # 2. Conectar a Supabase
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # 3. Buscar en la base de datos usando la función RPC (ahora con filtro por tenant)
        response = client.rpc(
            "match_documents", 
            {
                "query_embedding": query_vector, 
                "match_threshold": 0.70, 
                "match_count": 5,
                "p_tenant_id": current_tenant
            }
        ).execute()
        
        resultados = response.data
        if not resultados:
            return "No se encontró información relevante en los documentos de la empresa."
            
        # 4. Formatear la respuesta para el agente
        texto_final = "Información encontrada en los documentos de la empresa:\n\n"
        for idx, res in enumerate(resultados):
            texto_final += f"--- Documento {idx+1} ---\n{res['content']}\n\n"
            
        return texto_final
    except Exception as e:
        return f"Error consultando RAG: {str(e)}"
