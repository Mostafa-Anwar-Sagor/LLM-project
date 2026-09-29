import sys
import os
import time
import requests

# Add backend directory to sys.path and initialize Django
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aliis.settings")
import django
django.setup()

BASE_URL = "http://localhost:8000/api"

print("==================================================")
print("  ALIIS REALTIME FEATURE & PERMISSION VERIFICATION ")
print("==================================================\n")

# 1. Test Login Admin
print("[1/8] Testing Admin Login...")
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200, f"Admin login failed: {res.text}"
admin_data = res.json()
admin_token = admin_data["access"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}
print(f"  [OK] Admin authenticated successfully: role={admin_data['user']['role']}")

# 2. Test Login Members
print("\n[2/8] Testing Member Logins...")
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "iot_user", "password": "user123"})
assert res.status_code == 200, f"IoT user login failed: {res.text}"
iot_data = res.json()
iot_token = iot_data["access"]
iot_headers = {"Authorization": f"Bearer {iot_token}"}
print(f"  [OK] IoT User authenticated: group={iot_data['user']['group']['name']}")

res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "presales_user", "password": "user123"})
assert res.status_code == 200, f"Presales user login failed: {res.text}"
presales_data = res.json()
presales_token = presales_data["access"]
presales_headers = {"Authorization": f"Bearer {presales_token}"}
print(f"  [OK] Presales User authenticated: group={presales_data['user']['group']['name']}")

# 3. Test Group & User Management APIs
print("\n[3/8] Testing Group & User Admin APIs...")
res = requests.get(f"{BASE_URL}/groups/", headers=admin_headers)
assert res.status_code == 200
groups = res.json().get("results", res.json())
group_map = {g["name"]: g["id"] for g in groups}
print(f"  [OK] Admin retrieved {len(groups)} groups: {list(group_map.keys())}")

res = requests.get(f"{BASE_URL}/users/", headers=admin_headers)
assert res.status_code == 200
users = res.json().get("results", res.json())
print(f"  [OK] Admin retrieved {len(users)} users: {[u['username'] for u in users]}")

# 4. Upload an IoT-Only Document
print("\n[4/8] Uploading IoT-Only Document via Admin API...")
iot_group_id = group_map["IoT"]
files = {
    "file": ("iot_sensor_spec.txt", "IoT Sensor Model X-500 operates at 2.4GHz frequency with battery lifetime of 5 years. Maximum operating temperature is 85C.", "text/plain")
}
data = {
    "title": "IoT Sensor X-500 Specification",
    "description": "Technical specification for IoT Sensor Model X-500",
    "group_ids": [iot_group_id]
}
res = requests.post(f"{BASE_URL}/documents/upload/", headers=admin_headers, data=data, files=files)
assert res.status_code == 201, f"Upload failed: {res.text}"
doc_data = res.json()
doc_id = doc_data["id"]
print(f"  [OK] Document uploaded successfully: ID={doc_id}, Title='{doc_data['title']}', Status={doc_data['status']}")

# 5. Process Ingestion synchronously for testing
print("\n[5/8] Running Document Ingestion Pipeline...")
from documents.tasks import ingest_document
ingest_result = ingest_document(doc_id)
print(f"  [OK] Ingestion complete: {ingest_result}")

# 6. Test Document List Isolation
print("\n[6/8] Testing Document Browsing & Access Control Isolation...")
res = requests.get(f"{BASE_URL}/documents/", headers=iot_headers)
assert res.status_code == 200
iot_docs = res.json().get("results", res.json())
iot_doc_ids = [d["id"] for d in iot_docs]
assert doc_id in iot_doc_ids, "IoT user SHOULD see the IoT document!"
print(f"  [OK] IoT User document list: Found document '{doc_data['title']}' (Permitted)")

res = requests.get(f"{BASE_URL}/documents/", headers=presales_headers)
assert res.status_code == 200
presales_docs = res.json().get("results", res.json())
presales_doc_ids = [d["id"] for d in presales_docs]
assert doc_id not in presales_doc_ids, "SECURITY VIOLATION: Presales user should NOT see IoT document!"
print(f"  [OK] Presales User document list: Document '{doc_data['title']}' is RESTRICTED (Isolated)")

# 7. Test Chatbot Retrieval & Permission Isolation
print("\n[7/8] Testing Chatbot Retrieval & Isolation...")
question = "What is the maximum operating temperature of IoT Sensor Model X-500?"

# 7a. IoT User asks
print(f"  Asking IoT user: '{question}'")
res = requests.post(f"{BASE_URL}/chat/", headers=iot_headers, json={"question": question})
assert res.status_code == 200
iot_chat_res = res.json()
print(f"    -> Answer: {iot_chat_res['answer'][:120]}...")
print(f"    -> Sources: {iot_chat_res['source_documents']}")
print(f"    -> Chunks retrieved: {iot_chat_res['chunks_retrieved']}, Out of scope: {iot_chat_res['was_out_of_scope']}")
assert iot_chat_res['chunks_retrieved'] > 0, "IoT user should retrieve matching chunks!"
assert not iot_chat_res['was_out_of_scope'], "IoT user question should be in scope!"

# 7b. Presales User asks SAME question
print(f"\n  Asking Presales user (unauthorized group): '{question}'")
res = requests.post(f"{BASE_URL}/chat/", headers=presales_headers, json={"question": question})
assert res.status_code == 200
presales_chat_res = res.json()
print(f"    -> Answer: {presales_chat_res['answer']}")
print(f"    -> Chunks retrieved: {presales_chat_res['chunks_retrieved']}, Out of scope: {presales_chat_res['was_out_of_scope']}")
assert presales_chat_res['chunks_retrieved'] == 0, "Presales user MUST retrieve 0 chunks for restricted document!"
assert presales_chat_res['was_out_of_scope'] == True, "Presales user question MUST be out of scope!"

# 8. Test Live Access Modification
print("\n[8/8] Testing Live Group Access Modification...")
presales_group_id = group_map["Presales"]
res = requests.patch(f"{BASE_URL}/documents/{doc_id}/", headers=admin_headers, json={"group_ids": [iot_group_id, presales_group_id]})
assert res.status_code == 200
print("  [OK] Admin granted Presales group access to the document live.")

res = requests.post(f"{BASE_URL}/chat/", headers=presales_headers, json={"question": question})
assert res.status_code == 200
presales_chat_after = res.json()
print(f"  [OK] Presales user now asks again -> Chunks retrieved: {presales_chat_after['chunks_retrieved']}, Out of scope: {presales_chat_after['was_out_of_scope']}")
assert presales_chat_after['chunks_retrieved'] > 0, "Presales user should now retrieve chunks after live access grant!"

print("\n==================================================")
print("  [OK] ALL REALTIME FEATURE & PERMISSION TESTS PASSED!")
print("==================================================")
