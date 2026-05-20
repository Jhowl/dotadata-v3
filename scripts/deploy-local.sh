#!/usr/bin/env bash
# Build both Docker images locally (linux/amd64), stream them to the host,
# sync the compose file, and restart the stack.
#
# Why local builds: the production host has limited disk/CPU and the frontend
# Next.js build is heavy. Building on a developer machine and shipping the
# resulting images is faster and avoids OOM/disk-full failures.
#
# Prereqs on the host (one-time):
#   - Docker + Docker Compose v2 installed
#   - /srv/dotadata exists with a populated .env (this script does NOT touch it)
#   - nginx (or another reverse proxy) terminates TLS and forwards
#       /         -> 127.0.0.1:3000  (web)
#       /api/     -> 127.0.0.1:4000  (api)
#
# Usage:
#   ./scripts/deploy-local.sh
#
# Configurable via env (defaults shown):
#   DEPLOY_HOST=root@138.197.21.64
#   DEPLOY_PATH=/srv/dotadata
#   NEXT_PUBLIC_API_BASE_URL=https://dotadata.org/api/v1
#   API_IMAGE=dotadata-api:latest
#   WEB_IMAGE=dotadata-web:latest
#   PLATFORM=linux/amd64
#   SKIP_BUILD=1   # reuse existing local images
#   SKIP_API=1     # don't rebuild/ship api
#   SKIP_WEB=1     # don't rebuild/ship web

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@138.197.21.64}"
DEPLOY_PATH="${DEPLOY_PATH:-/srv/dotadata}"
NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://dotadata.org/api/v1}"
API_IMAGE="${API_IMAGE:-dotadata-api:latest}"
WEB_IMAGE="${WEB_IMAGE:-dotadata-web:latest}"
PLATFORM="${PLATFORM:-linux/amd64}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { printf "\n\033[1;36m→ %s\033[0m\n" "$*"; }

# ── sanity checks ────────────────────────────────────────────────────────────
command -v docker >/dev/null || { echo "docker not found in PATH"; exit 1; }
docker buildx version >/dev/null 2>&1 || { echo "docker buildx not available"; exit 1; }
ssh -o BatchMode=yes -o ConnectTimeout=8 "$DEPLOY_HOST" 'true' \
  || { echo "ssh to $DEPLOY_HOST failed"; exit 1; }

# ── build ────────────────────────────────────────────────────────────────────
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  if [[ "${SKIP_API:-}" != "1" ]]; then
    step "building api image ($API_IMAGE, $PLATFORM)"
    docker buildx build \
      --platform "$PLATFORM" \
      --load \
      -t "$API_IMAGE" \
      -f backend/Dockerfile \
      .
  fi

  if [[ "${SKIP_WEB:-}" != "1" ]]; then
    step "building web image ($WEB_IMAGE, $PLATFORM)"
    docker buildx build \
      --platform "$PLATFORM" \
      --load \
      --build-arg "NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL" \
      -t "$WEB_IMAGE" \
      -f frontend/Dockerfile \
      .
  fi
fi

# ── ship images ──────────────────────────────────────────────────────────────
images=()
[[ "${SKIP_API:-}" != "1" ]] && images+=("$API_IMAGE")
[[ "${SKIP_WEB:-}" != "1" ]] && images+=("$WEB_IMAGE")

if [[ ${#images[@]} -gt 0 ]]; then
  step "shipping images to $DEPLOY_HOST: ${images[*]}"
  docker save "${images[@]}" | gzip -1 | ssh "$DEPLOY_HOST" 'gunzip | docker load'
fi

# ── sync compose file ───────────────────────────────────────────────────────
step "syncing docker-compose.yml to $DEPLOY_HOST:$DEPLOY_PATH"
scp -q docker-compose.yml "$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.yml"

# ── bring stack up ──────────────────────────────────────────────────────────
step "starting stack on $DEPLOY_HOST"
ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose up -d --remove-orphans"

# ── post-deploy cleanup ─────────────────────────────────────────────────────
step "pruning dangling images on host"
ssh "$DEPLOY_HOST" 'docker image prune -f'

step "stack status"
ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose ps"

printf "\n\033[1;32m✓ deploy complete\033[0m — https://dotadata.org/\n"
