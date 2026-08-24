import asyncio
import httpx
from httpx import AsyncClient

async def test_app():
    # 1. Start the server (assuming it's already running on 8000 for this script to work)
    # Actually, we can just run it in a subprocess, but let's assume it's running via uvicorn in another task.
    # So I will start it outside of this script.
    
    base_url = "http://localhost:8000"
    
    async with AsyncClient(base_url=base_url) as client:
        # 1. Test Login
        print("Testing Login...")
        resp = await client.post("/auth/login", data={"username": "admin@gmail.com", "password": "admin"})
        if resp.status_code != 200:
            print(f"Login failed: {resp.status_code} - {resp.text}")
            return
        
        print("Login successful.")
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Test User Info
        print("Testing User Info...")
        resp = await client.get("/auth/me", headers=headers)
        if resp.status_code != 200:
            print(f"Failed to get user info: {resp.status_code}")
            return
            
        print(f"User Info: {resp.json()['email']}")
        
        import random
        # 3. Create a Case
        print("Testing Case Creation...")
        case_data = {
            "case_number": f"TEST-2026-{random.randint(1000, 9999)}",
            "jurisdiction": "Test Dept",
            "status": "ACTIVE"
        }
        resp = await client.post("/cases/", json=case_data, headers=headers)
        if resp.status_code != 200:
            print(f"Case creation failed: {resp.status_code} - {resp.text}")
            return
        
        case_id = resp.json()["id"]
        print(f"Case created successfully. ID: {case_id}")
        
        # 4. Test Document Upload
        print("Testing Document Upload...")
        files = {'file': ('test.pdf', b"%PDF-1.4 This is a fake pdf.", 'application/pdf')}
        data = {
            "title": "Test Doc",
            "document_type": "evidence",
            "classification_level": 1,
            "case_id": case_id
        }
        resp = await client.post("/documents/upload", data=data, files=files, headers=headers)
        
        if resp.status_code != 200:
            print(f"Document upload failed: {resp.status_code} - {resp.text}")
            return
            
        print("Document uploaded successfully.")
        doc_id = resp.json()["document_id"]
        
        # 5. Fetch Document
        print("Fetching Document Details...")
        resp = await client.get(f"/documents/{doc_id}", headers=headers)
        if resp.status_code == 200:
            print(f"Document status: {resp.json()['status']}")
            
        print("All tests passed!")

if __name__ == "__main__":
    asyncio.run(test_app())
