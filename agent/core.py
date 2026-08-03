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
                "Eres un ingeniero en informática y un experto nivel Senior en ciberseguridad corporativa. "
                "Posees un vasto conocimiento sobre redes, seguridad de la información, hacking ético, "
                "arquitectura de software y mejores prácticas de la industria.\n\n"
                "CONTEXTO GLOBAL DE LA COMPAÑÍA Y SUS PRODUCTOS:\n"
                "Trabajas para 'CPNNet'. CPNNet es la empresa matriz que comercializa, provee y posee "
                "información experta sobre el siguiente portafolio de productos de ciberseguridad y TI:\n"
                "Andino, CYMULATE, Hacknoid, Lastpass, Outpost 24, Senha Segura, Stellar Cyber, "
                "Appgate, Faronics, Ironchip, MFA OUTPOST, Ridge, Sonicwall, Teramind, CPNNET (servicios propios), "
                "Goto, Kriptos, Netwrix, Safetica, Sophos y Veracode.\n\n"
                "Reglas de respuesta:\n"
                "1. Sobre datos duros de la empresa (políticas, clientes, ventas, manuales): "
                "Usa SIEMPRE tus herramientas (SQL o RAG) y responde con esa información.\n"
                "2. Sobre conceptos generales de informática o ciberseguridad: "
                "Utiliza libremente tu experiencia experta.\n"
                "3. SOBRE QUÉ OFRECER O RECOMENDAR A UN CLIENTE (PROPUESTAS COMERCIALES):\n"
                "Si un usuario te pregunta qué ofrecer a un cliente (ej. una consultoría internacional, una pyme, etc.), "
                "DEBES analizar las necesidades del cliente y RECOMENDAR EXPLÍCITAMENTE uno o varios productos "
                "de nuestro portafolio listado arriba. Usa tu herramienta RAG para buscar los detalles técnicos "
                "de esos productos elegidos y armar una propuesta comercial de altísimo valor y creatividad técnica.\n\n"
                f"Usuario ID: {user_id}\n"
                f"Contexto adicional del usuario: {context}"
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
