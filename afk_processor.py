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

class CandidateCV(BaseModel):
    nombre_completo: str = Field(..., description="Full name of the candidate")
    rut: Optional[str] = Field(None, description="Chilean ID (RUT) if present, formatted as 12.345.678-9")
    fecha_nacimiento: Optional[str] = Field(None, description="Date of birth if present (YYYY-MM-DD format)")
    profesion: str = Field(..., description="Main profession or degree")
    correo: str = Field(..., description="Email address")
    telefono: Optional[str] = Field(None, description="Contact phone number")
    direccion: Optional[str] = Field(None, description="Physical address or city of residence")
    
    cargo: Optional[str] = Field(None, description="Current or most recent job title/position")
    ultima_exp_laboral_empresa: Optional[str] = Field(None, description="Name of the most recent company worked for")
    periodo: Optional[str] = Field(None, description="Time period of the most recent employment (e.g., '2019 - Present')")
    software_que_domina: Optional[str] = Field(None, description="List of software, tools, or technologies the candidate masters")
    experiencia: Optional[str] = Field(None, description="Summary of the most recent work experience")
    
    cargo_a_desempenar: Optional[str] = Field(None, description="Latest or targeted position")
    experiencia_total: float = Field(0.0, description="Total years of work experience (numeric)")
    experiencia_en_empresa_actual: float = Field(0.0, description="Years in the current or most recent company")
    exp_cargo_actual: float = Field(0.0, description="Years in the current or most recent position")
    exp_proy_similares: float = Field(0.0, description="Estimated years of experience in industrial/mining projects or similar to the target role")
    
    antecedentes_academicos: str = Field("", description="Summary of education and degrees")
    experiencia_general: str = Field("", description="Draft of General Experience for TEC-02 report")
    experiencia_especifica: str = Field("", description="Draft of Specific Experience for TEC-02-A report")
    otras_experiencias: str = Field("", description="Other relevant experiences or certifications")
    
    evaluacion_general: str = Field("", description="A professional 3-paragraph tactical summary: 1. Value Proposition, 2. Technical Mastery, 3. Operational Fit. Use bullet points if needed.")
    match_score: float = Field(80.0, description="A merit index from 0 to 100 based on seniority, certifications, and technical specialized skills.")
    match_explicacion: str = Field("", description="A clear, professional justification for the match_score, highlighting technical gaps or strengths.")

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

    def process_cv_with_ai(self, text: str) -> CandidateCV:
        system_prompt = (
            "You are JARVIS (Just A Rather Very Intelligent System), an elite HR Tactical Analyst. "
            "Your objective is to perform an EXHAUSTIVE and PROFESSIONAL extraction of intelligence from the provided CV. "
            "TONE: Formal, tactical, and efficient. Use high-precision terminology (e.g., 'Mastery', 'Operational Readiness', 'Strategic Fit'). "
            "CRITICAL INSTRUCTIONS: "
            "1. NEVER leave a field empty if the data can be inferred. "
            "2. 'software_que_domina': Generate a detailed inventory of every tool, ERP (SAP, Maximo), or technical software mentioned. "
            "3. 'evaluacion_general': Synthesize a high-fidelity 3-paragraph summary. Focus on tangible achievements and certifications. "
            "4. 'experiencia_total': Be precise. Sum up all professional years correctly. "
            "5. If certifications like NFPA, OSHA, or SEC are mentioned, highlight them prominently in 'especifica' or 'otras_experiencias'."
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
        
        return CandidateCV(**data)

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
            "nombre_completo", "rut", "fecha_nacimiento", "profesion", "correo", "telefono", "direccion",
            "cargo", "ultima_exp_laboral_empresa", "periodo", "software_que_domina", "experiencia",
            "cargo_a_desempenar", "experiencia_total", "experiencia_en_empresa_actual",
            "exp_cargo_actual", "exp_proy_similares", "antecedentes_academicos",
            "experiencia_general", "experiencia_especifica", "otras_experiencias",
            "evaluacion_general", "match_score", "status",
            "cv_full_text", "cv_embedding"
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
