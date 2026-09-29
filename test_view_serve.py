import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  TESTING IN-APP DOCUMENT SERVE & AUTHENTICATED PREVIEW ")
print("===============================================================\n")

# 1. Login Admin
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200, f"Login failed: {res.text}"
token = res.json()["access"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Get list of documents
res = requests.get(f"{BASE_URL}/documents/", headers=headers)
assert res.status_code == 200
docs = res.json().get("results", res.json())
assert len(docs) > 0, "At least 1 document must exist!"
target_doc = docs[0]
doc_id = target_doc["id"]
print(f"  [OK] Found Document ID={doc_id}, Title='{target_doc['title']}', Type='{target_doc['file_type']}'")

# 3. Test Authenticated Serve Endpoint
res = requests.get(f"{BASE_URL}/documents/{doc_id}/serve/", headers=headers)
assert res.status_code == 200, f"Serve endpoint failed: {res.text}"
content_type = res.headers.get("Content-Type", "")
content_len = len(res.content)
print(f"  [OK] Authenticated File Stream fetched: Content-Type='{content_type}', Size={content_len} bytes")

print("\n===============================================================")
print("  [SUCCESS] IN-APP DOCUMENT PREVIEW & FILE STREAM VERIFIED!")
print("===============================================================")
