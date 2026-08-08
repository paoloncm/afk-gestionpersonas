import os
from typing import Dict, Any
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import SystemMessage, HumanMessage
from database.sql_tools import get_company_sql_data
from database.vector_tools import get_company_rag_data, tenant_context_var

load_dotenv()

class AgentManager:
    def __init__(self):
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            print("WARNING: OPENAI_API_KEY no encontrada en .env. Usando clave de prueba temporal.")
            openai_api_key = "sk-dummy" # Esto permite que el servidor arranque, pero fallará al hacer la petición
            
        self.llm = ChatOpenAI(
            temperature=0,
            model="gpt-4o",
            api_key=openai_api_key
        )
        
        # Registramos las herramientas que el agente puede usar
        self.tools = [
            get_company_sql_data,
            get_company_rag_data
        ]
        
        # Inicializamos el agente moderno usando LangGraph (estándar actual)
        self.agent = create_react_agent(self.llm, tools=self.tools)

    async def process_query(self, query: str, tenant_id: str, session_id: str, user_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa la consulta usando el agente, pasándole el contexto y las herramientas.
        """
        try:
            # Setear el tenant_id en la variable de contexto para que las herramientas (SQL/RAG) puedan leerlo
            tenant_context_var.set(tenant_id)
            
            # Preparamos el contexto y la consulta
            sys_prompt = (
                "Eres un Consultor Senior de Ciberseguridad y Asesor Comercial Experto de CPNNet.\n\n"
                "CONTEXTO GLOBAL DE LA COMPAÑÍA Y SUS PRODUCTOS:\n"
                "Trabajas para 'CPNNet'. CPNNet comercializa y provee el siguiente portafolio de soluciones corporativas:\n"
                "Andino, CYMULATE, Hacknoid, Lastpass, Outpost 24, Senha Segura, Stellar Cyber, "
                "Appgate, Faronics, Ironchip, MFA OUTPOST, Ridge, Sonicwall, Teramind, CPNNET (servicios propios), "
                "Goto, Kriptos, Netwrix, Safetica, Sophos y Veracode.\n\n"
                "REGLAS Y DIRECTRICES DE RESPUESTA:\n"
                "1. PREGUNTAS TÉCNICAS Y CONCEPTUALES DE CIBERSEGURIDAD:\n"
                "   Si el usuario pregunta sobre un concepto técnico o tipo de vulnerabilidad (ej. escaneos de vulnerabilidades, "
                "   inyección SQL, XSS, ransomware, DLP, DAST, SAST, Zero Trust, etc.):\n"
                "   a) Explica el concepto de forma clara, profesional y experta.\n"
                "   b) DEBES conectar siempre esa explicación con las soluciones de CPNNet que resuelven ese problema "
                "      (ej. asociar escaneos de vulnerabilidades/SQLi/XSS con Veracode, Hacknoid o Outpost 24).\n"
                "   c) Utiliza tu herramienta RAG ('get_company_rag_data') para buscar detalles específicos del producto recomendado.\n\n"
                "2. CONSULTAS COMERCIALES Y PROPUESTAS:\n"
                "   Analiza las necesidades del cliente y recomienda uno o varios productos de CPNNet utilizando la herramienta RAG.\n\n"
                "3. RESTRICCIÓN DE DOMINIO:\n"
                "   Solo debes declinar la consulta si la pregunta no tiene NINGUNA relación con tecnología, informática, "
                "   ciberseguridad o el portafolio de CPNNet (ej. recetas de cocina, deportes, entretenimiento no tecnológico).\n\n"
                f"Usuario ID: {user_id}\n"
                f"Contexto adicional: {context}"
            )
            
            sys_msg = SystemMessage(content=sys_prompt)
            user_msg = HumanMessage(content=query)
            
            # Invocamos al agente
            response = self.agent.invoke({"messages": [sys_msg, user_msg]})
            
            # El último mensaje es la respuesta de la IA
            answer = response["messages"][-1].content
            
            return {
                "answer": answer,
                "sources": [
                    {"type": "agent", "note": "Agente basado en LangGraph"}
                ]
            }
        except Exception as e:
            return {
                "answer": "Ocurrió un error al procesar tu solicitud.",
                "error": str(e)
            }
