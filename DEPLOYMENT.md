# Docker Deployment

## Quick Start

1. Clone the repository
2. Run `docker-compose up -d`
3. Access at `http://localhost:4321`

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `4321` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `DATA_DIR` | `/app/data` | SQLite database directory |

### Volumes

| Volume | Container Path | Description |
|--------|----------------|-------------|
| `./data` | `/app/data` | SQLite database |
| `./personas` | `/app/personas` | Persona configs |
| `./proxies` | `/app/proxies` | Proxy configs |

## Building

### Using Docker Compose (Recommended)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Build

```bash
# Build image
docker build -t brise .

# Run container
docker run -d \
  --name brise \
  -p 4321:4321 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/personas:/app/personas \
  -v $(pwd)/proxies:/app/proxies \
  -e NODE_ENV=production \
  brise
```

## NAS Deployment

Brise ships with a generic NAS deploy script that builds the image locally on
your Mac, ships it to the NAS over SSH, and starts the container. No git or
Node.js is required on the NAS — only Docker.

### One-shot deploy / update

```bash
NAS_TYPE=ugreen DEPLOY_HOST=192.168.1.50 ./scripts/deploy-nas.sh
```

Supported `NAS_TYPE` values: `ugreen`, `synology`, `qnap`, `unraid`, `truenas`.
Each is just a small profile in `scripts/nas-profiles/` that lists where Docker
and the storage volumes live on that NAS — adding a new one is a single file.

For routine updates, edit `scripts/update.sh` once with your `NAS_TYPE` and
`DEPLOY_HOST`, then just run:

```bash
./scripts/update.sh
```

### Per-NAS prerequisites

| NAS | Enable SSH | Install Docker |
|-----|-----------|----------------|
| Ugreen (UGOS Pro) | Control Panel → Terminal & SNMP | App Center → Docker |
| Synology (DSM 7.2+) | Control Panel → Terminal & SNMP | Package Center → Container Manager |
| QNAP (QTS) | Control Panel → Network & File Services → Telnet/SSH | App Center → Container Station |
| Unraid | Settings → Management Access → SSH | Built in (Settings → Docker) |
| TrueNAS SCALE | System Settings → Services → SSH | Built in (24.10+) |

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NAS_TYPE` | yes | one of the values above |
| `DEPLOY_HOST` | yes | NAS IP or hostname |
| `DEPLOY_USER` | no | SSH user (default: `$USER`) |
| `DEPLOY_PATH` | no | remote project path (auto-discovered from profile) |
| `SKIP_TEST` | no | skip local vitest run |
| `ASSUME_YES` | no | skip wipe-confirmation prompt |

## Production Considerations

### Reverse Proxy (Optional)

For HTTPS and authentication:

```nginx
# Nginx example
server {
    listen 443 ssl;
    server_name brise.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:4321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
    
    # Add basic auth
    auth_basic "Brise Access";
    auth_basic_user_file /path/to/.htpasswd;
}
```

### Backup

```bash
# Backup data directory
tar -czf brise-backup.tar.gz data/ personas/ proxies/

# Restore
tar -xzf brise-backup.tar.gz
```

### Updating

For local Docker installs:

```bash
git pull
docker-compose up -d --build
```

For NAS installs, see [NAS Deployment](#nas-deployment) above — `./scripts/update.sh`
handles the full pull → rebuild → ship → restart cycle from your dev machine.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Verify volumes exist
ls -la data/ personas/ proxies/
```

### Can't connect to Ollama

Ensure Ollama is accessible from container:
```bash
# Check network
docker exec -it brise curl http://host.docker.internal:11434/api/tags
```

### Permission issues

```bash
# Fix permissions
sudo chown -R 1000:1000 data/ personas/ proxies/
```

## Health Check

```bash
curl http://localhost:4321/api/health
```

Returns:
```json
{"status": "ok"}
```
