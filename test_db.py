import os
from supabase import create_client

url = 'https://pmdmvtykkhmvpfxuqjfm.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG12dHlra2htdnBmeHVxamZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTMxNDIsImV4cCI6MjA4ODM4OTE0Mn0.3n4GTAalaA9kI5PRcLYw8GuXwSM5b2-36W6aS_7H3Dw'
supabase = create_client(url, key)

print('--- CHECKING TENDER ---')
res = supabase.table('tenders').select('*').limit(1).execute()
print(res)

print('\n--- CHECKING VACANCIES ---')
res2 = supabase.table('vacancies').select('*').limit(1).execute()
keys = list(res2.data[0].keys()) if res2.data else []
with open('db_error.txt', 'w', encoding='utf-8') as f:
    f.write('VACANCIES COLUMNS: ' + str(keys))
