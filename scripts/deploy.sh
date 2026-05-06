#!/usr/bin/env bash
set -euo pipefail

# Compose-based deploy. Set DEPLOY_HOST and DEPLOY_PATH in your shell or CI.
# Example:
#   DEPLOY_HOST=deploy@example.com DEPLOY_PATH=/srv/dotadata ./scripts/deploy.sh

: "${DEPLOY_HOST:?DEPLOY_HOST is required (e.g. deploy@example.com)}"
: "${DEPLOY_PATH:?DEPLOY_PATH is required (e.g. /srv/dotadata)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ syncing repo to $DEPLOY_HOST:$DEPLOY_PATH"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'frontend/dist' \
  --exclude 'backend/dist' \
  --exclude '.env' \
  --exclude '.env.local' \
  "$REPO_ROOT/" "$DEPLOY_HOST:$DEPLOY_PATH/"

echo "→ building and restarting compose stack"
ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose pull --ignore-buildable && docker compose build && docker compose up -d --remove-orphans"

echo "→ pruning old images"
ssh "$DEPLOY_HOST" "docker image prune -f"

echo "✓ deploy complete"
