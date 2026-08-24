import requests

def test_admin_self_deactivation():
    base_url = "http://localhost:8000"
    
    # 1. Login as admin
    login_resp = requests.post(f"{base_url}/auth/login", data={"username": "admin@gmail.com", "password": "admin"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get my own user info
    me_resp = requests.get(f"{base_url}/auth/me", headers=headers)
    assert me_resp.status_code == 200, f"Get me failed: {me_resp.text}"
    my_id = me_resp.json()["id"]
    
    # 3. Try to deactivate myself
    patch_resp = requests.patch(f"{base_url}/admin/users/{my_id}", json={"is_active": False}, headers=headers)
    print(f"Self-deactivation status: {patch_resp.status_code}")
    print(f"Self-deactivation response: {patch_resp.text}")
    assert patch_resp.status_code == 400, "Should have been blocked"
    assert "Cannot deactivate your own active session" in patch_resp.text
    
    # 4. Try to delete myself
    del_resp = requests.delete(f"{base_url}/admin/users/{my_id}", headers=headers)
    print(f"Self-deletion status: {del_resp.status_code}")
    print(f"Self-deletion response: {del_resp.text}")
    assert del_resp.status_code == 400, "Should have been blocked"
    assert "Cannot delete or deactivate your own active session" in del_resp.text
    
    print("All tests passed!")

test_admin_self_deactivation()
