import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import threading
import time
import io
import requests
import uvicorn
import uuid
import asyncio

from app.database import AsyncSessionLocal
from app.models import User, Case
from app.core.security import get_password_hash
from sqlalchemy.future import select

BASE_URL = "http://127.0.0.1:8899"


def run_server():
    uvicorn.run("app.main:app", host="127.0.0.1", port=8899, log_level="warning")


async def setup_test_data():
    async with AsyncSessionLocal() as db:
        # Create Admin
        admin_res = await db.execute(select(User).where(User.email == "admin_perm_test@dms.gov"))
        admin = admin_res.scalar_one_or_none()
        if not admin:
            admin = User(
                id=uuid.uuid4(),
                email="admin_perm_test@dms.gov",
                password_hash=get_password_hash("AdminPass123!"),
                role="Admin",
                department="Cyber Intelligence",
                clearance_level=5,
                is_active=True
            )
            db.add(admin)

        # Create Officer Level 2 (Sub-Inspector)
        u2_res = await db.execute(select(User).where(User.email == "officer_lvl2_test@dms.gov"))
        officer_lvl2 = u2_res.scalar_one_or_none()
        if not officer_lvl2:
            officer_lvl2 = User(
                id=uuid.uuid4(),
                email="officer_lvl2_test@dms.gov",
                password_hash=get_password_hash("Officer2Pass!"),
                role="Investigating Officer",
                department="Field Ops",
                clearance_level=2,
                is_active=True
            )
            db.add(officer_lvl2)

        # Create Officer Level 4 (Senior Officer / SP)
        u4_res = await db.execute(select(User).where(User.email == "officer_lvl4_test@dms.gov"))
        officer_lvl4 = u4_res.scalar_one_or_none()
        if not officer_lvl4:
            officer_lvl4 = User(
                id=uuid.uuid4(),
                email="officer_lvl4_test@dms.gov",
                password_hash=get_password_hash("Officer4Pass!"),
                role="Senior Officer",
                department="Headquarters",
                clearance_level=4,
                is_active=True
            )
            db.add(officer_lvl4)

        await db.commit()
        await db.refresh(admin)
        await db.refresh(officer_lvl2)
        await db.refresh(officer_lvl4)

        # Create Test Case
        case_res = await db.execute(select(Case).where(Case.case_number == "HIERARCHY-PERM-CASE-01"))
        test_case = case_res.scalar_one_or_none()
        if not test_case:
            test_case = Case(
                id=uuid.uuid4(),
                case_number="HIERARCHY-PERM-CASE-01",
                jurisdiction="Cyber Special Operations",
                status="ACTIVE",
                owning_officer_id=admin.id
            )
            db.add(test_case)
            await db.commit()
            await db.refresh(test_case)

        return str(admin.id), str(officer_lvl2.id), str(officer_lvl4.id), str(test_case.id)


def main():
    print("=== 1. Starting test server in background thread ===")
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Wait for server to start
    for _ in range(20):
        try:
            r = requests.get(f"{BASE_URL}/", timeout=1)
            if r.status_code == 200:
                print(" [OK] Server is ready on port 8899")
                break
        except Exception:
            time.sleep(0.3)
    else:
        raise RuntimeError("Server failed to start")

    print("\n=== 2. Setting up test accounts and case ===")
    admin_id, lvl2_id, lvl4_id, case_id = asyncio.run(setup_test_data())
    print(f" [OK] Admin: {admin_id}, Officer L2: {lvl2_id}, Officer L4: {lvl4_id}, Case: {case_id}")

    print("\n=== 3. Testing Authentication & Profile /auth/me ===")
    # Login Admin
    admin_login = requests.post(f"{BASE_URL}/auth/login", data={"username": "admin_perm_test@dms.gov", "password": "AdminPass123!"})
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    me_res = requests.get(f"{BASE_URL}/auth/me", headers=admin_headers)
    assert me_res.status_code == 200
    me = me_res.json()
    assert me["clearance_level"] == 5
    assert me["department"] == "Cyber Intelligence"
    print(f" [OK] /auth/me verified: {me['email']}, Level {me['clearance_level']}, {me['department']}")

    print("\n=== 4. Testing Document Upload with Classification Level 4 (Top Secret) ===")
    dummy_pdf = b"%PDF-1.4 ... Simulated Top Secret Report ..."
    upload_res = requests.post(
        f"{BASE_URL}/documents/upload",
        headers=admin_headers,
        data={
            "case_id": case_id,
            "title": "Operation Blackout Forensic Dossier",
            "document_type": "Forensic Report",
            "classification_level": "4"
        },
        files={"file": ("report.pdf", io.BytesIO(dummy_pdf), "application/pdf")}
    )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    doc_id = upload_res.json()["document_id"]
    print(f" [OK] Level 4 Document uploaded with ID: {doc_id}")

    print("\n=== 5. Testing Hierarchy Clearance Control (Level 2 user blocked from Level 4 document) ===")
    lvl2_login = requests.post(f"{BASE_URL}/auth/login", data={"username": "officer_lvl2_test@dms.gov", "password": "Officer2Pass!"})
    assert lvl2_login.status_code == 200
    lvl2_token = lvl2_login.json()["access_token"]
    lvl2_headers = {"Authorization": f"Bearer {lvl2_token}"}

    lvl2_view = requests.get(f"{BASE_URL}/documents/{doc_id}", headers=lvl2_headers)
    assert lvl2_view.status_code == 403, f"Expected 403 Forbidden but got {lvl2_view.status_code}"
    assert "Security Classification Error" in lvl2_view.json()["detail"]
    print(f" [OK] Access correctly BLOCKED (403): {lvl2_view.json()['detail']}")

    print("\n=== 6. Testing Multi-User Document Sharing (Granular Document Permissions) ===")
    # Grant VIEW and DOWNLOAD permissions to Officer Level 2
    share_res = requests.post(
        f"{BASE_URL}/documents/{doc_id}/permissions",
        headers=admin_headers,
        json={"user_ids": [lvl2_id], "permission_type": "VIEW"}
    )
    assert share_res.status_code == 200, f"Share failed: {share_res.text}"
    print(f" [OK] Permissions granted: {share_res.json()}")

    # Check permissions list
    perms_res = requests.get(f"{BASE_URL}/documents/{doc_id}/permissions", headers=admin_headers)
    assert perms_res.status_code == 200
    perms_list = perms_res.json()
    assert len(perms_list) >= 1
    assert any(p["user_email"] == "officer_lvl2_test@dms.gov" for p in perms_list)
    print(f" [OK] Permissions list verified: {len(perms_list)} user(s) granted access.")

    # Officer Level 2 can now VIEW the document
    lvl2_view_success = requests.get(f"{BASE_URL}/documents/{doc_id}", headers=lvl2_headers)
    assert lvl2_view_success.status_code == 200, f"View failed: {lvl2_view_success.text}"
    print(f" [OK] Officer Level 2 can now VIEW document: {lvl2_view_success.json()['title']}")

    # Officer Level 2 can DOWNLOAD the document
    lvl2_dl = requests.get(f"{BASE_URL}/documents/{doc_id}/download", headers=lvl2_headers)
    assert lvl2_dl.status_code == 200, f"Download failed: {lvl2_dl.status_code}"
    assert len(lvl2_dl.content) > 0
    print(f" [OK] Officer Level 2 downloaded document ({len(lvl2_dl.content)} bytes)")

    print("\n=== 7. Testing User Profile Password Change Flow ===")
    pwd_res = requests.post(
        f"{BASE_URL}/auth/change-password",
        headers=lvl2_headers,
        json={"current_password": "Officer2Pass!", "new_password": "UpdatedSecurePass2026#"}
    )
    assert pwd_res.status_code == 200, f"Password change failed: {pwd_res.text}"
    print(f" [OK] Password successfully changed.")

    # Old password fails
    fail_login = requests.post(f"{BASE_URL}/auth/login", data={"username": "officer_lvl2_test@dms.gov", "password": "Officer2Pass!"})
    assert fail_login.status_code == 401
    print(" [OK] Login with OLD password rejected (401)")

    # New password succeeds
    success_login = requests.post(f"{BASE_URL}/auth/login", data={"username": "officer_lvl2_test@dms.gov", "password": "UpdatedSecurePass2026#"})
    assert success_login.status_code == 200
    print(" [OK] Login with NEW password succeeded (200)")

    print("\n=== 8. Testing Enhanced Audit Logs & Visitor Access History ===")
    audit_res = requests.get(f"{BASE_URL}/admin/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    audit_json = audit_res.json()
    summary = audit_json["summary"]
    print(f" [OK] Audit Summary: Total={summary['total']}, Views={summary['views']}, Downloads={summary['downloads']}, Logins={summary['logins']}, Shares={summary['shares']}")
    assert summary["total"] > 0
    assert summary["views"] > 0
    assert summary["downloads"] > 0

    # Document access history
    history_res = requests.get(f"{BASE_URL}/admin/documents/{doc_id}/access-history", headers=admin_headers)
    assert history_res.status_code == 200
    history = history_res.json()
    print(f" [OK] Document Access History for '{history['document_title']}':")
    print(f"      Total Views: {history['total_views']}, Total Downloads: {history['total_downloads']}")
    print(f"      Records count: {len(history['access_records'])}")
    assert len(history["access_records"]) >= 2  # VIEW + DOWNLOAD events

    print("\n=========================================================================")
    print(" ALL TESTS PASSED: HIERARCHY, SHARING, PROFILE & AUDIT LOGS 100% WORKING! ")
    print("=========================================================================")


if __name__ == "__main__":
    main()
