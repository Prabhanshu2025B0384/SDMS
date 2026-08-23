import requests
import time

BASE_API = 'http://127.0.0.1:8000'
BASE_FRONTEND = 'http://127.0.0.1:5173'

print('=== 1. Checking Frontend & Backend Server Health ===')
fe_res = requests.get(BASE_FRONTEND)
assert fe_res.status_code == 200, f'Frontend failed: {fe_res.status_code}'
print(' [OK] Frontend is UP and serving (200 OK)')

be_res = requests.get(f'{BASE_API}/')
assert be_res.status_code == 200, f'Backend failed: {be_res.status_code}'
print(f' [OK] Backend is UP: {be_res.json()}')

print('\n=== 2. Testing Authentication ===')
login_res = requests.post(f'{BASE_API}/auth/login', data={'username': 'admin12032008@gmail.com', 'password': 'adminhumai'})
assert login_res.status_code == 200, f'Login failed: {login_res.text}'
token = login_res.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}
print(' [OK] Login SUCCESS! JWT Token received.')

me_res = requests.get(f'{BASE_API}/auth/me', headers=headers)
assert me_res.status_code == 200, f'Auth me failed: {me_res.text}'
user_info = me_res.json()
print(f' [OK] Logged in user: {user_info}')

print('\n=== 3. Testing Cases Endpoint ===')
cases_res = requests.get(f'{BASE_API}/cases', headers=headers)
assert cases_res.status_code == 200
cases = cases_res.json()
target_case_id = cases[0]['id']
print(f' [OK] Found {len(cases)} case(s). Selected Case: {cases[0]["case_number"]} (ID: {target_case_id})')

print('\n=== 4. Testing Document Upload with sample_fir_document.pdf ===')
import os
sample_pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'sample_fir_document.pdf'))
with open(sample_pdf_path, 'rb') as f:
    files = {'file': ('sample_fir_document.pdf', f, 'application/pdf')}
    data = {'case_id': target_case_id, 'title': 'FIR 8890 Cyber Extortion Case', 'document_type': 'FIR'}
    upload_res = requests.post(f'{BASE_API}/documents/upload', headers=headers, data=data, files=files)
assert upload_res.status_code == 200, f'Upload failed: {upload_res.text}'
upload_data = upload_res.json()
doc_id = upload_data['document_id']
print(f' [OK] Upload SUCCESS! Document ID: {doc_id}, initial status: {upload_data["status"]}')

print('\n=== 5. Waiting for Background Extraction Pipeline to complete ===')
for i in range(10):
    time.sleep(1)
    doc_res = requests.get(f'{BASE_API}/documents/{doc_id}', headers=headers)
    assert doc_res.status_code == 200
    doc_data = doc_res.json()
    if doc_data['status'] == 'READY':
        print(f' [OK] Extraction COMPLETE! Status: {doc_data["status"]}')
        print(f'   Extracted Text: {doc_data.get("raw_ocr_text")}')
        print(f'   Structured Data: {doc_data.get("structured_data")}')
        break
else:
    raise RuntimeError('Timed out waiting for document processing')

print('\n=== 6. Testing Document Download ===')
dl_res = requests.get(f'{BASE_API}/documents/{doc_id}/download', headers=headers)
assert dl_res.status_code == 200, f'Download failed: {dl_res.status_code}'
assert len(dl_res.content) > 100, 'Downloaded file content is empty'
print(f' [OK] Download SUCCESS! Received {len(dl_res.content)} bytes of PDF data.')

print('\n=== 7. Testing Search Endpoint ===')
search_res = requests.get(f'{BASE_API}/search/documents?query=Cyber', headers=headers)
assert search_res.status_code == 200
search_results = search_res.json()
print(f' [OK] Search query "Cyber" returned {len(search_results)} result(s):')
for r in search_results:
    print(f'   - {r["title"]} (Status: {r["status"]})')

print('\n=== 8. Testing Admin Endpoints ===')
users_res = requests.get(f'{BASE_API}/admin/users', headers=headers)
assert users_res.status_code == 200
audit_res = requests.get(f'{BASE_API}/admin/audit-logs', headers=headers)
assert audit_res.status_code == 200
print(f' [OK] Admin verified: {len(users_res.json())} user(s), {len(audit_res.json())} audit log(s)')

print('\n======================================================')
print(' SUCCESS: ALL SYSTEM CHECKS & VERIFICATIONS PASSED 100%!')
print('======================================================')
