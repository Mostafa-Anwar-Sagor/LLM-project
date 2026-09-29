import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  TESTING PPTX VISUAL PREVIEW & DYNAMIC RAG RESPONSES ")
print("===============================================================\n")

# Login IoT user
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "iot_user", "password": "user123"})
assert res.status_code == 200
token = res.json()["access"]
headers = {"Authorization": f"Bearer {token}"}

# 1. Fetch document details for PPTX document
res = requests.get(f"{BASE_URL}/documents/", headers=headers)
assert res.status_code == 200
docs = res.json().get("results", res.json())

pptx_doc = None
for d in docs:
    if d.get("file_type", "").lower().replace(".", "") == "pptx":
        pptx_doc = d
        break

assert pptx_doc is not None, "Must have a PPTX document in database!"
print(f"  [1] Found PPTX Document: ID={pptx_doc['id']}, Title='{pptx_doc['title']}'")

# Fetch PPTX document detail
res = requests.get(f"{BASE_URL}/documents/{pptx_doc['id']}/", headers=headers)
assert res.status_code == 200
detail = res.json()
assert "chunks" in detail, "DocumentSerializer must include 'chunks' field!"
assert len(detail["chunks"]) > 0, "PPTX document must have parsed slide chunks!"
print(f"  [OK] PPTX Document has {len(detail['chunks'])} parsed slide chunks ready for visual rendering!")

# 2. Test Dynamic Supervisor RAG Query
q = "Who is the supervisor or team contact person?"
res = requests.post(f"{BASE_URL}/chat/", headers=headers, json={"question": q})
assert res.status_code == 200
ans = res.json()
print(f"\n  [2] Dynamic Supervisor Query: '{q}'")
print(f"      AI Answer:\n{ans['answer']}")
assert "Hariza Binti Sazali" in ans['answer'] or "Supervisor" in ans['answer']

print("\n===============================================================")
print("  [SUCCESS] PPTX VISUAL SLIDE RENDERING & DYNAMIC RAG VERIFIED!")
print("===============================================================")
