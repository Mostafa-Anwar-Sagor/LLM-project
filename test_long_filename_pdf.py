import sys
import os
import requests

BASE_URL = "http://localhost:8000/api"

print("===============================================================")
print("  TESTING LONG FILENAME PDF UPLOAD (127+ CHARS) & AI RAG ")
print("===============================================================\n")

# 1. Login Admin
res = requests.post(f"{BASE_URL}/auth/login/", json={"username": "admin", "password": "admin123"})
assert res.status_code == 200, f"Admin login failed: {res.text}"
admin_token = res.json()["access"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}

# Get group ID
res = requests.get(f"{BASE_URL}/groups/", headers=admin_headers)
groups = res.json().get("results", res.json())
presales_id = next(g["id"] for g in groups if g["name"] == "Presales")

# Create PDF with 127-char filename
long_filename = "A Web-Based IoT Security Assessment and Threat Monitoring Platform with Integrated Scanning and AI-Powered Response Machine.pdf"
pdf_path = os.path.join("c:\\Users\\sagor\\ALTEL\\ALIIS", long_filename)

# Generate a valid PDF file using pypdf / reportlab or basic pdf content
from pypdf import PdfWriter
writer = PdfWriter()
writer.add_blank_page(width=612, height=792)
with open(pdf_path, "wb") as f:
    writer.write(f)

# Upload the long filename PDF
print(f"Uploading PDF with long filename ({len(long_filename)} chars)...")
with open(pdf_path, "rb") as f:
    files = {"file": (long_filename, f, "application/pdf")}
    data = {
        "title": "A Web-Based IoT Security Assessment and Threat Monitoring Platform",
        "description": "IoT security platform paper",
        "group_ids": [presales_id]
    }
    res = requests.post(f"{BASE_URL}/documents/upload/", headers=admin_headers, data=data, files=files)
    assert res.status_code == 201, f"Upload failed: {res.text}"
    doc_info = res.json()
    print(f"  [OK] Upload succeeded! Document ID={doc_info['id']}, Status={doc_info['status']}")

# Clean up temp file
if os.path.exists(pdf_path):
    os.remove(pdf_path)

print("\n===============================================================")
print("  [SUCCESS] LONG FILENAME PDF UPLOAD VERIFIED!")
print("===============================================================")
