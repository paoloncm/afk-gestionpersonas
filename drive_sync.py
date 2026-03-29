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
        if os.path.exists(credentials_path):
            self.creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=self.scopes)
        else:
            print(f"⚠️ Warning: {credentials_path} not found. Drive Sync will fail.")
        
        self.service = build('drive', 'v3', credentials=self.creds) if self.creds else None
        self.processor = AFKProcessor()

    def list_files(self, folder_id):
        """Lists PDF and DOCX files in a folder."""
        if not self.service: return []
        
        query = f"'{folder_id}' in parents and (mimeType = 'application/pdf' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') and trashed = false"
        results = self.service.files().list(
            q=query, spaces='drive', fields='files(id, name, mimeType)').execute()
        return results.get('files', [])

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
            return []

        results = []
        for f in files:
            print(f"📄 Processing {f['name']}...")
            try:
                content = self.download_file(f['id'])
                # Save temp file for processor (it expects a path)
                temp_path = f"temp_{f['name']}"
                with open(temp_path, 'wb') as tmp:
                    tmp.write(content)
                
                # Use the existing AFKProcessor logic
                text = self.processor.extract_text(temp_path)
                cv_data = self.processor.process_cv_with_ai(text)
                
                if cv_data:
                    self.processor.sync_to_supabase(None, cv_data, text)
                    print(f"✅ JARVIS: {f['name']} integrated successfully.")
                    
                    # Archive the file if requested
                    if archive_folder_id:
                        self.move_file(f['id'], folder_id, archive_folder_id)
                    
                    results.append({"name": f['name'], "status": "success"})
                else:
                    results.append({"name": f['name'], "status": "ai_extraction_failed"})

                os.remove(temp_path)
            except Exception as e:
                print(f"❌ Error processing {f['name']}: {e}")
                results.append({"name": f['name'], "status": "error", "message": str(e)})

        return results

    def move_file(self, file_id, old_parent_id, new_parent_id):
        """Moves a file by removing the old parent and adding the new one."""
        file = self.service.files().get(fileId=file_id, fields='parents').execute()
        previous_parents = ",".join(file.get('parents'))
        self.service.files().update(
            fileId=file_id,
            addParents=new_parent_id,
            removeParents=previous_parents,
            fields='id, parents'
        ).execute()

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
