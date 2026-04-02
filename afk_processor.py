import os
import re
import json
from typing import Optional, List
from pydantic import BaseModel, Field
from pypdf import PdfReader
import docx
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- Schemas ---

class WorkExperience(BaseModel):
    empresa: str = Field(..., description="Nombre de la empresa")
    faena: Optional[str] = Field(None, description="Nombre de la faena minera o planta industrial (ej. 'Minera Escondida')")
    cargo: str = Field(..., description="Cargo o posición ocupada")
    funciones: List[str] = Field(default_factory=list, description="Lista de funciones técnicas específicas realizadas (ej. 'overhaul de filtros Larox', 'reparación de baldes')")
    tecnologias: List[str] = Field(default_factory=list, description="Lista de herramientas, software o tecnologías usadas (ej. 'SAP', 'FCAW', 'SMAW')")
    equipos: List[str] = Field(default_factory=list, description="Lista de equipos industriales o maquinaria intervenida (ej. 'CAEX', 'espesadores', 'bombas')")

class Certification(BaseModel):
    nombre: str = Field(..., description="Nombre de la certificación, curso o licencia (ej. 'Rigger alto tonelaje', 'Soldador AWS')")
    institucion: Optional[str] = Field(None, description="Entidad que emite la certificación o capacitación (ej. 'CEIM')")
    fecha: Optional[str] = Field(None, description="Fecha o año de obtención")

class CandidateCV(BaseModel):
    nombre_completo: str = Field(..., description="Nombre completo del candidato")
    rut: Optional[str] = Field(None, description="RUT chileno si está presente, formateado como 12.345.678-9")
    fecha_nacimiento: Optional[str] = Field(None, description="Fecha de nacimiento si está presente (formato YYYY-MM-DD)")
    profesion: str = Field(..., description="Profesión principal o grado académico. TRADUCIR SIEMPRE AL ESPAÑOL.")
    correo: str = Field(..., description="Dirección de correo electrónico")
    telefono: Optional[str] = Field(None, description="Número de teléfono de contacto")
    direccion: Optional[str] = Field(None, description="Dirección física o ciudad de residencia")
    
    cargo: Optional[str] = Field(None, description="Cargo o posición laboral más reciente. TRADUCIR AL ESPAÑOL.")
    ultima_exp_laboral_empresa: Optional[str] = Field(None, description="Nombre de la última empresa donde trabajó.")
    periodo: Optional[str] = Field(None, description="Periodo de tiempo del empleo más reciente (ej., '2019 - Presente')")
    software_que_domina: Optional[str] = Field(None, description="Lista de software, herramientas o tecnologías mencionadas. TRADUCIR AL ESPAÑOL.")
    experiencia: Optional[str] = Field(None, description="Resumen de la experiencia laboral más reciente. TRADUCIR AL ESPAÑOL.")

    # Atomic Evidence
    experiencia_detallada: List[WorkExperience] = Field(default_factory=list, description="Cronología laboral ATÓMICA y DETALLADA. No omitir ninguna empresa o función técnica.")
    certificaciones_detalladas: List[Certification] = Field(default_factory=list, description="Lista todas las certificaciones, cursos, licencias y capacitaciones mencionadas.")
    
    cargo_a_desempenar: Optional[str] = Field(None, description="Última posición o posición objetivo. TRADUCIR AL ESPAÑOL.")
    experiencia_total: float = Field(0.0, description="Años totales de experiencia laboral (numérico)")
    experiencia_en_empresa_actual: float = Field(0.0, description="Años en la empresa actual o más reciente")
    exp_cargo_actual: float = Field(0.0, description="Años en el cargo actual o más reciente")
    exp_proy_similares: float = Field(0.0, description="Años estimados de experiencia en proyectos industriales/mineros o similares al rol objetivo")
    
    antecedentes_academicos: str = Field("", description="Resumen de educación y títulos. TRADUCIR AL ESPAÑOL.")
    experiencia_general: str = Field("", description="ESTE CAMPO SERÁ CALCULADO AUTOMÁTICAMENTE. DEJAR VACÍO.")
    experiencia_especifica: str = Field("", description="ESTE CAMPO SERÁ CALCULADO AUTOMÁTICAMENTE. DEJAR VACÍO.")
    otras_experiencias: str = Field("", description="ESTE CAMPO SERÁ CALCULADO AUTOMÁTICAMENTE. DEJAR VACÍO.")
    
    evaluacion_general: str = Field("", description="Un resumen táctico profesional de 3 párrafos en ESPAÑOL: 1. Propuesta de Valor, 2. Dominio Técnico, 3. Aptitud Operativa. Usa viñetas para destacar equipos específicos.")
    match_score: float = Field(80.0, description="Un índice de mérito de 0 a 100 basado en antigüedad, certificaciones y habilidades técnicas especializadas.")
    match_explicacion: str = Field("", description="Una justificación clara y profesional en ESPAÑOL para el match_score, destacando brechas técnicas o fortalezas.")
    nota: float = Field(1.0, description="Calificación numérica de 1.0 a 7.0 (escala chilena). Basada en 30% antigüedad, 40% certificaciones, 30% complejidad de proyectos.")
    ranking: int = Field(50, description="Un ranking estratégico de 1 a 100 que representa la competitividad del candidato en el sector industrial.")

# --- Core Processor ---

class AFKProcessor:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if not all([self.supabase_url, self.supabase_key, self.openai_api_key]):
            print("WARNING: Missing environment variables. Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are set.")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key) if self.supabase_url else None
        self.openai = OpenAI(api_key=self.openai_api_key) if self.openai_api_key else None

    def extract_text_from_pdf(self, file_path: str) -> str:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text

    def extract_text_from_docx(self, file_path: str) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

    def extract_text(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return self.extract_text_from_pdf(file_path)
        elif ext == ".docx":
            return self.extract_text_from_docx(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _reconstruct_experiencia_general(self, experiencias: List[WorkExperience]) -> str:
        if not experiencias: return ""
        frases = []
        for exp in experiencias:
            base = f"Se desempeñó como {exp.cargo} en {exp.empresa}"
            if exp.faena:
                base += f", en {exp.faena}"
            
            detalles = []
            if exp.funciones: detalles.extend(exp.funciones[:5])
            if exp.equipos: detalles.extend([f"intervención de {e}" for e in exp.equipos[:3]])
            
            if detalles:
                frase = f"{base}, desarrollando funciones tales como {', '.join(detalles)}."
            else:
                frase = f"{base}."
            frases.append(frase)
        return " ".join(frases)

    def _reconstruct_experiencia_especifica(self, experiencias: List[WorkExperience], profesion: str) -> str:
        # Simple heuristic: relevant if any keyword from profesion is in funciones/equipos
        keywords = re.findall(r'\w+', profesion.lower())
        relevantes = []
        for exp in experiencias:
            combined_text = " ".join(exp.funciones + exp.equipos + [exp.cargo]).lower()
            if any(k in combined_text for k in keywords if len(k) > 3):
                relevantes.append(exp)
        
        if not relevantes:
            relevantes = experiencias[:2] # Fallback to latest 2
            
        return self._reconstruct_experiencia_general(relevantes)

    def _reconstruct_otras_experiencias(self, certs: List[Certification]) -> str:
        if not certs: return ""
        items = []
        for c in certs:
            s = c.nombre
            if c.institucion: s += f" ({c.institucion})"
            items.append(s)
        return ". ".join(items) + "."

    def process_cv_with_ai(self, text: str) -> CandidateCV:
        system_prompt = (
            "Eres JARVIS (Just A Rather Very Intelligent System), un analista táctico de RRHH de élite. "
            "Tu objetivo es realizar una extracción de inteligencia ATÓMICA y EXHAUSTIVA. "
            "POLÍTICA CRÍTICA DE 'EVIDENCIA TÉCNICA': "
            "1. No resumas. Captura cada empresa, faena, cargo y función técnica en 'experiencia_detallada'. "
            "2. Sé específico con los equipos (CAEX, filtros Larox, SAP, etc.). Si el CV dice 'reparación de baldes', escríbelo tal cual. "
            "3. Captura todas las certificaciones (AWS, CEIM, Licencias D/A/B) en 'certificaciones_detalladas'. "
            "4. Idioma: Todo en ESPAÑOL profesional. Traduce si el origen es inglés. "
            "Tu misión es recolectar la EVIDENCIA para un reporte técnico TEC-02. "
            "REGLAS ADICIONALES: "
            "- 'evaluacion_general': 3 párrafos técnicos sobre Propuesta de Valor, Dominio Técnico y Aptitud Operativa."
        )
        
        # Define the tool/function based on the Pydantic model
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "extract_cv_data",
                    "description": "Extracts structured information from a CV text",
                    "parameters": CandidateCV.model_json_schema()
                }
            }
        ]

        response = self.openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "extract_cv_data"}}
        )
        
        # Extract the tool call arguments
        tool_call = response.choices[0].message.tool_calls[0]
        data = json.loads(tool_call.function.arguments)
        
        cv_obj = CandidateCV(**data)
        
        # --- RECONSTRUCTION LOGIC (Evidence-based) ---
        print(f"🛠️ Reconstructing narratives from {len(cv_obj.experiencia_detallada)} atomic experiences...")
        cv_obj.experiencia_general = self._reconstruct_experiencia_general(cv_obj.experiencia_detallada)
        cv_obj.experiencia_especifica = self._reconstruct_experiencia_especifica(cv_obj.experiencia_detallada, cv_obj.profesion)
        cv_obj.otras_experiencias = self._reconstruct_otras_experiencias(cv_obj.certificaciones_detalladas)
        
        return cv_obj

    def generate_embedding(self, text: str) -> List[float]:
        response = self.openai.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding

    def download_from_gdrive(self, file_id: str) -> str:
        # Placeholder for Google Drive API integration
        # Requires 'google-api-python-client' and 'google-auth-httplib2'
        print(f"🔗 Simulating download from GDrive ID: {file_id}")
        # In a real scenario, this would return a local path to the downloaded file
        return f"/tmp/{file_id}.pdf"

    def sync_to_supabase(self, candidate_id: Optional[str], cv_data: CandidateCV, full_text: str):
        if not self.supabase:
            print("Supabase client not initialized. Skipping sync.")
            return

        # 1. Generate Embedding
        embedding = self.generate_embedding(full_text)
        
        # 2. Build payload using ONLY columns that exist in the candidates table
        EXISTING_DB_COLUMNS = {
            "nombre_completo", "rut", "fecha_nacimiento", "correo", "telefono", 
            "profesion", "experiencia", "software_que_domina", "ultima_exp_laboral_empresa",
            "cargo", "periodo", "experiencia_general", "experiencia_especifica",
            "otras_experiencias", "evaluacion_general", "experiencia_total",
            "experiencia_en_empresa_actual", "exp_cargo_actual", "exp_proy_similares",
            "cargo_a_desempenar", "nota", "ranking", "status", "vacancy_id",
            "match_score", "onboarding_progress", "source",
            "antecedentes_academicos", "direccion", "cv_full_text", "cv_embedding"
        }
        
        raw = cv_data.model_dump()
        payload = {k: v for k, v in raw.items() if k in EXISTING_DB_COLUMNS}
        payload["status"] = "Analizado por IA"
        payload["cv_full_text"] = full_text
        payload["cv_embedding"] = embedding
        # match_score is integer in Supabase, cast it
        if "match_score" in payload and payload["match_score"] is not None:
            payload["match_score"] = int(payload["match_score"])
        
        if candidate_id:
            print(f"🔄 Syncing to Supabase ID: {candidate_id}...")
            result = self.supabase.table("candidates").update(payload).eq("id", candidate_id).execute()
        else:
            print("🆕 No ID provided. Checking for existing candidate by RUT or Name...")
            found_id = None
            
            # Check by RUT first
            if cv_data.rut:
                # Clean rut strings to avoid trailing spaces/inconsistencies
                clean_rut = cv_data.rut.replace(" ", "").strip()
                existing = self.supabase.table("candidates").select("id").eq("rut", clean_rut).execute()
                if existing.data:
                    found_id = existing.data[0]['id']
            
            # Check by Name if RUT didn't match
            if not found_id and cv_data.nombre_completo:
                existing = self.supabase.table("candidates").select("id").ilike("nombre_completo", cv_data.nombre_completo.strip()).execute()
                if existing.data:
                    found_id = existing.data[0]['id']

            if found_id:
                print(f"⚠️ Candidate {cv_data.nombre_completo} already exists (ID: {found_id}). Updating.")
                result = self.supabase.table("candidates").update(payload).eq("id", found_id).execute()
            else:
                print(f"✨ Inserting new candidate: {cv_data.nombre_completo}")
                result = self.supabase.table("candidates").insert(payload).execute()
        
        return result

# --- CLI for Testing ---

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="AFK Intelligent CV Processor")
    parser.add_argument("file", help="Path to the CV file (PDF or DOCX)")
    parser.add_argument("--id", help="Candidate ID in Supabase", required=False)
    args = parser.parse_args()

    processor = AFKProcessor()
    
    print(f"🚀 Processing: {args.file}")
    try:
        text = processor.extract_text(args.file)
        print("📝 Text extracted. Sending to AI...")
        
        cv_data = processor.process_cv_with_ai(text)
        print(f"✅ AI Extraction Complete: {cv_data.nombre_completo}")
        
        print("🔄 Synchronizing with Supabase...")
        processor.sync_to_supabase(args.id, cv_data, text)
        print("✨ Sync Complete. Check your Supabase Dashboard!")
            
    except Exception as e:
        print(f"❌ Error during processing: {e}")
