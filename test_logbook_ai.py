import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  TESTING EXECUTIVE ASSISTANT CHATBOT RESPONSES ")
print("===============================================================\n")

# Login Presales user
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "presales_user", "password": "user123"})
assert res.status_code == 200
token = res.json()["access"]
headers = {"Authorization": f"Bearer {token}"}

questions = [
    "what task I have done on 10th april 2026??",
    "what i have done in 27th june 2026??",
    "what is the supervisor name ??"
]

for q in questions:
    print(f"\nQuestion: '{q}'")
    res = requests.post(f"{BASE_URL}/chat/", headers=headers, json={"question": q})
    assert res.status_code == 200
    ans = res.json()
    print(f" -> Chunks Retrieved: {ans['chunks_retrieved']}")
    print(f" -> Sources: {[d['title'] for d in ans['source_documents']]}")
    print(f" -> AI Answer:\n{ans['answer']}")
    print("-" * 60)

print("\n===============================================================")
print("  [SUCCESS] EXECUTIVE ASSISTANT RESPONSES VERIFIED!")
print("===============================================================")
