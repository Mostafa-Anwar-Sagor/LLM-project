@echo off
title Installing pgvector for PostgreSQL 17...
echo ========================================================
echo   ALIIS - Installing pgvector Extension for PostgreSQL 17
echo ========================================================
echo.

xcopy "C:\Users\sagor\AppData\Local\Temp\vector_pg17_extracted\lib\*" "C:\Program Files\PostgreSQL\17\lib\" /Y /Q /R
xcopy "C:\Users\sagor\AppData\Local\Temp\vector_pg17_extracted\share\extension\*" "C:\Program Files\PostgreSQL\17\share\extension\" /Y /Q /R

echo.
echo Enabling vector extension in PostgreSQL...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d aliis -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo.
echo SUCCESS! pgvector extension installed and enabled in database 'aliis'.
echo You can now run Django migrations in the backend directory.
echo.
pause
