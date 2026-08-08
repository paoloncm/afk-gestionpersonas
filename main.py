import os
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any
from agent.core import AgentManager

app = FastAPI(title="AFK Agent API", description="API para el Agente RAG + SQL Multitenant", version="2.0.0")

# --- SEGURIDAD: API Key ---
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    # Leemos la contraseña secreta de nuestro .env
    # Si no hay ninguna en .env, por seguridad el servidor bloquea todo hasta que se configure.
    expected_api_key = os.getenv("AGENT_API_KEY")
    
    if not expected_api_key:
        raise HTTPException(status_code=500, detail="El servidor no tiene configurada una AGENT_API_KEY")
        
    if api_key_header == expected_api_key:
        return api_key_header
        
    raise HTTPException(status_code=401, detail="API Key inválida o ausente")

# Instancia del manejador del agente
agent_manager = AgentManager()

class QueryRequest(BaseModel):
    query: str
    tenant_id: str = "cpnnet"        # Para aislar bases de datos de clientes
    session_id: str = "default_chat" # Para mantener la memoria de la conversación
    user_id: Optional[str] = "internal_user"
    context: Optional[Dict[str, Any]] = None

class QueryResponse(BaseModel):
    status: str
    data: Dict[str, Any]

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "message": "AFK Agent API is running securely"}

@app.post("/api/v1/agent/query", response_model=QueryResponse)
async def process_query(request: QueryRequest, api_key: str = Depends(get_api_key)):
    try:
        # Aquí delegamos la consulta al Agente LangChain
        response_data = await agent_manager.process_query(
            query=request.query,
            tenant_id=request.tenant_id,
            session_id=request.session_id,
            user_id=request.user_id,
            context=request.context if request.context else {}
        )
        
        return QueryResponse(status="success", data=response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Servir archivos estáticos (HTML, CSS, JS, imágenes, etc.) desde el directorio raíz
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

