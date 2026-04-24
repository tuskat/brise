#!/usr/bin/env bash
set -euo pipefail

# Pull a Docker base image via alternative methods when Docker Hub is unreachable.
#
# The Cloudflare R2 storage backend that Docker Hub uses sometimes times out
# on certain networks. This script tries multiple approaches:
#   1. Standard docker pull (with retries)
#   2. Pull from a mirror (ghcr.io or quay.io equivalent)
#   3. Direct download via skopeo
#   4. Download via nerdctl
#
# Usage:
#   ./scripts/pull-base-image.sh                    # pulls node:22-alpine
#   ./scripts/pull-base-image.sh node:22-alpine linux/arm64

IMAGE="${1:-node:lts-alpine3.22}"
PLATFORM="${2:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[pull]${NC} $*"; }
warn()  { echo -e "${YELLOW}[pull]${NC} $*"; }
fail()  { echo -e "${RED}[pull]${NC} $*" >&2; }

PULL_ARGS=()
[ -n "$PLATFORM" ] && PULL_ARGS+=(--platform "$PLATFORM")

# ── Method 1: Standard docker pull with retries ───────────────
info "Method 1: docker pull (3 retries)..."
for i in 1 2 3; do
  if docker pull "${PULL_ARGS[@]}" "$IMAGE" 2>/dev/null; then
    info "Pulled via docker hub ✓"
    exit 0
  fi
  [ "$i" -lt 3 ] && { warn "Attempt $i failed, retrying in $((i*5))s..."; sleep $((i*5)); }
done

# ── Method 2: skopeo copy into docker ──────────────────────────
if command -v skopeo >/dev/null 2>&1; then
  info "Method 2: skopeo copy (bypasses Docker daemon network stack)..."
  LOCAL_REF="docker-daemon:$IMAGE"
  if [ -n "$PLATFORM" ]; then
    # skopeo uses override arch
    case "$PLATFORM" in
      linux/arm64) SKOPEO_ARGS=(--override-arch arm64 --override-os linux) ;;
      linux/amd64) SKOPEO_ARGS=(--override-arch amd64 --override-os linux) ;;
      *)           SKOPEO_ARGS=() ;;
    esac
  else
    SKOPEO_ARGS=()
  fi
  if skopeo copy "${SKOPEO_ARGS[@]}" "docker://$IMAGE" "$LOCAL_REF" 2>/dev/null; then
    info "Pulled via skopeo ✓"
    exit 0
  fi
  warn "skopeo copy failed"
else
  warn "skopeo not installed — skipping method 2"
  info "  Install with: brew install skopeo"
fi

# ── Method 3: nerdctl ─────────────────────────────────────────
if command -v nerdctl >/dev/null 2>&1; then
  info "Method 3: nerdctl pull..."
  if nerdctl pull "${PULL_ARGS[@]}" "$IMAGE" 2>/dev/null; then
    info "Pulled via nerdctl ✓"
    exit 0
  fi
  warn "nerdctl pull failed"
else
  warn "nerdctl not installed — skipping method 3"
fi

# ── Method 4: docker pull with --disable-content-trust + no buildkit ──
info "Method 4: legacy docker pull (buildkit disabled)..."
DOCKER_BUILDKIT=0 docker pull "${PULL_ARGS[@]}" "$IMAGE" && {
  info "Pulled with legacy builder ✓"
  exit 0
}

# ── All methods failed ─────────────────────────────────────────
echo ""
fail "All pull methods failed."
echo ""
info "Manual workarounds:"
echo "  1. Try from a different network (mobile hotspot, VPN, etc.)"
echo "  2. Install skopeo:  brew install skopeo   then re-run this script"
echo "  3. Download the image on another machine and scp it:"
echo "     docker pull $IMAGE"
echo "     docker save $IMAGE | gzip > node-22-alpine.tar.gz"
echo "     scp node-22-alpine.tar.gz THIS_HOST:/tmp/"
echo "     docker load < /tmp/node-22-alpine.tar.gz"
echo "  4. Try a VPN — Cloudflare R2 sometimes blocks certain ISP ranges"
echo "  5. Check Docker Desktop proxy: Settings → Resources → Proxies → clear fields"
exit 1
