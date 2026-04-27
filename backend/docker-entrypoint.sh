#!/usr/bin/env bash
set -euo pipefail

# Wait for Postgres to accept TCP connections. Parses host:port from DATABASE_URL.
python - <<'PY'
import os, re, socket, sys, time

url = os.environ.get("DATABASE_URL", "")
m = re.search(r"@([^:/]+):(\d+)/", url)
if not m:
    print("DATABASE_URL missing host:port; skipping wait.", file=sys.stderr)
    sys.exit(0)
host, port = m.group(1), int(m.group(2))
deadline = time.time() + 60
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"Postgres reachable at {host}:{port}")
            sys.exit(0)
    except OSError:
        time.sleep(1)
print(f"Postgres not reachable at {host}:{port} after 60s", file=sys.stderr)
sys.exit(1)
PY

echo "Applying migrations..."
alembic upgrade head

echo "Seeding themes and questions..."
python -m app.seed.seed

exec "$@"
