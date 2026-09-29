# LLM-project
# ALIIS — Internal AI Knowledge System

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend |
| Node.js | 18+ | Frontend |
| Docker Desktop | Latest | PostgreSQL + Redis |
| Ollama | Latest | Qwen3:8b LLM |

---

## Quick Start (All Steps)

### Step 1 — Start Infrastructure (Docker)
```powershell
cd C:\Users\sagor\ALTEL\ALIIS
docker-compose up -d
```

### Step 2 — Pull AI Models (Ollama)
```powershell
ollama pull qwen3:8b
# Optional: BGE-M3 is downloaded automatically by sentence-transformers on first use
```

### Step 3 — Backend Setup
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # follow prompts — this is your first admin user
python manage.py runserver
```

### Step 4 — Start Celery Worker (new terminal)
```powershell
cd backend
venv\Scripts\activate
celery -A aliis worker -l info -P solo
```
> `-P solo` is required on Windows (no fork support)

### Step 5 — Frontend
```powershell
cd frontend
npm run dev
```

### Step 6 — Open Browser
```
http://localhost:5173
```

Login with the superuser credentials you created in Step 3.

> **Note:** The first time the Celery worker processes a document, it will download the
> BGE-M3 model (~2GB). Subsequent uploads are fast.

---

## Admin Panel Setup (First Time)

1. Log in as admin → you'll be redirected to `/admin`
2. Go to **Groups** → create at least 2 groups (e.g. "IoT", "Presales")
3. Go to **Users** → create test users and assign them to groups
4. Go to **Documents** → upload a document and assign it to one or more groups
5. Log out and log in as a regular user to test chat isolation

---

## Running Tests

```powershell
cd backend
venv\Scripts\activate
python manage.py test documents.tests.test_isolation -v 2
```

---

## Architecture

```
React (Vite + Tailwind) → Django REST API → PostgreSQL + pgvector
                                        → Celery (Redis) → BGE-M3 embeddings
                                        → Ollama (Qwen3:8b)
```

## Environment Variables

See `backend/.env` — configure DB, Redis, Ollama URL, model names here.
