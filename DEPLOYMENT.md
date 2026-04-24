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

### Synology NAS

1. Install Docker via Package Center
2. Open Docker app → Registry → Search for image
3. Create container with:
   - Port: 4321
   - Volumes: Map host folders to container paths
4. Set restart policy to "Always"

### QNAP NAS

1. Install Container Station
2. Create container from `docker-compose.yml`
3. Map volumes to NAS storage

### Unraid

1. Go to Docker tab
2. Add Container
3. Use template or manual configuration
4. Map app config directories

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

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build
```

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
