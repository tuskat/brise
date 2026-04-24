---
title: Ugreen NAS (UGOS Pro)
description: Deploy Brise to a Ugreen NAS via SSH or Docker GUI.
---

## Prerequisites (One-Time Setup)

### 1. Install Docker on the NAS

- Open **UGOS Pro**
- Go to **App Center**
- Search for **Docker** (or **Container Manager**)
- Install it

### 2. Enable SSH on the NAS

- Open **UGOS Pro**
- Go to **Control Panel → Terminal & SNMP**
- Toggle **Enable SSH**
- Note the port (default: 22)
- The SSH user is the UGOS admin account (often `root`, or the UGOS username)

### 3. Set up SSH keys (important — prevents repeated password prompts)

Without SSH keys, **every** SSH and rsync command will ask for a password. Set up keys once to avoid this:

```bash
# Generate a key (if you don't have one already)
ssh-keygen -t ed25519

# Copy it to the NAS (enter the NAS password one last time)
ssh-copy-id root@NAS_IP

# Test it — should connect without asking for password
ssh root@NAS_IP 'echo connected'
```

If `ssh-copy-id` doesn't work (some UGOS versions restrict it), do it manually:

```bash
cat ~/.ssh/id_ed25519.pub | ssh root@NAS_IP 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys'
```

### 4. Find the NAS storage path

Ugreen NAS storage paths vary by model and firmware. The deploy script **auto-discovers** this, but it can also be set manually:

```bash
# SSH in and check what's available
ssh root@NAS_IP 'ls -d /volume* /media /mnt/media /shared 2>/dev/null'
```

Common paths:

| Model / Firmware | Typical base path |
|------------------|-------------------|
| UGOS Pro (newer) | `/volume1` |
| Some UGOS builds | `/media` |
| Alternative mount | `/mnt/media` or `/shared` |

The deploy script uses `{base_path}/docker/brise` by default. Override with `DEPLOY_PATH=/your/path npm run deploy:ugreen`.

---

## Approach 1: SSH Deploy (Recommended)

Fully scripted — one command. The image is built on your Mac for the NAS's architecture and piped over SSH, so **Docker Desktop must be running locally** before you start.

```bash
# Basic (auto-discovers storage path)
DEPLOY_HOST=NAS_IP npm run deploy:ugreen

# With custom user and path
DEPLOY_USER=admin DEPLOY_HOST=NAS_IP DEPLOY_PATH=/media/docker/brise npm run deploy:ugreen

# Skip golden tests (if you already ran them)
SKIP_TEST=true DEPLOY_HOST=NAS_IP npm run deploy:ugreen
```

**What the script does:**

| Step | What happens |
|------|-------------|
| 1 | Runs golden tests locally |
| 2 | Opens SSH multiplexed connection (one password prompt if no SSH key) |
| 3 | Checks Docker is installed on the NAS |
| 4 | Auto-discovers the NAS storage path (`/volume1`, `/media`, etc.) |
| 5 | Creates the project directory on the NAS (asks for confirmation before wiping stale files) |
| 6 | tars the project (excludes `node_modules/`, `data/`, `.git/`, `dist/`) and extracts it on the NAS |
| 7 | Builds the image **locally** for the NAS's architecture, then pipes it via `docker save` / `docker load` over SSH |
| 8 | Starts the container via `docker compose up -d --no-build` on the NAS |
| 9 | Health-checks `http://localhost:4321/api/health` |

**After deploy, visit:**

- **App:** `http://NAS_IP:4321`
- **Docs:** `http://NAS_IP:4322`

**Persistent data on the NAS:**

| NAS Path | Container Path | What it holds |
|----------|---------------|----------------|
| `{base}/docker/brise/data` | `/app/data` | SQLite database — history **and** personas / proxies |

Personas and proxies are now stored inside the SQLite DB rather than as loose JSON files. The container runs as a non-root user (UID 1000 by default) and automatically chowns `/app/data` on boot so bind-mount permissions just work.

**Managing the running container via SSH:**

```bash
# View logs
ssh root@NAS_IP 'cd /media/docker/brise && docker compose logs -f'

# Restart
ssh root@NAS_IP 'cd /media/docker/brise && docker compose restart'

# Stop
ssh root@NAS_IP 'cd /media/docker/brise && docker compose down'

# Update to latest code — just re-run the deploy script
DEPLOY_HOST=NAS_IP npm run deploy:ugreen
```

---

## Approach 2: UGOS Docker GUI (Manual, No SSH)

If you prefer the visual interface and don't want to use SSH.

### Step 1: Build a cross-architecture image

Ugreen NAS devices are typically **ARM64** (aarch64). Build for the target architecture:

```bash
# For ARM64 NAS (most Ugreen models)
PLATFORM=linux/arm64 npm run build:image

# For x86 NAS
PLATFORM=linux/amd64 npm run build:image
```

### Step 2: Export the image to a file

```bash
docker save brise:latest | gzip > brise-image.tar.gz
```

The file will be ~100–200 MB depending on the Node.js base image.

### Step 3: Upload to the NAS

**Option A — UGOS File Manager:**

- Open **UGOS Pro → File Manager**
- Navigate to a folder (e.g., the docker directory)
- Upload `brise-image.tar.gz`

**Option B — SCP:**

```bash
scp brise-image.tar.gz root@NAS_IP:/media/docker/
```

### Step 4: Import the image in UGOS Docker UI

- Open **UGOS Pro → Container Manager** (or Docker)
- Go to the **Images** tab
- Click **Import**
- Browse to `brise-image.tar.gz` and import
- Wait for the import to complete

### Step 5: Create the container

In the UGOS Docker UI, click **Create Container** from the imported image, and configure:

**Ports (Port Forwarding):**

| Host Port | Container Port | Protocol |
|-----------|---------------|----------|
| 4321 | 4321 | TCP |
| 4322 | 4322 | TCP |

**Volumes (Storage Mapping):**

| Host Path (NAS) | Container Path | Read/Write |
|-----------------|---------------|------------|
| `/your/path/brise/data` | `/app/data` | Read+Write |

(Only `data/` needs mounting — personas and proxies live in the SQLite DB alongside history.)

**Environment Variables:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `4321` |

**Create the NAS folders first** (via UGOS File Manager or SSH) before mapping them.

### Step 6: Start and test

- Click **Start** in the Docker UI
- Wait ~10 seconds for the Node server to start
- Visit `http://NAS_IP:4321` in a browser

**Managing the container:**

All of this is available in the UGOS Docker GUI:

- **Start / Stop / Restart** — container controls
- **Logs** — click the container → Logs tab
- **Terminal** — open a shell inside the container
- **Resource usage** — CPU/memory stats

---

## Updating to a New Version

### If using SSH deploy (Approach 1):

```bash
# Just re-run — it rsyncs fresh code and rebuilds
DEPLOY_HOST=NAS_IP npm run deploy:ugreen
```

Data, personas, and proxies are preserved — they all live in `data/history.db`, which is bind-mounted and never touched by the sync.

### If using GUI deploy (Approach 2):

1. Rebuild the image: `PLATFORM=linux/arm64 npm run build:image`
2. Export: `docker save brise:latest | gzip > brise-image.tar.gz`
3. Upload to NAS
4. In UGOS Docker UI: stop the old container → delete it → import new image → recreate container (same volume mappings)
5. Data persists because it's in the mounted volumes

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| `failed to connect to the docker API at unix:///.../docker.sock` | Docker Desktop isn't running on your Mac | Open the Docker Desktop app; run `docker info` to confirm, then re-run the deploy |
| Password asked every step | No SSH key set up | Run `ssh-keygen -t ed25519 && ssh-copy-id root@NAS_IP` |
| `invalid path: /volume1/...` | NAS doesn't use `/volume1` | Set `DEPLOY_PATH=/media/docker/brise` or let script auto-discover |
| `DEPLOY_PATH looks too shallow` | Auto-discovery returned `/` or a 1-2 segment path | Set `DEPLOY_PATH=` explicitly to something at least 3 segments deep |
| Can't SSH into NAS | SSH not enabled | UGOS Pro → Control Panel → Terminal & SNMP → Enable SSH |
| `docker: command not found` | Docker not installed | App Center → Install Docker / Container Manager |
| `docker compose` not found | Older Docker version | Install Container Manager via UGOS App Center |
| `rm: cannot remove 'data/history.db': Permission denied` during sync | Files left over from an older deploy that ran the container as root | SSH to the NAS and `sudo chown -R 1000:1000 /volume1/docker/brise` — then re-run |
| `addgroup: gid '1000' in use` during image build | Stale `APP_UID=0` detected from a root-owned volume | The script now ignores UID 0; update to the latest script and re-run |
| Container exits immediately | Port conflict or missing dirs | Check logs: UGOS Docker UI → container → Logs |
| Can't reach `http://NAS_IP:4321` | Firewall blocking port | UGOS Pro → Security → Firewall — allow 4321, 4322 |
| Database empty on restart | Data volume not mounted | Make sure `/app/data` is mapped to a persistent NAS folder |
| Docs site (port 4322) stuck in redirect loop | Old image served SPA-mode static; missing for newer builds | Rebuild with the current Dockerfile — `serve` no longer uses `-s` |
| Personas fail to load / save | Old bind-mount `personas/` still around on NAS | Safe to delete: `rm -rf /volume1/docker/brise/personas` — data moved to SQLite |
| Image won't import in GUI | Wrong CPU architecture | Rebuild with correct `PLATFORM=linux/arm64` (or `amd64`) |
| Build fails on NAS (`npm ci`) | No internet on NAS | The default flow builds locally and transfers the image — no NAS internet needed |

### Collecting logs

If the container is misbehaving, grab a recent log slice:

```bash
ssh root@NAS_IP 'docker logs brise --tail 100'

# or follow live while you reproduce
ssh root@NAS_IP 'docker logs -f brise'
```

The container runs `serve` (docs, port 4322) and `node` (app, port 4321) side by side, so you'll see both streams interleaved.
