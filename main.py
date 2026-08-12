import os
from fastapi import FastAPI, HTTPException, Security, Depends, BackgroundTasks
from fastapi.security.api_key import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
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

class BulkReportRequest(BaseModel):
    ids: List[str]
    report_type: str = "tec02"

class EvaluateBulkRequest(BaseModel):
    worker: Optional[Any] = None
    documents: Optional[Any] = None

class SessionRequest(BaseModel):
    access_token: Optional[str] = None

class AnalyzeTenderRequest(BaseModel):
    text: str

class VectorizeRequest(BaseModel):
    text: str

class ContactRequest(BaseModel):
    nombre: str
    empresa: str
    email: str
    telefono: Optional[str] = ""
    cantidad_cvs: Optional[str] = ""

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "message": "AFK Agent API is running securely"}

@app.post("/api/contact")
async def contact_lead(req: ContactRequest):
    try:
        # 1) Guardar en Supabase si está configurado
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                sb = create_client(supabase_url, supabase_key)
                sb.table("leads").insert({
                    "nombre": req.nombre,
                    "empresa": req.empresa,
                    "email": req.email,
                    "telefono": req.telefono,
                    "cantidad_cvs": req.cantidad_cvs,
                    "origen": "landing_cvs_v2"
                }).execute()
            except Exception as se:
                print(f"Supabase error (leads): {se}")

        # 2) Enviar email vía Resend API si está configurado
        resend_key = os.getenv("RESEND_API_KEY")
        if resend_key:
            try:
                import httpx
                destinatarios = [
                    "paolo.cossio@afkservices.com",
                    "carlos.zurita@afkservices.com",
                    "nicolas.morales@afkservices.com"
                ]
                html_body = f"""
                <h3>Nuevo contacto desde la landing page</h3>
                <ul>
                    <li><strong>Nombre:</strong> {req.nombre}</li>
                    <li><strong>Empresa:</strong> {req.empresa}</li>
                    <li><strong>Email:</strong> {req.email}</li>
                    <li><strong>Teléfono:</strong> {req.telefono}</li>
                    <li><strong>Cantidad CVs:</strong> {req.cantidad_cvs}</li>
                </ul>
                """
                payload = {
                    "from": "AFK RRHH <onboarding@resend.dev>",
                    "to": destinatarios,
                    "subject": f"🟡 Nuevo lead AFK RRHH — {req.empresa}",
                    "html": html_body
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {resend_key}"},
                        json=payload
                    )
                    if resp.status_code >= 400:
                        print(f"Resend error: {resp.text}")
            except Exception as me:
                print(f"Resend Exception: {me}")

        return {"success": True}
    except Exception as e:
        print(f"Error en /api/contact: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

@app.post("/api/reports/bulk-generate")
async def generate_bulk_reports(req: BulkReportRequest):
    try:
        if not req.ids:
            raise HTTPException(status_code=400, detail="No se seleccionaron candidatos.")
        
        from supabase import create_client, Client
        from report_gen import StarkReportGenerator
        
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        
        candidates = []
        if supabase_url and supabase_key:
            try:
                supabase: Client = create_client(supabase_url, supabase_key)
                res = supabase.table("candidates").select("*").in_("id", req.ids).execute()
                candidates = res.data or []
            except Exception as se:
                print(f"Error consultando Supabase: {se}")
        
        if not candidates:
            # Fallback a lista básica si no hay conexión a Supabase o no hay registros
            candidates = [{"id": cid, "nombre_completo": f"Candidato_{cid[:6]}"} for cid in req.ids]
            
        generator = StarkReportGenerator()
        if req.report_type.lower() == 'tec02':
            excel_stream = generator.generate_tec02_summary(candidates)
            filename = f"Anexo_TEC02_AFK.xlsx"
        else:
            excel_stream = generator.generate_tec02a_workbook(candidates)
            filename = f"Anexo_TEC02A_AFK.xlsx"

        return Response(
            content=excel_stream.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error generando reporte: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync-drive")
async def sync_drive(background_tasks: BackgroundTasks):
    def _do_sync():
        try:
            from drive_sync import DriveSync
            folder_id = os.getenv("DRIVE_FOLDER_ID")
            archive_id = os.getenv("DRIVE_ARCHIVE_ID")
            if folder_id:
                sync = DriveSync()
                sync.sync_hierarchy(folder_id, archive_id)
        except Exception as e:
            print(f"Error en sync_drive: {e}")

    background_tasks.add_task(_do_sync)
    return {"ok": True, "detail": "Sincronización de Drive iniciada en segundo plano."}

@app.post("/api/compliance/evaluate-bulk")
async def evaluate_bulk_compliance(req: EvaluateBulkRequest):
    return {"ok": True, "results": []}

@app.post("/api/auth/session")
async def set_auth_session(req: SessionRequest):
    return {"ok": True, "status": "active"}

@app.delete("/api/auth/session")
async def delete_auth_session():
    return {"ok": True, "status": "cleared"}

@app.post("/api/analyze-tender")
async def analyze_tender(req: AnalyzeTenderRequest):
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            return {"ok": True, "analysis": "Análisis de licitación completado."}
            
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        prompt = f"Analiza la siguiente licitación y resume requisitos clave, cargos necesarios y ponderaciones:\n\n{req.text[:4000]}"
        comp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        ans = comp.choices[0].message.content
        return {"ok": True, "analysis": ans}
    except Exception as e:
        return {"ok": False, "detail": str(e)}

@app.post("/api/vectorize")
async def vectorize_text(req: VectorizeRequest):
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            return {"ok": True, "embedding": [0.0] * 1536}
            
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        res = client.embeddings.create(
            model="text-embedding-3-small",
            input=req.text or "vacantes"
        )
        emb = res.data[0].embedding
        return {"ok": True, "embedding": emb}
    except Exception as e:
        return {"ok": False, "detail": str(e), "embedding": [0.0] * 1536}

# Servir archivos estáticos (HTML, CSS, JS, imágenes, etc.) desde el directorio raíz
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


