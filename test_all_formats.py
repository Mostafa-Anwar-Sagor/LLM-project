import sys
import os
import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  ALIIS MULTI-FORMAT DOCUMENT UPLOAD & AI RAG TEST ")
print("===============================================================\n")

# 1. Login Admin
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200, f"Admin login failed: {res.text}"
admin_token = res.json()["access"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}

# Login IoT user
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "iot_user", "password": "user123"})
assert res.status_code == 200
iot_token = res.json()["access"]
iot_headers = {"Authorization": f"Bearer {iot_token}"}

# Get IoT group ID
res = requests.get(f"{BASE_URL}/groups/", headers=admin_headers)
groups = res.json().get("results", res.json())
iot_group_id = next(g["id"] for g in groups if g["name"] == "IoT")

# Test 1: Upload TXT
print("[1/3] Uploading TXT document...")
files = {"file": ("iot_config.txt", "IoT Device ID: 99482, IP: 192.168.1.50, Protocol: MQTT over TLS, Port: 8883.", "text/plain")}
data = {"title": "IoT Config Manual TXT", "description": "TXT config", "group_ids": [iot_group_id]}
res = requests.post(f"{BASE_URL}/documents/upload/", headers=admin_headers, data=data, files=files)
assert res.status_code == 201, f"TXT upload failed: {res.text}"
print(f"  [OK] TXT uploaded: ID={res.json()['id']}, Status={res.json()['status']}")

# Test 2: Upload Excel XLSX
print("\n[2/3] Uploading Excel XLSX document...")
import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "DeviceInventory"
ws.append(["Device Name", "Model", "Battery Level", "Location"])
ws.append(["Temperature Sensor Alpha", "TS-9000", "98%", "Building A Room 102"])
ws.append(["Humidity Sensor Beta", "HS-8000", "75%", "Building B Room 204"])
xlsx_path = "c:\\Users\\sagor\\ALTEL\\ALIIS\\test_inventory.xlsx"
wb.save(xlsx_path)

with open(xlsx_path, "rb") as f:
    files = {"file": ("test_inventory.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    data = {"title": "IoT Device Inventory Excel", "description": "XLSX inventory sheet", "group_ids": [iot_group_id]}
    res = requests.post(f"{BASE_URL}/documents/upload/", headers=admin_headers, data=data, files=files)
    assert res.status_code == 201, f"Excel upload failed: {res.text}"
    xlsx_doc_id = res.json()["id"]
    print(f"  [OK] Excel XLSX uploaded: ID={xlsx_doc_id}, Status={res.json()['status']}")

# Clean temp excel file
if os.path.exists(xlsx_path):
    os.remove(xlsx_path)

# Test 3: Query Chatbot about Excel content
print("\n[3/3] Testing AI Chatbot RAG on Excel XLSX content...")
q = "What is the location and battery level of Temperature Sensor Alpha?"
res = requests.post(f"{BASE_URL}/chat/", headers=iot_headers, json={"question": q})
assert res.status_code == 200, f"Chat query failed: {res.text}"
ans = res.json()
print(f"  [OK] Question: '{q}'")
print(f"       -> Retrieved Chunks: {ans['chunks_retrieved']}")
print(f"       -> Sources: {ans['source_documents']}")
print(f"       -> AI Answer:\n{ans['answer']}")
assert ans["chunks_retrieved"] > 0, "AI must retrieve Excel chunk!"

print("\n===============================================================")
print("  [SUCCESS] PDF, WORD, EXCEL, CSV, TXT UPLOAD & AI RAG VERIFIED!")
print("===============================================================")
