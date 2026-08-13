import asyncio
import sys
import os
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

from agent.core import AgentManager

async def test_agent_cyber():
    print("🤖 Probando el Agente con la consulta exacta del screenshot...\n")
    agent = AgentManager()
    
    prompt = "¿Qué es escaneos personalizables para exponer vulnerabilidades como inyecciones SQL y scripting entre sitios?"
    
    print(f"👤 Pregunta del Usuario:\n{prompt}\n")
    print("⏳ Generando respuesta...\n")
    
    res = await agent.process_query(
        query=prompt,
        tenant_id="cpnnet",
        session_id="default_chat",
        user_id="internal_user",
        context={}
    )
    
    print("--- 💡 Respuesta del Agente CPNNet ---")
    print(res.get("answer", res))

if __name__ == "__main__":
    asyncio.run(test_agent_cyber())
