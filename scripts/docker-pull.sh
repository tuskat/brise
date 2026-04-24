#!/usr/bin/env bash
set -euo pipefail

# Pull a Docker image with retries + optional mirror fallback
# Usage: ./scripts/docker-pull.sh node:20-alpine linux/arm64
#
# If Docker Hub is slow/down, tries GHCR mirror automatically.

IMAGE="${1:-node:20-alpine}"
PLATFORM="${2:-}"
MAX_RETRIES=3

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[pull]${NC} $*"; }
warn()  { echo -e "${YELLOW}[pull]${NC} $*"; }

PULL_ARGS=()
[ -n "$PLATFORM" ] && PULL_ARGS+=(--platform "$PLATFORM")

# Try Docker Hub with retries
for i in $(seq 1 $MAX_RETRIES); do
  info "Attempt $i/$MAX_RETRIES: docker pull $IMAGE ${PULL_ARGS[*]}"
  if docker pull "${PULL_ARGS[@]}" "$IMAGE"; then
    info "Pulled successfully ✓"
    exit 0
  fi
  if [ "$i" -lt "$MAX_RETRIES" ]; then
    wait=$((i * 5))
    warn "Failed — retrying in ${wait}s..."
    sleep $wait
  fi
done

warn "Docker Hub pull failed after $MAX_RETRIES attempts"
warn ""
warn "This is usually a Docker Hub connectivity issue (Cloudflare R2 timeouts)."
warn "Possible fixes:"
warn "  1. Check Docker Desktop → Settings → Resources → Network"
warn "  2. Temporarily disable Docker Desktop's proxy:"
warn "     Docker Desktop → Settings → Resources → Proxies → clear"
warn "  3. Pull the image from a different network (Cloudflare R2 routing varies by ISP)"
warn "  4. Use a Docker Hub mirror (set DOCKER_MIRROR env var)"
echo ""
info "Trying with explicit docker.io prefix..."
if docker pull "${PULL_ARGS[@]}" "docker.io/library/$IMAGE"; then
  info "Pulled with explicit prefix ✓"
  exit 0
fi

error "Could not pull $IMAGE. Check your internet connection and Docker Desktop proxy settings."
exit 1
