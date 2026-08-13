import asyncio
import sys
import os
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

from agent.core import AgentManager

async def test_agent():
    print("🤖 Probando el Agente Asesor de Ventas CPNNet...\n")
    agent = AgentManager()
    
    prompt = (
        "Hola, tengo un cliente del sector financiero que necesita proteger sus aplicaciones web, "
        "prevenir la fuga de datos confidenciales y monitorear el comportamiento de usuarios internos. "
        "¿Qué productos de nuestro portafolio de CPNNet me recomiendas ofrecerle y qué beneficios clave tiene cada uno?"
    )
    
    print(f"👤 Pregunta del Usuario:\n{prompt}\n")
    print("⏳ Generando respuesta con RAG + GPT-4o...\n")
    
    res = await agent.process_query(
        query=prompt,
        tenant_id="cpnnet",
        session_id="test_session_1",
        user_id="ejecutivo_ventas",
        context={"sector": "Financiero", "tipo_cliente": "Banco Mediano"}
    )
    
    print("--- 💡 Respuesta del Asesor de Ventas CPNNet ---")
    print(res.get("answer", res))

if __name__ == "__main__":
    asyncio.run(test_agent())
