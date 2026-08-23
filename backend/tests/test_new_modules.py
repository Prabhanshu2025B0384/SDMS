import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from sqlalchemy.future import select
from app.models import User, Case, Document, DocumentVersion
import uuid
from app.core.security import get_password_hash
import io

@pytest.fixture
async def setup_test_users():
    async with AsyncSessionLocal() as db:
        admin = User(id=uuid.uuid4(), email=f"admin_{uuid.uuid4()}@dms.gov", password_hash=get_password_hash("pass"), role="Admin", department="Test", clearance_level=5, is_active=True)
        officer = User(id=uuid.uuid4(), email=f"officer_{uuid.uuid4()}@dms.gov", password_hash=get_password_hash("pass"), role="Investigating Officer", department="Test", clearance_level=3, is_active=True)
        unauth_officer = User(id=uuid.uuid4(), email=f"unauth_{uuid.uuid4()}@dms.gov", password_hash=get_password_hash("pass"), role="Investigating Officer", department="Test", clearance_level=1, is_active=True)
        db.add_all([admin, officer, unauth_officer])
        
        test_case = Case(id=uuid.uuid4(), case_number=f"CASE-{uuid.uuid4()}", jurisdiction="Test", status="ACTIVE", owning_officer_id=officer.id)
        db.add(test_case)
        await db.commit()
        
        # Test document
        doc = Document(id=uuid.uuid4(), case_id=test_case.id, title="Test Secret Doc", document_type="FIR", classification_level=3, status="READY", search_vector="Test Secret Doc FIR")
        db.add(doc)
        await db.commit()
        
        ver = DocumentVersion(id=uuid.uuid4(), document_id=doc.id, version_number="1.0", storage_path=f"{test_case.id}/{doc.id}/1.0.pdf", file_hash="dummyhash", created_by=officer.id)
        db.add(ver)
        doc.current_version_id = ver.id
        await db.commit()
        
        return {
            "admin": {"email": admin.email, "pass": "pass"},
            "officer": {"email": officer.email, "pass": "pass"},
            "unauth": {"email": unauth_officer.email, "pass": "pass"},
            "case_id": str(test_case.id),
            "doc_id": str(doc.id)
        }

@pytest.mark.asyncio
async def test_search_isolation(setup_test_users):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login unauth (clearance 1)
        res = await ac.post("/auth/login", data={"username": setup_test_users["unauth"]["email"], "password": "pass"})
        token_unauth = res.json()["access_token"]
        
        # Search unauth
        res_search = await ac.get("/search/documents?query=Secret", headers={"Authorization": f"Bearer {token_unauth}"})
        assert res_search.status_code == 200
        assert len(res_search.json()) == 0 # Cannot see the clearance 3 doc
        
        # Login officer (clearance 3, case owner)
        res2 = await ac.post("/auth/login", data={"username": setup_test_users["officer"]["email"], "password": "pass"})
        token_officer = res2.json()["access_token"]
        
        # Search officer
        res_search2 = await ac.get("/search/documents?query=Secret", headers={"Authorization": f"Bearer {token_officer}"})
        assert len(res_search2.json()) == 1
        assert res_search2.json()[0]["id"] == setup_test_users["doc_id"]


@pytest.mark.asyncio
async def test_approval_workflow(setup_test_users):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/auth/login", data={"username": setup_test_users["officer"]["email"], "password": "pass"})
        token = res.json()["access_token"]
        doc_id = setup_test_users["doc_id"]
        
        # Submit
        res = await ac.post(f"/documents/{doc_id}/status", json={"status": "SUBMITTED"}, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        
        # Try to approve as own document (should fail)
        res = await ac.post(f"/documents/{doc_id}/status", json={"status": "UNDER_REVIEW"}, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403
        
        # Admin approves
        res_admin = await ac.post("/auth/login", data={"username": setup_test_users["admin"]["email"], "password": "pass"})
        token_admin = res_admin.json()["access_token"]
        
        res = await ac.post(f"/documents/{doc_id}/status", json={"status": "UNDER_REVIEW"}, headers={"Authorization": f"Bearer {token_admin}"})
        assert res.status_code == 200
        
        res = await ac.post(f"/documents/{doc_id}/status", json={"status": "APPROVED"}, headers={"Authorization": f"Bearer {token_admin}"})
        assert res.status_code == 200
        
        res = await ac.post(f"/documents/{doc_id}/status", json={"status": "LOCKED"}, headers={"Authorization": f"Bearer {token_admin}"})
        assert res.status_code == 200
