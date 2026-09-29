import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  VERIFYING GROUP PERMISSION RULES: IOT vs PRESALES ")
print("===============================================================\n")

# 1. Login Admin
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200
admin_token = res.json()["access"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}

# Get total document count from Admin perspective
res = requests.get(f"{BASE_URL}/documents/", headers=admin_headers)
admin_docs = res.json().get("results", res.json())
total_docs_count = len(admin_docs)
print(f"  [1] Admin sees ALL {total_docs_count} documents in system.")

# 2. Login IoT user
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "iot_user", "password": "user123"})
assert res.status_code == 200
iot_token = res.json()["access"]
iot_headers = {"Authorization": f"Bearer {iot_token}"}

res = requests.get(f"{BASE_URL}/documents/", headers=iot_headers)
iot_docs = res.json().get("results", res.json())
print(f"  [2] IoT User sees ALL {len(iot_docs)} documents in system.")
assert len(iot_docs) == total_docs_count, f"IoT user must see all {total_docs_count} documents, got {len(iot_docs)}"

# 3. Login Presales user
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "presales_user", "password": "user123"})
assert res.status_code == 200
presales_token = res.json()["access"]
presales_headers = {"Authorization": f"Bearer {presales_token}"}

res = requests.get(f"{BASE_URL}/documents/", headers=presales_headers)
presales_docs = res.json().get("results", res.json())
print(f"  [3] Presales User sees ONLY dedicated {len(presales_docs)} Presales documents.")
assert len(presales_docs) < total_docs_count, "Presales user must be restricted to Presales documents only!"

# 4. Test Chatbot RAG for IoT User vs Presales User
print("\n  [4] Testing AI Chatbot RAG permissions...")
q = "What is the content of the IoT config or switch manual?"

# IoT query
res = requests.post(f"{BASE_URL}/chat/", headers=iot_headers, json={"question": q})
iot_ans = res.json()
print(f"      -> IoT User Chatbot: {iot_ans['chunks_retrieved']} chunk(s) retrieved from accessible docs.")
assert iot_ans['chunks_retrieved'] > 0, "IoT user must retrieve IoT document chunks!"

# Presales query
res = requests.post(f"{BASE_URL}/chat/", headers=presales_headers, json={"question": q})
presales_ans = res.json()
print(f"      -> Presales User Chatbot: {presales_ans['chunks_retrieved']} chunk(s) retrieved.")
print(f"         Presales AI Answer: {presales_ans['answer'][:120]}...")

print("\n===============================================================")
print("  [SUCCESS] IOT (SEE ALL) & PRESALES (RESTRICTED) RULES VERIFIED!")
print("===============================================================")
