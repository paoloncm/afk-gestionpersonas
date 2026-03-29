import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

def list_accessible_folders():
    credentials_path = 'credentials.json'
    if not os.path.exists(credentials_path):
        print("credentials.json not found.")
        return

    scopes = ['https://www.googleapis.com/auth/drive.readonly']
    creds = service_account.Credentials.from_service_account_file(credentials_path, scopes=scopes)
    service = build('drive', 'v3', credentials=creds)

    # Search for folders
    query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    folders = results.get('files', [])

    if not folders:
        print("No folders found. Make sure you shared the folder with the service account email.")
    else:
        print("\nDirectorio de Carpetas Accesibles:")
        for f in folders:
            print(f"- {f['name']} (ID: {f['id']})")

if __name__ == "__main__":
    list_accessible_folders()
