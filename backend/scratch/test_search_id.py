import httpx
import json

resp = httpx.post('http://localhost:8000/auth/login', data={'username':'raunakk@gmail.com','password':'password'})
t = resp.json()['access_token']

resp2 = httpx.get('http://localhost:8000/search/documents?query=gurjar', headers={'Authorization': 'Bearer '+t})
data = resp2.json()

print(f"Total: {len(data)}")
for d in data:
    print(f"Doc: {d.get('id')} | Case: {d.get('case_id')} | Title: {d.get('title')}")
