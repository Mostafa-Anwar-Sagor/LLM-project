import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  TESTING MULTI-TURN CONVERSATIONS & CHAT API ")
print("===============================================================\n")

# Login Presales user
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "presales_user", "password": "user123"})
assert res.status_code == 200
token = res.json()["access"]
headers = {"Authorization": f"Bearer {token}"}

# 1. Create a new conversation thread
res = requests.post(f"{BASE_URL}/chat/conversations/", headers=headers, json={"title": "Logbook Review Chat"})
assert res.status_code == 201, f"Create conversation failed: {res.text}"
conv = res.json()
conv_id = conv["id"]
print(f"  [OK] Created New Conversation Thread: ID={conv_id}, Title='{conv['title']}'")

# 2. Send message 1 in conversation
q1 = "what task I have done on 8 may 2026???"
res = requests.post(f"{BASE_URL}/chat/", headers=headers, json={"question": q1, "conversation_id": conv_id})
assert res.status_code == 200, f"Send message 1 failed: {res.text}"
ans1 = res.json()
print(f"  [OK] Q1: '{q1}'")
print(f"       AI Answer:\n{ans1['answer']}")

# 3. Send message 2 in same conversation
q2 = "Who is my supervisor?"
res = requests.post(f"{BASE_URL}/chat/", headers=headers, json={"question": q2, "conversation_id": conv_id})
assert res.status_code == 200
ans2 = res.json()
print(f"\n  [OK] Q2: '{q2}'")
print(f"       AI Answer:\n{ans2['answer']}")

# 4. Fetch conversation detail with all messages
res = requests.get(f"{BASE_URL}/chat/conversations/{conv_id}/", headers=headers)
assert res.status_code == 200
detail = res.json()
print(f"\n  [OK] Fetched Conversation Detail: Total Messages={len(detail['messages'])}")

print("\n===============================================================")
print("  [SUCCESS] MULTI-TURN CONVERSATION THREADS VERIFIED!")
print("===============================================================")
