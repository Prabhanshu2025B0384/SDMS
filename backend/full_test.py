import asyncio
import httpx
from httpx import AsyncClient
import uuid
import sys

results = []

def log(test_name, expected, actual, status):
    results.append({"test": test_name, "expected": expected, "actual": actual, "status": status})
    print(f"[{status}] {test_name} (Expected: {expected}, Actual: {actual})")

async def run_tests():
    base_url = "http://localhost:8000"
    
    async with AsyncClient(base_url=base_url) as client:
        # 1. Routing Testing
        print("\n--- Routing Testing ---")
        
        # Public login route
        resp = await client.post("/auth/login", data={"username": "wrong", "password": "wrong"})
        log("Public login route (Accessible)", "401", resp.status_code, "PASS" if resp.status_code == 401 else "FAIL")

        # Protected route without JWT
        resp = await client.get("/cases/")
        log("Protected route without JWT", "401", resp.status_code, "PASS" if resp.status_code == 401 else "FAIL")

        # Invalid route
        resp = await client.get("/invalid_route_xyz")
        log("Invalid route", "404", resp.status_code, "PASS" if resp.status_code == 404 else "FAIL")

        # Invalid method
        resp = await client.put("/cases/")
        log("Invalid method", "405", resp.status_code, "PASS" if resp.status_code == 405 else "FAIL")
        
        
        print("\n--- Authentication Testing ---")
        # Invalid login
        resp = await client.post("/auth/login", data={"username": "admin@gmail.com", "password": "wrong_password"})
        log("Invalid login", "401", resp.status_code, "PASS" if resp.status_code == 401 else "FAIL")

        # Valid login (Admin)
        resp = await client.post("/auth/login", data={"username": "admin@gmail.com", "password": "admin"})
        if resp.status_code == 200:
            token = resp.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            log("Valid login", "200", resp.status_code, "PASS")
        else:
            log("Valid login", "200", resp.status_code, "FAIL")
            return
            
        print("\n--- Case APIs Testing ---")
        case_num = f"API-TEST-{uuid.uuid4().hex[:6]}"
        resp = await client.post("/cases/", json={"case_number": case_num, "jurisdiction": "Test"}, headers=headers)
        if resp.status_code == 200:
            case_id = resp.json()["id"]
            log("Case creation", "200", resp.status_code, "PASS")
        else:
            log("Case creation", "200", resp.status_code, "FAIL")
            return

        resp = await client.get("/cases/", headers=headers)
        log("Case retrieval", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")
        
        print("\n--- Document APIs Testing ---")
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n%%EOF"
        files = {'file': ('test_doc.pdf', pdf_content, 'application/pdf')}
        data = {
            "title": "API Test Doc",
            "document_type": "FIR",
            "classification_level": 1,
            "case_id": case_id
        }
        resp = await client.post("/documents/upload", data=data, files=files, headers=headers)
        if resp.status_code == 200:
            doc_id = resp.json()["document_id"]
            log("Document upload", "200", resp.status_code, "PASS")
        else:
            log("Document upload", "200", resp.status_code, "FAIL")
            return

        resp = await client.get(f"/documents/{doc_id}", headers=headers)
        log("Document retrieve", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")

        resp = await client.get(f"/documents/{doc_id}/download", headers=headers)
        log("Document download", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")

        # Document versions list
        resp = await client.get(f"/documents/{doc_id}/versions", headers=headers)
        log("Document versions list", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")
        
        # Approval workflow
        # Fetch current user to act as reviewer for testing purposes
        me_resp = await client.get("/auth/me", headers=headers)
        me_data = me_resp.json()
        
        resp = await client.post(f"/documents/{doc_id}/status", json={"status": "SUBMITTED", "reviewer_id": me_data["id"]}, headers=headers)
        log("Approval workflow - SUBMITTED", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")

        # Integrity verification
        resp = await client.post(f"/documents/{doc_id}/verify-integrity", headers=headers)
        log("Integrity verification", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")

        # Retry behavior (should fail if not PROCESSING_FAILED)
        resp = await client.post(f"/documents/{doc_id}/retry", headers=headers)
        log("Retry behavior (when not failed)", "400", resp.status_code, "PASS" if resp.status_code == 400 else "FAIL")

        print("\n--- Search APIs Testing ---")
        resp = await client.get("/search/documents?query=API", headers=headers)
        log("Search documents", "200", resp.status_code, "PASS" if resp.status_code == 200 else "FAIL")

        print("\n--- Outputting Results ---")
        print(f"\nTOTAL TESTS: {len(results)}")
        print(f"PASSED: {len([r for r in results if r['status'] == 'PASS'])}")
        print(f"FAILED: {len([r for r in results if r['status'] == 'FAIL'])}")

if __name__ == "__main__":
    asyncio.run(run_tests())
