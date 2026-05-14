#!/usr/bin/env bash
# Local dev runner.
#
# Default: starts backend + frontend natively in parallel (fast HMR), and
# spins up a `dotadata-redis` docker container on 127.0.0.1:6379 if nothing
# is already listening there. Use --docker to bring up the full compose
# stack (web + api + redis) instead.
#
# Usage:
#   ./scripts/dev.sh             # native: backend on :4000, frontend on :3000
#   ./scripts/dev.sh --docker    # docker compose up --build
#   ./scripts/dev.sh --backend   # only the backend (+ redis)
#   ./scripts/dev.sh --frontend  # only the frontend (no redis)
#   ./scripts/dev.sh --install   # install deps in backend/ and frontend/ first
#   ./scripts/dev.sh --clean     # clear frontend/.next cache before starting

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mode="all"
do_install=0
do_clean=0

for arg in "$@"; do
  case "$arg" in
    --docker)   mode="docker" ;;
    --backend)  mode="backend" ;;
    --frontend) mode="frontend" ;;
    --install)  do_install=1 ;;
    --clean)    do_clean=1 ;;
    -h|--help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ "$do_clean" -eq 1 ]]; then
  echo "→ clearing frontend/.next cache"
  rm -rf "$REPO_ROOT/frontend/.next"
fi

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
    (cd backend && bun install)
  fi
  if [[ ! -d "$REPO_ROOT/frontend/node_modules" ]] || [[ "$do_install" -eq 1 ]]; then
    echo "→ installing frontend deps"
    (cd frontend && bun install)
  fi
}

# ── Local Redis (Docker) ────────────────────────────────────────────────────
# Backend's rate limiter + model cache use Redis when REDIS_URL is set. In
# native dev we spin up a dedicated container exposed on 127.0.0.1:6379. The
# compose `redis` service stays on its internal network, so we use a separate
# container ("dotadata-redis") rather than touching compose. Skipped if
# something already listens on :6379 or docker isn't available.
ensure_redis() {
  if lsof -iTCP:6379 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "→ redis: already listening on :6379"
    return
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "  ⚠  docker not found — backend will fall back to in-memory cache" >&2
    return
  fi
  if docker ps --format '{{.Names}}' | grep -qx 'dotadata-redis'; then
    echo "→ redis: container already running"
  elif docker ps -a --format '{{.Names}}' | grep -qx 'dotadata-redis'; then
    echo "→ redis: starting existing container"
    docker start dotadata-redis >/dev/null
  else
    echo "→ redis: launching dotadata-redis (redis:7-alpine on 127.0.0.1:6379)"
    docker run -d --name dotadata-redis -p 127.0.0.1:6379:6379 redis:7-alpine >/dev/null
  fi
  # Wait up to ~5s for redis to accept connections.
  for _ in $(seq 1 20); do
    if docker exec dotadata-redis redis-cli ping 2>/dev/null | grep -q PONG; then
      return
    fi
    sleep 0.25
  done
  echo "  ⚠  redis didn't respond to PING in time — continuing anyway" >&2
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
if [[ "$mode" != "frontend" ]]; then ensure_redis; fi

run_backend()  { (cd backend && bun run dev); }
run_frontend() { (cd frontend && bun run dev); }

if [[ "$mode" == "backend"  ]]; then exec bash -c "$(declare -f run_backend); run_backend"; fi
if [[ "$mode" == "frontend" ]]; then exec bash -c "$(declare -f run_frontend); run_frontend"; fi

# Run both. Forward SIGINT/SIGTERM so Ctrl-C kills both children.
echo "→ starting backend (:4000) and frontend (:3000) — Ctrl-C to stop"

(cd backend && bun run dev)  & backend_pid=$!
(cd frontend && bun run dev) & frontend_pid=$!

# Recursively kill a pid and all of its descendants. The dev script spawns
# subshells that spawn `bun --watch` / `next dev`, and a plain `kill` on the
# subshell PID leaves the grandchildren behind — they then squat on :3000 /
# :4000 and break the next run. Walk the tree depth-first.
kill_tree() {
  local pid="$1" sig="${2:-TERM}" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "→ shutting down…"
  kill_tree "$backend_pid"
  kill_tree "$frontend_pid"
  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# Portable replacement for `wait -n` (macOS still ships bash 3.2).
# Poll until either child exits, then capture that one's exit code.
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done
if ! kill -0 "$backend_pid" 2>/dev/null; then
  wait "$backend_pid";  exit_code=$?
else
  wait "$frontend_pid"; exit_code=$?
fi
cleanup
exit "$exit_code"
