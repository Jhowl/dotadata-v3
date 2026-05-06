#!/usr/bin/env bash
# Local dev runner.
#
# Default: starts backend + frontend natively in parallel (fast HMR).
# Use --docker to bring up the full compose stack (web + api + redis) instead.
#
# Usage:
#   ./scripts/dev.sh             # native: backend on :4000, frontend on :3000
#   ./scripts/dev.sh --docker    # docker compose up --build
#   ./scripts/dev.sh --backend   # only the backend
#   ./scripts/dev.sh --frontend  # only the frontend
#   ./scripts/dev.sh --install   # install deps in backend/ and frontend/ first

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mode="all"
do_install=0

for arg in "$@"; do
  case "$arg" in
    --docker)   mode="docker" ;;
    --backend)  mode="backend" ;;
    --frontend) mode="frontend" ;;
    --install)  do_install=1 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

# ── Pre-flight: ensure .env files exist ─────────────────────────────────────
# Source of truth: $REPO_ROOT/.env. The backend loads it explicitly; the
# frontend keeps its own .env.local for the public API URL.
ensure_env() {
  if [[ ! -f "$REPO_ROOT/.env" ]]; then
    if [[ -f "$REPO_ROOT/../web/.env.local" ]]; then
      echo "→ seeding .env from ../web/.env.local (existing project credentials)"
      cp "$REPO_ROOT/../web/.env.local" "$REPO_ROOT/.env"
    else
      echo "→ creating .env from .env.example — fill in real values before hitting the DB"
      cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    fi
  fi

  # Older smoke-test stub from earlier iterations; root .env now covers everything.
  if [[ -f "$REPO_ROOT/backend/.env" ]]; then
    echo "→ removing stale backend/.env (root .env is now the source of truth)"
    rm "$REPO_ROOT/backend/.env"
  fi

  if [[ ! -f "$REPO_ROOT/frontend/.env.local" ]]; then
    echo "→ creating frontend/.env.local with API base URLs"
    cat > "$REPO_ROOT/frontend/.env.local" <<EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
API_INTERNAL_BASE_URL=http://localhost:4000/api/v1
EOF
  fi

  # Sanity check: warn if Supabase isn't configured — backend will fall back to mock data.
  if ! grep -qE '^(SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL)=https?://' "$REPO_ROOT/.env" 2>/dev/null; then
    echo ""
    echo "  ⚠  No Supabase URL found in $REPO_ROOT/.env"
    echo "     Backend will return mock data. Add SUPABASE_URL + SUPABASE_ANON_KEY"
    echo "     (or NEXT_PUBLIC_-prefixed variants) and re-run."
    echo ""
  fi
}

install_deps() {
  if [[ ! -d "$REPO_ROOT/backend/node_modules" ]] || [[ "$do_install" -eq 1 ]]; then
    echo "→ installing backend deps"
    (cd backend && npm install)
  fi
  if [[ ! -d "$REPO_ROOT/frontend/node_modules" ]] || [[ "$do_install" -eq 1 ]]; then
    echo "→ installing frontend deps"
    (cd frontend && npm install)
  fi
}

# ── Mode: docker ────────────────────────────────────────────────────────────
if [[ "$mode" == "docker" ]]; then
  ensure_env
  echo "→ docker compose up --build (web :3000 · api :4000 · redis)"
  exec docker compose up --build
fi

# ── Native modes ────────────────────────────────────────────────────────────
ensure_env
install_deps

run_backend()  { (cd backend && npm run dev); }
run_frontend() { (cd frontend && npm run dev); }

if [[ "$mode" == "backend"  ]]; then exec bash -c "$(declare -f run_backend); run_backend"; fi
if [[ "$mode" == "frontend" ]]; then exec bash -c "$(declare -f run_frontend); run_frontend"; fi

# Run both. Forward SIGINT/SIGTERM so Ctrl-C kills both children.
echo "→ starting backend (:4000) and frontend (:3000) — Ctrl-C to stop"

(cd backend && npm run dev)  & backend_pid=$!
(cd frontend && npm run dev) & frontend_pid=$!

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "→ shutting down…"
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait -n "$backend_pid" "$frontend_pid"
exit_code=$?
cleanup
exit "$exit_code"
