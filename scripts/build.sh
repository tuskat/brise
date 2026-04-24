#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
REGISTRY="${REGISTRY:-}"          # e.g. registry.local:5000 or ghcr.io/user
IMAGE_NAME="${IMAGE_NAME:-brise}"
TAG="${TAG:-latest}"
PLATFORM="${PLATFORM:-}"         # e.g. linux/amd64 or linux/arm64
PUSH="${PUSH:-false}"
PULL_BASE="${PULL_BASE:-true}"   # pre-pull base image to avoid build timeouts

# ── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[brise]${NC} $*"; }
warn()  { echo -e "${YELLOW}[brise]${NC} $*"; }
error() { echo -e "${RED}[brise]${NC} $*" >&2; exit 1; }

# ── Preflight ──────────────────────────────────────────────────
command -v docker >/dev/null || error "docker not found in PATH"

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

if [ ! -f Dockerfile ]; then
  error "No Dockerfile found in $(pwd)"
fi

# ── Determine full image tag ──────────────────────────────────
if [ -n "$REGISTRY" ]; then
  FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${TAG}"
else
  FULL_TAG="${IMAGE_NAME}:${TAG}"
fi

# ── Pre-pull base image ────────────────────────────────────────
# Docker builds often fail with "DeadlineExceeded" pulling from Docker Hub
# during `FROM node:20-alpine`. Pre-pulling gives better retry control.
if [ "$PULL_BASE" = "true" ]; then
  info "Pre-pulling base image node:20-alpine..."
  PULL_ARGS=()
  [ -n "$PLATFORM" ] && PULL_ARGS+=(--platform "$PLATFORM")

  PULLED=false
  for i in 1 2 3; do
    if docker pull "${PULL_ARGS[@]}" node:20-alpine; then
      PULLED=true
      break
    fi
    warn "Pull attempt $i failed — retrying in $((i * 5))s..."
    sleep $((i * 5))
  done

  if [ "$PULLED" = "false" ]; then
    warn "Could not pre-pull base image from Docker Hub."
    warn "The build may still work if the image is cached locally."
    warn ""
    warn "If the build also fails with 'DeadlineExceeded', try:"
    warn "  1. Docker Desktop → Settings → Resources → Proxies → clear proxy fields"
    warn "  2. Or skip pre-pull: PULL_BASE=false ./scripts/build.sh"
    echo ""
  fi
fi

# ── Build ──────────────────────────────────────────────────────
BUILD_ARGS=(-t "$FULL_TAG")

if [ -n "$PLATFORM" ]; then
  BUILD_ARGS+=(--platform "$PLATFORM")
  info "Building for platform: $PLATFORM"
fi

# Add git SHA as label for traceability
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_ARGS+=(--label "org.brise.git-sha=$GIT_SHA")
BUILD_ARGS+=(--label "org.brise.build-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)")

info "Building image: $FULL_TAG  (sha: $GIT_SHA)"
docker build "${BUILD_ARGS[@]}" .

info "Build complete ✓"

# ── Push (optional) ───────────────────────────────────────────
if [ "$PUSH" = "true" ]; then
  if [ -z "$REGISTRY" ]; then
    error "PUSH=true but REGISTRY is not set. Set REGISTRY=e.g. registry.local:5000"
  fi
  info "Pushing to registry: $FULL_TAG"
  docker push "$FULL_TAG"
  info "Push complete ✓"
fi

# ── Summary ────────────────────────────────────────────────────
echo ""
info "Image:    $FULL_TAG"
info "SHA:      $GIT_SHA"
info "Size:     $(docker images "$FULL_TAG" --format '{{.Size}}' | head -1)"
echo ""
if [ "$PUSH" = "true" ]; then
  info "On your NAS, run:"
  echo "  docker pull $FULL_TAG"
  echo "  docker run -d -p 4321:4321 -p 4322:4322 -v ./data:/app/data -v ./personas:/app/personas -v ./proxies:/app/proxies --name brise $FULL_TAG"
else
  info "Test locally:"
  echo "  docker compose up"
  echo ""
  info "Push to registry later:"
  echo "  REGISTRY=registry.local:5000 PUSH=true ./scripts/build.sh"
fi
