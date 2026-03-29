import os
import io
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from afk_processor import AFKProcessor, CandidateCV
from dotenv import load_dotenv

load_dotenv()

class DriveSync:
    def __init__(self, credentials_path='credentials.json'):
        self.scopes = ['https://www.googleapis.com/auth/drive']
        self.creds = None
        
        # 1. Try environment variable (for Production/Railway)
        env_creds = os.getenv("GOOGLE_CREDENTIALS")
        if env_creds:
            env_creds = env_creds.strip()
            try:
                # Handle cases where it might be wrapped in quotes
                if env_creds.startswith("'") and env_creds.endswith("'"):
                    env_creds = env_creds[1:-1]
                if env_creds.startswith('"') and env_creds.endswith('"'):
                    env_creds = env_creds[1:-1]
                
                # Try to detect if it's Base64 (common fix for corrupted JSON pastes)
                import base64
                try:
                    # Base64 strings usually don't start with '{'
                    if not env_creds.startswith('{'):
                        decoded_creds = base64.b64decode(env_creds).decode('utf-8')
                        info = json.loads(decoded_creds)
                        print("✅ Google Credentials decoded from Base64.")
                    else:
                        info = json.loads(env_creds)
                except Exception:
                    # Fallback to normal JSON if Base64 fails
                    info = json.loads(env_creds)
                
                # Critical fix for JWT Signature: ensure newlines in private_key are real \n
                if "private_key" in info:
                    info["private_key"] = info["private_key"].replace("\\n", "\n")
                
                self.creds = service_account.Credentials.from_service_account_info(
                    info, scopes=self.scopes)
                print("✅ Google Credentials loaded from environment variable.")
            except Exception as e:
                print(f"❌ Error parsing GOOGLE_CREDENTIALS environment variable: {e}")
                print(f"DEBUG: Content starts with: {env_creds[:20]}...")

        # 2. Falling back to local file if no env var
        if not self.creds and os.path.exists(credentials_path):
            self.creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=self.scopes)
            print("✅ Google Credentials loaded from local file.")
            
        if not self.creds:
            print(f"⚠️ Warning: No credentials found (Tried GOOGLE_CREDENTIALS env var and {credentials_path}).")
        
        self.service = build('drive', 'v3', credentials=self.creds) if self.creds else None
        self.processor = AFKProcessor()

    def list_files(self, folder_id):
        """Lists PDF and DOCX files in a folder."""
        if not self.service:
            print("❌ Drive service not initialized. Check credentials.")
            return []
        
        print(f"🔍 Scanning folder {folder_id} for CVs...")
        query = f"'{folder_id}' in parents and (mimeType = 'application/pdf' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') and trashed = false"
        try:
            results = self.service.files().list(
                q=query, 
                spaces='drive', 
                fields='files(id, name, mimeType)',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            files = results.get('files', [])
            if not files:
                # One last try to see if ANY file exists at all (diagnostic)
                print(f"📊 Query successful, but returned 0 files for folder {folder_id}.")
            else:
                print(f"📊 Found {len(files)} files to process.")
            return files
        except Exception as e:
            print(f"❌ Error listing files in Drive: {e}")
            return []

    def download_file(self, file_id):
        """Downloads a file into memory."""
        request = self.service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
        return fh.getvalue()

    def process_folder(self, folder_id, archive_folder_id=None):
        """Processes all files in a folder and moves them to an archive folder."""
        files = self.list_files(folder_id)
        if not files:
            print(f"No files found in folder {folder_id}.")
            print(f"ℹ️ No files found to process in folder {folder_id}.")
            return []
        
        results = []
        for f in files:
            print(f"📄 Processing file: {f['name']} ({f['id']})")
            try:
                content = self.download_file(f['id'])
                # Save temp file for processor (it expects a path)
                temp_path = f"temp_{f['name']}"
                with open(temp_path, 'wb') as tmp:
                    tmp.write(content)
                
                print(f"🔍 Extracting and analyzing text with JARVIS...")
                # Use the existing AFKProcessor logic
                text = self.processor.extract_text(temp_path)
                cv_data = self.processor.process_cv_with_ai(text)
                
                if cv_data:
                    print(f"💾 Syncing to Supabase...")
                    self.processor.sync_to_supabase(None, cv_data, text)
                    print(f"✅ JARVIS: {f['name']} integrated successfully.")
                    
                    # Archive the file if requested
                    if archive_folder_id:
                        print(f"📦 Archiving {f['name']} to folder {archive_folder_id}")
                        self.move_file(f['id'], folder_id, archive_folder_id)
                    
                    results.append({"name": f['name'], "status": "success"})
                else:
                    results.append({"name": f['name'], "status": "ai_extraction_failed"})

                os.remove(temp_path)
            except Exception as e:
                print(f"❌ Error processing file {f['name']}: {e}")
                import traceback
                traceback.print_exc()
                results.append({"name": f['name'], "status": "error", "message": str(e)})

        return results

    def move_file(self, file_id, previous_parent_id, new_parent_id):
        """Moves a file by removing the old parent and adding the new one."""
        try:
            # In API v3, we need to get the current parents first
            file = self.service.files().get(fileId=file_id, fields='parents').execute()
            parents = file.get('parents')
            if not parents:
                print(f"⚠️ Warning: File {file_id} has no parents to remove.")
                remove_parents = ""
            else:
                remove_parents = ",".join(parents)

            self.service.files().update(
                fileId=file_id,
                addParents=new_parent_id,
                removeParents=remove_parents,
                fields='id, parents'
            ).execute()
        except Exception as e:
            print(f"❌ Error moving file {file_id}: {e}")

if __name__ == "__main__":
    # Test run
    load_dotenv()
    FOLDER_ID = os.getenv("DRIVE_FOLDER_ID")
    ARCHIVE_ID = os.getenv("DRIVE_ARCHIVE_ID")
    
    if FOLDER_ID:
        sync = DriveSync()
        sync.process_folder(FOLDER_ID, ARCHIVE_ID)
    else:
        print("Set DRIVE_FOLDER_ID in .env to test.")
