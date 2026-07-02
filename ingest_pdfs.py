import os
import argparse
from pathlib import Path
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from supabase import create_client, Client

load_dotenv()

# Configuración
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Faltan credenciales de Supabase en el archivo .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def vectorize_pdf(file_path: str, embeddings: OpenAIEmbeddings, tenant_id: str, supabase: Client = None):
    print(f"\n📄 Procesando el archivo: {file_path}")
    
    try:
        # 1. Cargar el PDF
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        print(f"  ✅ PDF cargado. {len(documents)} páginas encontradas.")

        # 2. Dividir el texto en chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, 
            chunk_overlap=200
        )
        docs = text_splitter.split_documents(documents)
        print(f"  ✂️ Texto dividido en {len(docs)} fragmentos (chunks).")
        
        # 3. Subir a Supabase (pgvector)
        print("  🚀 Vectorizando y subiendo a Supabase...")
        for i, doc in enumerate(docs):
            content = doc.page_content
            metadata = doc.metadata
            metadata['source'] = file_path # Guardar la ruta original
            
            # Generar vector
            vector = embeddings.embed_query(content)
            
            # Insertar en base de datos
            if supabase:
                try:
                    # Insertando en la tabla 'document_chunks' con el tenant_id
                    supabase.table("document_chunks").insert({
                        "tenant_id": tenant_id,
                        "content": content,
                        "metadata": metadata,
                        "embedding": vector
                    }).execute()
                except Exception as e:
                    print(f"  ❌ Error al subir el chunk {i}: {e}")
                    
        print(f"  🎉 Archivo {os.path.basename(file_path)} completado.")
    except Exception as e:
        print(f"  ❌ Error procesando {file_path}: {e}")

def process_target(target_path: str, tenant_id: str):
    if not OPENAI_API_KEY:
        raise ValueError("Falta OPENAI_API_KEY en el archivo .env")
        
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    
    # Intenta obtener el cliente de Supabase (si falla, solo mostrará que las credenciales faltan y no subirá nada)
    supabase = None
    try:
        supabase = get_supabase_client()
    except ValueError as e:
        print(f"⚠️ Advertencia: {e}. Los vectores se generarán pero no se guardarán.")

    target = Path(target_path)
    
    if target.is_file() and target.suffix.lower() == '.pdf':
        vectorize_pdf(str(target), embeddings, tenant_id, supabase)
        
    elif target.is_dir():
        print(f"📁 Escaneando el directorio: {target_path} (Buscando PDFs en todas las subcarpetas...)")
        # Rglob busca de forma recursiva en todas las subcarpetas
        pdf_files = list(target.rglob("*.pdf"))
        
        if not pdf_files:
            print("  No se encontraron archivos PDF en este directorio.")
            return
            
        print(f"Encontrados {len(pdf_files)} archivos PDF. Iniciando procesamiento en lote...")
        
        for pdf_file in pdf_files:
            vectorize_pdf(str(pdf_file), embeddings, tenant_id, supabase)
            
        print("\n🏆 ¡Procesamiento de carpeta completado!")
    else:
        print(f"❌ La ruta {target_path} no es un PDF válido ni una carpeta existente.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vectorizar PDFs (archivos individuales o carpetas) y subirlos a Supabase")
    parser.add_argument("target_path", help="Ruta al archivo PDF o la carpeta que deseas procesar")
    parser.add_argument("--tenant", "-t", default="cpnnet", help="El ID del tenant (empresa) al que pertenecen estos documentos")
    args = parser.parse_args()
    
    print(f"🔹 Iniciando ingestión para Tenant: {args.tenant}")
    process_target(args.target_path, args.tenant)
