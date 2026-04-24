#!/usr/bin/env bash
set -euo pipefail

# Deploy Brise to a Ugreen NAS via SSH
#
# Usage:
#   DEPLOY_HOST=192.168.1.50 ./scripts/deploy-ugreen.sh
#   DEPLOY_HOST=192.168.1.50 DEPLOY_USER=admin ./scripts/deploy-ugreen.sh
#   DEPLOY_HOST=192.168.1.50 DEPLOY_PATH=/your/nas/path/brise ./scripts/deploy-ugreen.sh
#
# Environment:
#   DEPLOY_HOST    NAS IP / hostname (required)
#   DEPLOY_USER    SSH user (default: current $USER — NOT root)
#   DEPLOY_PATH    Remote project path (auto-discovered if empty)
#   SKIP_TEST      Skip local vitest run (default: false)
#   ASSUME_YES     Skip interactive confirmation before the remote wipe
#   APP_UID/APP_GID  UID/GID baked into the container (default: 1000)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[brise]${NC} $*"; }
warn()  { echo -e "${YELLOW}[brise]${NC} $*"; }
step()  { echo -e "${BLUE}[brise]${NC} $*"; }
error() { echo -e "${RED}[brise]${NC} $*" >&2; exit 1; }

# ── Configuration ──────────────────────────────────────────────
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-$USER}"
DEPLOY_PATH="${DEPLOY_PATH:-}"
SKIP_TEST="${SKIP_TEST:-false}"
ASSUME_YES="${ASSUME_YES:-false}"
APP_UID="${APP_UID:-1000}"
APP_GID="${APP_GID:-1000}"

if [ "$DEPLOY_USER" = "root" ]; then
  warn "Deploying as root is discouraged — set DEPLOY_USER to a regular NAS user."
fi

if [ -z "$DEPLOY_HOST" ]; then
  echo -e "${BLUE}Enter your Ugreen NAS IP or hostname:${NC} "
  read -r DEPLOY_HOST
  [ -z "$DEPLOY_HOST" ] && error "No host provided"
fi

SSH_TARGET="$DEPLOY_USER@$DEPLOY_HOST"

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

# ── Step 0: SSH key setup ─────────────────────────────────────
SSH_KEY="$HOME/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
  echo ""
  warn "No SSH key found on this Mac."
  echo -e "${BLUE}Generate a passphrase-less deploy key and copy it to the NAS? [Y/n]${NC} "
  read -r SETUP_KEY
  if [ "$SETUP_KEY" != "n" ] && [ "$SETUP_KEY" != "N" ]; then
    warn "Generating a key WITHOUT a passphrase — anyone with access to this Mac can SSH to the NAS."
    ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -q
    info "Copying key to NAS (enter your NAS password one last time)..."
    ssh-copy-id "$SSH_TARGET" 2>/dev/null || {
      warn "ssh-copy-id failed — you'll need to enter your password for each step."
      warn "To fix later, run: ssh-copy-id $SSH_TARGET"
    }
  fi
fi

# ── SSH multiplexing — one password prompt only ────────────────
SSH_DIR=$(mktemp -d "${TMPDIR:-/tmp}/brise-ssh.XXXXXX")
chmod 700 "$SSH_DIR"
SSH_SOCKET="$SSH_DIR/sock"
SSH_BASE_OPTS="-o ConnectTimeout=10 -o ControlMaster=auto -o ControlPath=$SSH_SOCKET -o ControlPersist=60"
SSH_CMD=(ssh $SSH_BASE_OPTS "$SSH_TARGET")

info "Opening SSH connection to $SSH_TARGET..."
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

# ── Step 1: Run golden tests ───────────────────────────────────
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
if ! ssh_run "echo ok" >/dev/null 2>&1; then
  echo ""
  warn "Cannot connect via SSH. Make sure SSH is enabled on the Ugreen NAS:"
  warn "  UGOS Pro → Control Panel → Terminal & SNMP → Enable SSH"
  error "SSH connection failed"
fi
info "SSH connection OK ✓"

# ── Step 3: Verify Docker on the NAS ──────────────────────────
info "Checking Docker on the NAS..."
DOCKER_PATH=$(ssh_run "
  for d in /usr/bin /usr/local/bin /usr/libexec/docker /opt/bin /volume1/@appstore/Docker/usr/bin /volume1/@appstore/ContainerManager/usr/bin; do
    if [ -x \"\$d/docker\" ]; then echo \"\$d\"; exit 0; fi
  done
  which docker 2>/dev/null || command -v docker 2>/dev/null
" 2>/dev/null | tr -d '[:space:]')

if [ -z "$DOCKER_PATH" ]; then
  echo ""
  warn "Docker not found on the NAS. Install it via:"
  warn "  UGOS Pro → App Center → search 'Docker' → Install"
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
  error "docker compose not found on the NAS. Install Container Manager via UGOS App Center."
fi

# ── Step 4: Discover (and sanity-check) the deploy path ───────
if [ -z "$DEPLOY_PATH" ]; then
  info "Discovering NAS storage path..."
  NAS_BASE=$(ssh_run "
    for p in /volume1 /media /mnt/media /shared; do
      if [ -d \"\$p\" ]; then echo \"\$p\"; exit 0; fi
    done
  " 2>/dev/null | head -1 | tr -d '[:space:]')

  if [ -z "$NAS_BASE" ]; then
    echo ""
    warn "Could not auto-detect the NAS storage path."
    echo -e "${BLUE}Enter the base storage path on your NAS (e.g. /volume1):${NC} "
    read -r NAS_BASE
    [ -z "$NAS_BASE" ] && error "No path provided"
  fi

  DEPLOY_PATH="$NAS_BASE/docker/brise"
  info "Using path: $DEPLOY_PATH"
fi

# Sanity-check the deploy path: must be absolute and reasonably deep.
case "$DEPLOY_PATH" in
  /*) ;;
  *) error "DEPLOY_PATH must be absolute, got: $DEPLOY_PATH" ;;
esac
# Count path segments — reject anything shallower than /a/b/c
SEG_COUNT=$(echo "$DEPLOY_PATH" | awk -F/ '{c=0; for(i=2;i<=NF;i++) if($i!="") c++; print c}')
if [ "$SEG_COUNT" -lt 3 ]; then
  error "DEPLOY_PATH looks too shallow ($DEPLOY_PATH). Refuse to wipe — set a deeper path."
fi
case "$DEPLOY_PATH" in
  *..*|*"*"*|*" "*) error "DEPLOY_PATH contains unsafe characters: $DEPLOY_PATH" ;;
esac

# Verify writable
info "Checking if $DEPLOY_PATH is writable..."
ssh_run "mkdir -p '$DEPLOY_PATH/data' '$DEPLOY_PATH/personas' '$DEPLOY_PATH/proxies' '$DEPLOY_PATH/docs'" \
  || error "Cannot create $DEPLOY_PATH on the NAS. Check permissions or set DEPLOY_PATH manually."
info "Directories created ✓"

# ── Step 5: Sync project files ─────────────────────────────────
if [ "$ASSUME_YES" != "true" ]; then
  warn "About to wipe everything under $DEPLOY_PATH (except data/, personas/, proxies/) on $SSH_TARGET."
  echo -e "${BLUE}Continue? [y/N]${NC} "
  read -r CONFIRM
  case "$CONFIRM" in
    y|Y|yes|YES) ;;
    *) error "Aborted by user" ;;
  esac
fi

info "Syncing project files to NAS (tar-over-ssh)..."
tar czf - \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='data' \
  --exclude='dist' \
  --exclude='.astro' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='archive' \
  . | ssh_run "cd '$DEPLOY_PATH' && find . -mindepth 1 -maxdepth 1 ! -name data ! -name personas ! -name proxies -exec rm -rf {} + && tar xzf -"
info "Sync complete ✓"

# ── Step 6: Build image and transfer to NAS ─────────────────────
info "Detecting NAS CPU architecture..."
NAS_ARCH=$(ssh_run "uname -m" 2>/dev/null | tr -d '[:space:]')
if [ -z "$NAS_ARCH" ]; then
  warn "Could not detect NAS architecture — assuming aarch64 (ARM64)"
  NAS_ARCH="aarch64"
fi
info "NAS architecture: $NAS_ARCH"

case "$NAS_ARCH" in
  aarch64|arm64|armv8l) DOCKER_PLATFORM="linux/arm64" ;;
  x86_64|x64|amd64)     DOCKER_PLATFORM="linux/amd64" ;;
  *)                    warn "Unknown arch $NAS_ARCH — defaulting to arm64"; DOCKER_PLATFORM="linux/arm64" ;;
esac

# Detect the UID/GID that owns the NAS share so volumes match the container user
SHARE_UID=$(ssh_run "stat -c %u '$DEPLOY_PATH/data' 2>/dev/null" | tr -d '[:space:]' || true)
SHARE_GID=$(ssh_run "stat -c %g '$DEPLOY_PATH/data' 2>/dev/null" | tr -d '[:space:]' || true)
[ -n "$SHARE_UID" ] && APP_UID="$SHARE_UID"
[ -n "$SHARE_GID" ] && APP_GID="$SHARE_GID"
info "Container will run as UID:GID $APP_UID:$APP_GID (to match NAS share ownership)"

info "Building Docker image locally for $DOCKER_PLATFORM..."
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
docker build --platform "$DOCKER_PLATFORM" \
  --build-arg "APP_UID=$APP_UID" \
  --build-arg "APP_GID=$APP_GID" \
  -t "brise:$GIT_SHA" \
  --label "org.brise.git-sha=$GIT_SHA" \
  --label "org.brise.build-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  .

info "Saving image to tarball..."
IMAGE_FILE=$(mktemp "${TMPDIR:-/tmp}/brise-image-XXXXXX.tar.gz")
trap 'rm -f "$IMAGE_FILE"; cleanup_ssh' EXIT
docker save "brise:$GIT_SHA" | gzip > "$IMAGE_FILE"
IMAGE_SIZE=$(du -h "$IMAGE_FILE" | cut -f1)
info "Image saved: $IMAGE_FILE [$IMAGE_SIZE]"

info "Transferring image to NAS via SSH pipe..."
gunzip -c "$IMAGE_FILE" | ssh_run "'$DOCKER_BIN' load"
info "Image loaded on NAS ✓"
rm -f "$IMAGE_FILE"

# ── Step 7: Start the container on the NAS ────────────────────────
info "Starting container on the NAS..."
ssh_run "cd '$DEPLOY_PATH' && '$DOCKER_BIN' compose up -d --no-build --pull never" 2>/dev/null || {
  warn "docker compose didn't match the image — starting container directly"
  ssh_run "'$DOCKER_BIN' rm -f brise 2>/dev/null || true"
  ssh_run "'$DOCKER_BIN' run -d \
    --name brise \
    --restart unless-stopped \
    -p 4321:4321 \
    -p 4322:4322 \
    -v '$DEPLOY_PATH/data':/app/data \
    -v '$DEPLOY_PATH/personas':/app/personas \
    -v '$DEPLOY_PATH/proxies':/app/proxies \
    -e NODE_ENV=production \
    -e HOST=0.0.0.0 \
    -e PORT=4321 \
    'brise:$GIT_SHA'"
}

# ── Step 8: Wait for health check ──────────────────────────────
info "Waiting for the app to start..."
MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
  HEALTH=$(ssh_run "curl -sf http://localhost:4321/api/health" 2>/dev/null || echo "")
  if [ -n "$HEALTH" ]; then
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

# ── Summary ────────────────────────────────────────────────────
NAS_IP="$DEPLOY_HOST"
echo ""
info "╔══════════════════════════════════════════════════╗"
info "║  Brise deployed to your Ugreen NAS!              ║"
info "╠══════════════════════════════════════════════════╣"
info "║  App:   http://$NAS_IP:4321                     ║"
info "║  Docs:  http://$NAS_IP:4322                     ║"
info "╚══════════════════════════════════════════════════╝"
echo ""
step "Manage via SSH:"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose logs -f'"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose restart'"
echo "  ssh $SSH_TARGET 'cd $DEPLOY_PATH && docker compose down'"
