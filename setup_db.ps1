# ALIIS Database Setup Script
# Run this in PowerShell as Administrator (or with postgres password)
# Usage: .\setup_db.ps1 -PgPassword "your_postgres_password"

param(
    [Parameter(Mandatory=$true)]
    [string]$PgPassword
)

$env:PGPASSWORD = $PgPassword
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$pgConfig = "C:\Program Files\PostgreSQL\17\bin\pg_config.exe"

Write-Host "Setting up ALIIS database..." -ForegroundColor Cyan

# Create user and database
& $psql -U postgres -c "CREATE USER aliis WITH PASSWORD 'aliis_password';" 2>&1
& $psql -U postgres -c "CREATE DATABASE aliis OWNER aliis;" 2>&1
& $psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE aliis TO aliis;" 2>&1

# Enable pgvector extension
& $psql -U postgres -d aliis -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1

Write-Host ""
Write-Host "Checking pgvector..." -ForegroundColor Yellow
$vectorCheck = & $psql -U postgres -d aliis -c "SELECT extname FROM pg_extension WHERE extname='vector';" 2>&1
Write-Host $vectorCheck

if ($vectorCheck -match "vector") {
    Write-Host "pgvector is installed!" -ForegroundColor Green
} else {
    Write-Host "pgvector NOT found. Please install it:" -ForegroundColor Red
    Write-Host "  Download from: https://github.com/pgvector/pgvector/releases" -ForegroundColor Yellow
    Write-Host "  Or use: https://github.com/pgvector/pgvector#windows" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Run with USE_SQLITE=True in .env (no vector search, for testing only)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host "Run: cd backend; venv\Scripts\activate; python manage.py migrate" -ForegroundColor Cyan

$env:PGPASSWORD = ""
