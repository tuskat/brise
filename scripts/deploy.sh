#!/usr/bin/env bash
set -euo pipefail

# Deploy Brise to a remote Docker host (NAS, VPS, etc.)
# 
# Usage:
#   DEPLOY_HOST=nas.local ./scripts/deploy.sh
#   DEPLOY_HOST=user@nas.local DEPLOY_PATH=/opt/brise ./scripts/deploy.sh
#
# Prerequisites:
#   - SSH access to DEPLOY_HOST
#   - Docker + docker compose installed on remote
#   - Your SSH key authorized on the remote host
#
# The script:
#   1. rsyncs the project (excluding node_modules, data, .git)
#   2. Runs golden tests locally first
#   3. Builds on the remote and starts via docker compose

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[brise]${NC} $*"; }
warn()  { echo -e "${YELLOW}[brise]${NC} $*"; }
error() { echo -e "${RED}[brise]${NC} $*" >&2; exit 1; }

# ── Configuration ──────────────────────────────────────────────
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/brise}"
DEPLOY_USER="${DEPLOY_USER:-}"
SKIP_TEST="${SKIP_TEST:-false}"
EXTRA_COMPOSE_ARGS="${EXTRA_COMPOSE_ARGS:-}"

[ -z "$DEPLOY_HOST" ] && error "Set DEPLOY_HOST (e.g. nas.local or user@nas.local)"

# Parse user@host
if [[ "$DEPLOY_HOST" == *@* ]]; then
  DEPLOY_USER="${DEPLOY_USER:-${DEPLOY_HOST%%@*}}"
  DEPLOY_HOST="${DEPLOY_HOST##*@}"
fi

SSH_TARGET="${DEPLOY_USER:+$DEPLOY_USER@}$DEPLOY_HOST"
SSH_CMD="ssh $SSH_TARGET"

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

# ── Step 1: Run golden tests locally ──────────────────────────
if [ "$SKIP_TEST" != "true" ]; then
  info "Running golden tests..."
  if ! npx vitest run; then
    error "Golden tests failed — aborting deploy"
  fi
  info "Tests passed ✓"
else
  warn "Skipping golden tests (SKIP_TEST=true)"
fi

# ── Step 2: Verify SSH connectivity ───────────────────────────
info "Checking SSH connection to $SSH_TARGET..."
if ! $SSH_CMD "echo ok" >/dev/null 2>&1; then
  error "Cannot connect to $SSH_TARGET via SSH"
fi
info "SSH connection OK ✓"

# ── Step 3: Create remote directory ────────────────────────────
info "Ensuring remote directory: $DEPLOY_PATH"
$SSH_CMD "mkdir -p $DEPLOY_PATH/data $DEPLOY_PATH/personas $DEPLOY_PATH/proxies"

# ── Step 4: Sync project files ─────────────────────────────────
info "Syncing project files to $SSH_TARGET:$DEPLOY_PATH ..."
rsync -az --delete \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='data/' \
  --exclude='dist/' \
  --exclude='.astro/' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  ./ "$SSH_TARGET:$DEPLOY_PATH/"
info "Sync complete ✓"

# ── Step 5: Build and start on remote ──────────────────────────
info "Building and starting on remote..."
$SSH_CMD "cd $DEPLOY_PATH && docker compose up -d --build $EXTRA_COMPOSE_ARGS"

# ── Step 6: Health check ──────────────────────────────────────
info "Waiting for health check..."
sleep 5
HEALTH=$($SSH_CMD "curl -sf http://localhost:4321/api/health" 2>/dev/null || echo "")
if [ -n "$HEALTH" ]; then
  info "Remote health check passed ✓"
else
  warn "Health check didn't respond yet — container may still be starting"
  warn "Check manually: ssh $SSH_TARGET 'docker compose -f $DEPLOY_PATH/docker-compose.yml logs'"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
info "Deployed to $SSH_TARGET:$DEPLOY_PATH"
info "App:  http://$DEPLOY_HOST:4321"
info "Docs: http://$DEPLOY_HOST:4322"
echo ""
info "Useful commands:"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose logs -f'"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose restart'"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose down'"
