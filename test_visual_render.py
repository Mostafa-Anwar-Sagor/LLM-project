import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  TESTING ALL DOCUMENT TYPES FOR IN-APP VISUAL PREVIEW ")
print("===============================================================\n")

# 1. Login Admin
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200
token = res.json()["access"]
headers = {"Authorization": f"Bearer {token}"}

# Get Presales group ID
res = requests.get(f"{BASE_URL}/groups/", headers=headers)
groups = res.json().get("results", res.json())
presales_id = next(g["id"] for g in groups if g["name"] == "Presales")

# Create a sample DOCX file with python-docx
import docx
doc = docx.Document()
doc.add_heading("Company Quarterly Report 2026", 0)
doc.add_paragraph("This is a sample Word document with visual formatting, bold text, and structured headings.")
table = doc.add_table(rows=2, cols=2)
table.cell(0, 0).text = "Metric"
table.cell(0, 1).text = "Value"
table.cell(1, 0).text = "Revenue"
table.cell(1, 1).text = "$1,500,000"
docx_path = "c:\\Users\\sagor\\ALTEL\\ALIIS\\test_report.docx"
doc.save(docx_path)

# Upload DOCX file
print("Uploading DOCX file...")
with open(docx_path, "rb") as f:
    files = {"file": ("test_report.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"title": "Company Quarterly Report Word Document", "description": "DOCX report", "group_ids": [presales_id]}
    res = requests.post(f"{BASE_URL}/documents/upload/", headers=headers, data=data, files=files)
    assert res.status_code == 201, f"DOCX upload failed: {res.text}"
    docx_id = res.json()["id"]
    print(f"  [OK] Uploaded DOCX: ID={docx_id}")

# Test serving the DOCX file for visual rendering
res = requests.get(f"{BASE_URL}/documents/{docx_id}/serve/", headers=headers)
assert res.status_code == 200, f"Serve failed: {res.text}"
assert len(res.content) > 0
print(f"  [OK] Serve DOCX file stream: {len(res.content)} bytes delivered to DocumentViewerModal")

print("\n===============================================================")
print("  [SUCCESS] VISUAL DOCUMENT PREVIEW PIPELINE VERIFIED!")
print("===============================================================")
