import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

# Configuración de Supabase Destino (CPNNet)
SUPABASE_URL = os.getenv("SUPABASE_URL_B", "https://xuflwdcmyhopjnepinsq.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY_B", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Zmx3ZGNteWhvcGpuZXBpbnNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjE2OTIxOCwiZXhwIjoyMTAxNzQ1MjE4fQ.dqZKDLt4FkcBL5vW734WQm3DsFHpqoLZX1vBc85bZyQ")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

SOURCE_FOLDER = r"C:\Users\Paolo\Downloads\CPNNET SECURITY-20260611T050709Z-3-001\CPNNET SECURITY"

def run_ingest(api_key: str = None):
    key_to_use = api_key or OPENAI_API_KEY
    if not key_to_use:
        print("❌ Error: Se requiere una OPENAI_API_KEY para generar los vectores de los PDFs.")
        print("   Proporciona tu clave de OpenAI para iniciar el proceso.")
        return False

    print(f"🚀 Conectando a Supabase ({SUPABASE_URL})...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small", openai_api_key=key_to_use)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    target_dir = Path(SOURCE_FOLDER)
    if not target_dir.exists():
        print(f"❌ Error: La carpeta {SOURCE_FOLDER} no existe.")
        return False

    pdf_files = list(target_dir.rglob("*.pdf"))
    print(f"📁 Se encontraron {len(pdf_files)} archivos PDF en {SOURCE_FOLDER}")

    total_chunks_uploaded = 0

    for idx, pdf_path in enumerate(pdf_files, 1):
        rel_path = pdf_path.relative_to(target_dir)
        print(f"\n[{idx}/{len(pdf_files)}] 📄 Procesando: {rel_path}")

        try:
            loader = PyPDFLoader(str(pdf_path))
            docs = loader.load()
            chunks = text_splitter.split_documents(docs)
            print(f"   ✂️ {len(docs)} páginas -> {len(chunks)} fragmentos (chunks)")

            if not chunks:
                continue

            # Generar vectores en lote para este PDF
            texts = [c.page_content for c in chunks]
            vectors = embeddings.embed_documents(texts)

            records = []
            for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
                meta = chunk.metadata or {}
                meta["file_name"] = pdf_path.name
                meta["file_path"] = str(rel_path)
                meta["category"] = rel_path.parts[0] if len(rel_path.parts) > 1 else "general"

                records.append({
                    "tenant_id": "cpnnet",
                    "content": chunk.page_content,
                    "metadata": meta,
                    "embedding": vector
                })

            # Subir a Supabase por lotes
            batch_size = 100
            for b_start in range(0, len(records), batch_size):
                b_records = records[b_start:b_start + batch_size]
                supabase.table("document_chunks").insert(b_records).execute()

            total_chunks_uploaded += len(records)
            print(f"   ✅ {len(records)} fragmentos subidos exitosamente a Supabase.")

        except Exception as e:
            print(f"   ❌ Error al procesar {rel_path}: {e}")

    print(f"\n🎉 ¡Proceso de vectorización finalizado! Total de fragmentos subidos: {total_chunks_uploaded}")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_ingest(sys.argv[1])
    else:
        run_ingest()
