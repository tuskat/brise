#!/usr/bin/env bash
set -euo pipefail

# Quick smoke-test: build + run + health-check + teardown
# Usage: ./scripts/smoke-test.sh

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[brise]${NC} $*"; }
warn()  { echo -e "${YELLOW}[brise]${NC} $*"; }
fail()  { echo -e "${RED}[brise]${NC} $*" >&2; }

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
CONTAINER_NAME="brise-smoke-$(date +%s)"

cleanup() {
  info "Cleaning up..."
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Run golden tests ──────────────────────────────────
info "Running golden tests..."
if ! npx vitest run --reporter=verbose 2>&1 | tail -5; then
  fail "Golden tests failed — aborting smoke test"
  exit 1
fi
info "Golden tests passed ✓"

# ── Step 2: Build Docker image ────────────────────────────────
info "Building Docker image..."
docker build -t brise:smoke . >&2

# ── Step 3: Run container ─────────────────────────────────────
info "Starting container: $CONTAINER_NAME"
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 14321:4321 \
  -p 14322:4322 \
  -e NODE_ENV=production \
  -e HOST=0.0.0.0 \
  -e PORT=4321 \
  brise:smoke

# ── Step 4: Wait for startup ──────────────────────────────────
info "Waiting for server to start..."
MAX_WAIT=30
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf http://localhost:14321/api/health >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq "$MAX_WAIT" ]; then
    fail "Server did not start within ${MAX_WAIT}s"
    docker logs "$CONTAINER_NAME" | tail -20
    exit 1
  fi
  sleep 1
done
info "Server is up ✓"

# ── Step 5: Health checks ─────────────────────────────────────
PASS=0; TOTAL=0

check() {
  local url="$1" expect="$2" label="$3"
  TOTAL=$((TOTAL + 1))
  STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  if [ "$STATUS" = "$expect" ]; then
    info "  $label: $STATUS ✓"
    PASS=$((PASS + 1))
  else
    fail "  $label: got $STATUS, expected $expect ✗"
  fi
}

info "Checking endpoints..."
check "http://localhost:14321/api/health"    "200" "GET /api/health"
check "http://localhost:14321"               "200" "GET / (SPA)"
check "http://localhost:14321/api/metrics"   "200" "GET /api/metrics"
check "http://localhost:14321/api/history"   "200" "GET /api/history"
check "http://localhost:14321/api/personas"  "200" "GET /api/personas"
check "http://localhost:14321/api/proxies"   "200" "GET /api/proxies"
check "http://localhost:14321/api/chat/conversations" "200" "GET /api/chat/conversations"

# ── Step 6: Docs site ─────────────────────────────────────────
check "http://localhost:14322" "200" "GET /docs"

# ── Summary ───────────────────────────────────────────────────
echo ""
if [ "$PASS" -eq "$TOTAL" ]; then
  info "All $TOTAL checks passed ✓"
else
  fail "$PASS/$TOTAL checks passed"
  exit 1
fi
