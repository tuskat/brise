#!/usr/bin/env bash
set -euo pipefail

# Generic NAS deploy for Brise. Builds a Docker image locally, ships it over SSH,
# starts the container on the NAS.
#
# Usage:
#   NAS_TYPE=ugreen   DEPLOY_HOST=192.168.1.50 ./scripts/deploy-nas.sh
#   NAS_TYPE=synology DEPLOY_HOST=nas.local DEPLOY_USER=admin ./scripts/deploy-nas.sh
#   NAS_TYPE=qnap     DEPLOY_HOST=...    DEPLOY_PATH=/share/Container/brise ./scripts/deploy-nas.sh
#
# Required:
#   NAS_TYPE      one of: ugreen | synology | qnap | unraid | truenas
#   DEPLOY_HOST   NAS IP / hostname
#
# Optional:
#   DEPLOY_USER   SSH user (default: $USER)
#   DEPLOY_PATH   remote project path (default: <storage>/<profile subpath>)
#   SKIP_TEST     skip local vitest run (default: false)
#   ASSUME_YES    skip the wipe-confirm prompt (default: false)
#   APP_UID/APP_GID  UID/GID baked into the container (default: 1000, auto-overridden by share owner)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[brise]${NC} $*"; }
warn()  { echo -e "${YELLOW}[brise]${NC} $*"; }
step()  { echo -e "${BLUE}[brise]${NC} $*"; }
error() { echo -e "${RED}[brise]${NC} $*" >&2; exit 1; }

# ── Load NAS profile ──────────────────────────────────────────
NAS_TYPE="${NAS_TYPE:-}"
[ -z "$NAS_TYPE" ] && error "NAS_TYPE is required (ugreen | synology | qnap | unraid | truenas)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROFILE_FILE="$SCRIPT_DIR/nas-profiles/${NAS_TYPE}.sh"
[ -f "$PROFILE_FILE" ] || error "Unknown NAS_TYPE '$NAS_TYPE'. Available profiles: $(ls "$SCRIPT_DIR/nas-profiles" | sed 's/\.sh$//' | tr '\n' ' ')"

# shellcheck disable=SC1090
. "$PROFILE_FILE"

# ── Configuration ─────────────────────────────────────────────
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-$USER}"
DEPLOY_PATH="${DEPLOY_PATH:-}"
SKIP_TEST="${SKIP_TEST:-false}"
ASSUME_YES="${ASSUME_YES:-false}"
APP_UID="${APP_UID:-1000}"
APP_GID="${APP_GID:-1000}"

[ -z "$DEPLOY_HOST" ] && error "DEPLOY_HOST is required"
[ "$DEPLOY_USER" = "root" ] && warn "Deploying as root is discouraged — set DEPLOY_USER to a regular NAS user."

SSH_TARGET="$DEPLOY_USER@$DEPLOY_HOST"

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

info "Target: $NAS_LABEL @ $SSH_TARGET"

# ── SSH key setup ─────────────────────────────────────────────
SSH_KEY="$HOME/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
  warn "No SSH key found on this machine."
  echo -e "${BLUE}Generate a passphrase-less deploy key and copy it to the NAS? [Y/n]${NC} "
  read -r SETUP_KEY
  if [ "$SETUP_KEY" != "n" ] && [ "$SETUP_KEY" != "N" ]; then
    warn "Generating a key WITHOUT a passphrase — anyone with access to this machine can SSH to the NAS."
    ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -q
    info "Copying key to NAS..."
    ssh-copy-id "$SSH_TARGET" 2>/dev/null || warn "ssh-copy-id failed — run it manually later: ssh-copy-id $SSH_TARGET"
  fi
fi

# ── SSH multiplexing ──────────────────────────────────────────
SSH_DIR=$(mktemp -d "${TMPDIR:-/tmp}/brise-ssh.XXXXXX")
chmod 700 "$SSH_DIR"
SSH_SOCKET="$SSH_DIR/sock"
SSH_BASE_OPTS="-o ConnectTimeout=10 -o ControlMaster=auto -o ControlPath=$SSH_SOCKET -o ControlPersist=60"
SSH_CMD=(ssh $SSH_BASE_OPTS "$SSH_TARGET")

info "Opening SSH connection..."
ssh -M -f $SSH_BASE_OPTS "$SSH_TARGET" "echo connected" 2>/dev/null || {
  warn "SSH multiplexing failed — falling back to per-command connections"
  SSH_CMD=(ssh -o ConnectTimeout=10 "$SSH_TARGET")
}

cleanup_ssh() {
  ssh -S "$SSH_SOCKET" -O exit "$SSH_TARGET" 2>/dev/null || true
  rm -rf "$SSH_DIR" 2>/dev/null || true
}
trap cleanup_ssh EXIT

ssh_run() { "${SSH_CMD[@]}" "$@"; }

# ── Tests ─────────────────────────────────────────────────────
if [ "$SKIP_TEST" != "true" ]; then
  info "Running golden tests..."
  npx vitest run || error "Golden tests failed — aborting deploy"
  info "Tests passed ✓"
else
  warn "Skipping golden tests (SKIP_TEST=true)"
fi

# ── SSH connectivity ──────────────────────────────────────────
info "Checking SSH connection..."
if ! ssh_run "echo ok" >/dev/null 2>&1; then
  warn "Cannot connect via SSH. To enable on this NAS:"
  warn "  $ENABLE_SSH_HINT"
  error "SSH connection failed"
fi
info "SSH connection OK ✓"

# ── Docker on the NAS ─────────────────────────────────────────
info "Checking Docker on the NAS..."
SEARCH_PATHS_ARG="$DOCKER_SEARCH_PATHS"
DOCKER_PATH=$(ssh_run "
  for d in $SEARCH_PATHS_ARG; do
    if [ -x \"\$d/docker\" ]; then echo \"\$d\"; exit 0; fi
  done
  which docker 2>/dev/null || command -v docker 2>/dev/null
" 2>/dev/null | tr -d '[:space:]')

if [ -z "$DOCKER_PATH" ]; then
  warn "Docker not found on the NAS. Install hint:"
  warn "  $INSTALL_DOCKER_HINT"
  error "Docker not available on the NAS"
fi
DOCKER_BIN="$DOCKER_PATH/docker"

DOCKER_VER=$(ssh_run "'$DOCKER_BIN' --version" 2>/dev/null || true)
if [ -z "$DOCKER_VER" ]; then
  if ssh_run "sudo '$DOCKER_BIN' --version" >/dev/null 2>&1; then
    info "Docker is installed but your SSH user isn't in the docker group."
    info "Adding your user to the docker group (one-time)..."
    ssh_run "sudo usermod -aG docker \$(whoami)"
    warn "Group added. Reconnect SSH for it to take effect, then re-run this script."
    exit 0
  fi
  error "Docker binary found at $DOCKER_BIN but can't execute it. Check permissions."
fi
info "Docker on NAS: $DOCKER_VER ✓"

if ! ssh_run "'$DOCKER_BIN' compose version" >/dev/null 2>&1; then
  error "docker compose plugin missing on the NAS."
fi

# ── Deploy path ───────────────────────────────────────────────
if [ -z "$DEPLOY_PATH" ]; then
  info "Discovering NAS storage path..."
  STORAGE_ARG="$STORAGE_SEARCH_PATHS"
  NAS_BASE=$(ssh_run "
    for p in $STORAGE_ARG; do
      if [ -d \"\$p\" ]; then echo \"\$p\"; exit 0; fi
    done
  " 2>/dev/null | head -1 | tr -d '[:space:]')

  if [ -z "$NAS_BASE" ]; then
    warn "Could not auto-detect NAS storage path."
    echo -e "${BLUE}Enter the base storage path (e.g. /volume1):${NC} "
    read -r NAS_BASE
    [ -z "$NAS_BASE" ] && error "No path provided"
  fi

  DEPLOY_PATH="$NAS_BASE/$DEFAULT_DEPLOY_SUBPATH"
  info "Using path: $DEPLOY_PATH"
fi

case "$DEPLOY_PATH" in /*) ;; *) error "DEPLOY_PATH must be absolute, got: $DEPLOY_PATH" ;; esac
SEG_COUNT=$(echo "$DEPLOY_PATH" | awk -F/ '{c=0; for(i=2;i<=NF;i++) if($i!="") c++; print c}')
[ "$SEG_COUNT" -lt 3 ] && error "DEPLOY_PATH looks too shallow ($DEPLOY_PATH). Refuse to wipe — set a deeper path."
case "$DEPLOY_PATH" in *..*|*"*"*|*" "*) error "DEPLOY_PATH contains unsafe characters: $DEPLOY_PATH" ;; esac

info "Checking if $DEPLOY_PATH is writable..."
ssh_run "mkdir -p '$DEPLOY_PATH/data' '$DEPLOY_PATH/docs'" \
  || error "Cannot create $DEPLOY_PATH on the NAS. Check permissions or set DEPLOY_PATH manually."
info "Directories created ✓"

# ── Sync project files ────────────────────────────────────────
if [ "$ASSUME_YES" != "true" ]; then
  warn "About to wipe everything under $DEPLOY_PATH (except data/) on $SSH_TARGET."
  echo -e "${BLUE}Continue? [y/N]${NC} "
  read -r CONFIRM
  case "$CONFIRM" in y|Y|yes|YES) ;; *) error "Aborted by user" ;; esac
fi

info "Syncing project files (tar-over-ssh)..."
tar czf - \
  --exclude='node_modules' --exclude='.git' --exclude='data' \
  --exclude='dist' --exclude='.astro' --exclude='.env' \
  --exclude='.DS_Store' --exclude='*.log' --exclude='archive' \
  . | ssh_run "cd '$DEPLOY_PATH' && find . -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} + && tar xzf -"
info "Sync complete ✓"

# ── Build & ship image ────────────────────────────────────────
info "Detecting NAS CPU architecture..."
NAS_ARCH=$(ssh_run "uname -m" 2>/dev/null | tr -d '[:space:]')
[ -z "$NAS_ARCH" ] && { warn "Could not detect arch — assuming aarch64"; NAS_ARCH="aarch64"; }
info "NAS architecture: $NAS_ARCH"

case "$NAS_ARCH" in
  aarch64|arm64|armv8l) DOCKER_PLATFORM="linux/arm64" ;;
  x86_64|x64|amd64)     DOCKER_PLATFORM="linux/amd64" ;;
  *) warn "Unknown arch $NAS_ARCH — defaulting to arm64"; DOCKER_PLATFORM="linux/arm64" ;;
esac

SHARE_UID=$(ssh_run "stat -c %u '$DEPLOY_PATH/data' 2>/dev/null" | tr -d '[:space:]' || true)
SHARE_GID=$(ssh_run "stat -c %g '$DEPLOY_PATH/data' 2>/dev/null" | tr -d '[:space:]' || true)
[ -n "$SHARE_UID" ] && [ "$SHARE_UID" != "0" ] && APP_UID="$SHARE_UID"
[ -n "$SHARE_GID" ] && [ "$SHARE_GID" != "0" ] && APP_GID="$SHARE_GID"
info "Container will run as UID:GID $APP_UID:$APP_GID"

info "Building Docker image locally for $DOCKER_PLATFORM..."
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
docker build --platform "$DOCKER_PLATFORM" \
  --build-arg "APP_UID=$APP_UID" --build-arg "APP_GID=$APP_GID" \
  -t "brise:$GIT_SHA" \
  --label "org.brise.git-sha=$GIT_SHA" \
  --label "org.brise.build-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  .

info "Saving image to tarball..."
IMAGE_FILE=$(mktemp "${TMPDIR:-/tmp}/brise-image-XXXXXX.tar.gz")
trap 'rm -f "$IMAGE_FILE"; cleanup_ssh' EXIT
docker save "brise:$GIT_SHA" | gzip > "$IMAGE_FILE"
info "Image saved: $(du -h "$IMAGE_FILE" | cut -f1)"

info "Transferring image to NAS..."
gunzip -c "$IMAGE_FILE" | ssh_run "'$DOCKER_BIN' load"
info "Image loaded on NAS ✓"
rm -f "$IMAGE_FILE"

# ── Start container ───────────────────────────────────────────
info "Starting container on the NAS..."
ssh_run "cd '$DEPLOY_PATH' && '$DOCKER_BIN' compose up -d --no-build --pull never" 2>/dev/null || {
  warn "docker compose didn't match the image — starting container directly"
  ssh_run "'$DOCKER_BIN' rm -f brise 2>/dev/null || true"
  ssh_run "'$DOCKER_BIN' run -d --name brise --restart unless-stopped \
    -p 4321:4321 -p 4322:4322 \
    -v '$DEPLOY_PATH/data':/app/data \
    -e NODE_ENV=production -e HOST=0.0.0.0 -e PORT=4321 \
    'brise:$GIT_SHA'"
}

# ── Health check ──────────────────────────────────────────────
info "Waiting for the app to start..."
MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
  if ssh_run "curl -sf http://localhost:4321/api/health" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq "$MAX_WAIT" ]; then
    warn "App didn't respond within ${MAX_WAIT}s — check logs:"
    echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose logs'"
    exit 1
  fi
  sleep 2
done
info "Health check passed ✓"

# ── Summary ───────────────────────────────────────────────────
echo ""
info "╔══════════════════════════════════════════════════╗"
info "║  Brise deployed to $NAS_LABEL"
info "║  App:   http://$DEPLOY_HOST:4321"
info "║  Docs:  http://$DEPLOY_HOST:4322"
info "╚══════════════════════════════════════════════════╝"
echo ""
step "Manage via SSH:"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose logs -f'"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose restart'"
