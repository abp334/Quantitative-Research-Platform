#!/bin/bash
set -euo pipefail

echo "Waiting for PostgreSQL..."
python - <<'PY'
import os, time
import psycopg2

url = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://quant:quant@db:5432/quant_research",
)
for i in range(60):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print("PostgreSQL is ready")
        break
    except Exception as exc:
        print(f"Waiting ({i+1}/60): {exc}")
        time.sleep(2)
else:
    raise SystemExit("PostgreSQL not available")
PY

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
