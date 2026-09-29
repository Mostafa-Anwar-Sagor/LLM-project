import sys
import os
import time
import requests

BASE_URL = "http://localhost:8000/api"
FE_URL = "http://localhost:5173"

print("===============================================================")
print("  ALIIS SYSTEM-WIDE TERMINAL FUNCTIONALITY & VERIFICATION TEST ")
print("===============================================================\n")

# 1. Test Frontend Reachability
print("[Step 1/9] Testing Frontend Web App Reachability...")
try:
    res = requests.get(FE_URL)
    assert res.status_code == 200, f"Frontend returned status {res.status_code}"
    assert "id=\"root\"" in res.text, "Frontend HTML missing root element"
    print(f"  [OK] Frontend is UP and accessible at {FE_URL} (HTML 200 OK)")
except Exception as e:
    print(f"  [FAIL] Frontend check failed: {e}")
    sys.exit(1)

# 2. Test Authentication (Login, Refresh, Me)
print("\n[Step 2/9] Testing JWT Auth Endpoints...")
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200, f"Admin login failed: {res.text}"
admin_data = res.json()
admin_token = admin_data["access"]
admin_refresh = admin_data["refresh"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}
print(f"  [OK] Admin Login: username='admin', role='{admin_data['user']['role']}'")

# Refresh token test
res = requests.post(f"{BASE_URL}/auth/refresh/", json={"refresh": admin_refresh})
assert res.status_code == 200, f"Token refresh failed: {res.text}"
new_access = res.json()["access"]
print("  [OK] JWT Token Refresh API")

# Auth Me test
res = requests.get(f"{BASE_URL}/auth/me/", headers={"Authorization": f"Bearer {new_access}"})
assert res.status_code == 200
print(f"  [OK] GET /api/auth/me/ -> User: {res.json()['username']}")

# Member logins
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "iot_user", "password": "user123"})
assert res.status_code == 200
iot_token = res.json()["access"]
iot_headers = {"Authorization": f"Bearer {iot_token}"}
print(f"  [OK] IoT User Login: group='{res.json()['user']['group']['name']}'")

res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "presales_user", "password": "user123"})
assert res.status_code == 200
presales_token = res.json()["access"]
presales_headers = {"Authorization": f"Bearer {presales_token}"}
print(f"  [OK] Presales User Login: group='{res.json()['user']['group']['name']}'")

# 3. Test Group Management CRUD
print("\n[Step 3/9] Testing Group Management CRUD API...")
res = requests.get(f"{BASE_URL}/groups/", headers=admin_headers)
assert res.status_code == 200
groups = res.json().get("results", res.json())
group_map = {g["name"]: g["id"] for g in groups}
print(f"  [OK] List Groups: {[g['name'] for g in groups]}")

# Create new temporary group
res = requests.post(f"{BASE_URL}/groups/", headers=admin_headers, json={"name": "QA_Temp", "description": "Temp group"})
assert res.status_code == 201, f"Group creation failed: {res.text}"
qa_group_id = res.json()["id"]
print(f"  [OK] Create Group: Name='QA_Temp', ID={qa_group_id}")

# Delete temporary group
res = requests.delete(f"{BASE_URL}/groups/{qa_group_id}/", headers=admin_headers)
assert res.status_code == 240 or res.status_code == 204
print("  [OK] Delete Group API")

# 4. Test User Management CRUD
print("\n[Step 4/9] Testing User Management CRUD API...")
res = requests.get(f"{BASE_URL}/users/", headers=admin_headers)
assert res.status_code == 200
users = res.json().get("results", res.json())
print(f"  [OK] List Users: {[u['username'] for u in users]}")

# Create temp user
temp_uname = f"qa_user_{int(time.time())}"
res = requests.post(f"{BASE_URL}/users/", headers=admin_headers, json={
    "username": temp_uname,
    "password": "password123",
    "role": "member",
    "group_id": group_map["IoT"]
})
assert res.status_code == 201, f"User create failed: {res.text}"
temp_user_id = res.json()["id"]
print(f"  [OK] Create User: username='qa_user_test', ID={temp_user_id}")

# Deactivate user
res = requests.delete(f"{BASE_URL}/users/{temp_user_id}/", headers=admin_headers)
assert res.status_code == 200
print("  [OK] Deactivate User API")

# Reactivate user
res = requests.patch(f"{BASE_URL}/users/{temp_user_id}/activate/", headers=admin_headers)
assert res.status_code == 200
print("  [OK] Reactivate User API")

# 5. Test Document Upload
print("\n[Step 5/9] Testing Document Upload & Ingestion...")
files = {
    "file": ("network_architecture.txt", "The Core Network Switch operates on 100Gbps optic fiber links with redundant power supply AC-240V.", "text/plain")
}
data = {
    "title": "Core Network Switch Manual",
    "description": "Operations manual for 100Gbps core switch",
    "group_ids": [group_map["IoT"]]
}
res = requests.post(f"{BASE_URL}/documents/upload/", headers=admin_headers, data=data, files=files)
assert res.status_code == 201, f"Upload failed: {res.text}"
doc_data = res.json()
doc_id = doc_data["id"]
print(f"  [OK] Upload Document: ID={doc_id}, Title='{doc_data['title']}', Status='{doc_data['status']}'")

# 6. Test Document Access Isolation
print("\n[Step 6/9] Testing Document Access List Isolation...")
res = requests.get(f"{BASE_URL}/documents/", headers=iot_headers)
assert res.status_code == 200
iot_docs = res.json().get("results", res.json())
iot_ids = [d["id"] for d in iot_docs]
assert doc_id in iot_ids, "IoT user SHOULD see the document!"
print(f"  [OK] IoT User sees document '{doc_data['title']}' (Permitted)")

res = requests.get(f"{BASE_URL}/documents/", headers=presales_headers)
assert res.status_code == 200
presales_docs = res.json().get("results", res.json())
presales_ids = [d["id"] for d in presales_docs]
assert doc_id not in presales_ids, "SECURITY VIOLATION: Presales user must NOT see document!"
print(f"  [OK] Presales User cannot see document '{doc_data['title']}' (ISOLATED)")

# 7. Test Chatbot RAG Query & Permission Isolation
print("\n[Step 7/9] Testing Chatbot RAG Retrieval & Permission Isolation...")
q = "What is the speed of the Core Network Switch?"

# IoT User asks (permitted)
res = requests.post(f"{BASE_URL}/chat/", headers=iot_headers, json={"question": q})
assert res.status_code == 200
iot_ans = res.json()
print(f"  [OK] IoT User Question: '{q}'")
print(f"       -> Retrieved Chunks: {iot_ans['chunks_retrieved']}, Out of Scope: {iot_ans['was_out_of_scope']}")
print(f"       -> Source Docs: {iot_ans['source_documents']}")
assert iot_ans["chunks_retrieved"] > 0, "IoT user should retrieve chunk!"
assert not iot_ans["was_out_of_scope"], "IoT user query must be in-scope!"

# Presales User asks SAME question (unauthorized)
res = requests.post(f"{BASE_URL}/chat/", headers=presales_headers, json={"question": q})
assert res.status_code == 200
presales_ans = res.json()
print(f"\n  [OK] Presales User Question (Unauthorized): '{q}'")
print(f"       -> Retrieved Chunks: {presales_ans['chunks_retrieved']}, Out of Scope: {presales_ans['was_out_of_scope']}")
print(f"       -> Answer: {presales_ans['answer']}")
assert presales_ans["chunks_retrieved"] == 0, "Presales user MUST retrieve 0 chunks!"
assert presales_ans["was_out_of_scope"] == True, "Presales query MUST be out of scope!"

# 8. Test Dynamic Group Access Grant & Revocation
print("\n[Step 8/9] Testing Dynamic Group Access Grant & Revocation...")

# Grant Presales access
iot_id = group_map["IoT"]
presales_id = group_map["Presales"]
res = requests.patch(f"{BASE_URL}/documents/{doc_id}/", headers=admin_headers, json={"group_ids": [iot_id, presales_id]})
assert res.status_code == 200
print("  [OK] Admin granted Presales group access live.")

res = requests.post(f"{BASE_URL}/chat/", headers=presales_headers, json={"question": q})
assert res.status_code == 200
presales_granted = res.json()
print(f"  [OK] Presales User after grant -> Retrieved Chunks: {presales_granted['chunks_retrieved']}, Out of Scope: {presales_granted['was_out_of_scope']}")
assert presales_granted["chunks_retrieved"] > 0, "Presales user must now retrieve chunks after grant!"

# Revoke Presales access
res = requests.patch(f"{BASE_URL}/documents/{doc_id}/", headers=admin_headers, json={"group_ids": [iot_id]})
assert res.status_code == 200
print("  [OK] Admin revoked Presales group access live.")

res = requests.post(f"{BASE_URL}/chat/", headers=presales_headers, json={"question": q})
assert res.status_code == 200
presales_revoked = res.json()
print(f"  [OK] Presales User after revocation -> Retrieved Chunks: {presales_revoked['chunks_retrieved']}, Out of Scope: {presales_revoked['was_out_of_scope']}")
assert presales_revoked["chunks_retrieved"] == 0, "Presales user must be blocked again after revocation!"

# 9. Clean up test user
print("\n[Step 9/9] Cleaning up test data...")
requests.delete(f"{BASE_URL}/users/{temp_user_id}/", headers=admin_headers)
print("  [OK] Cleaned up temporary test user.")

print("\n===============================================================")
print("  [SUCCESS] ALL SYSTEM FEATURES & ACCESS RULES VERIFIED VIA TERMINAL!")
print("===============================================================")
