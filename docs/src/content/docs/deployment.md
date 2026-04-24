---
title: Deployment
description: Deploy Brise with Docker or manually.
---

## Docker Compose (Recommended)

```bash
docker compose up -d --build
```

This starts the main app on port **4321** and the docs site on port **4322**.

### Volumes

| Host | Container | Description |
|------|-----------|-------------|
| `./data` | `/app/data` | SQLite database |
| `./personas` | `/app/personas` | Persona configs |
| `./proxies` | `/app/proxies` | Proxy configs |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `4321` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `DATA_DIR` | `/app/data` | SQLite database directory |

## Deploy Scripts

| Script | Command | What it does |
|--------|---------|-------------|
| Smoke test | `npm run smoke` | Golden tests → Docker build → health-check all 8 endpoints |
| Build image | `npm run build:image` | Docker build with git SHA label, optional cross-arch + push |
| Generic deploy | `npm run deploy` | rsync to remote host → `docker compose up -d --build` |
| Ugreen NAS | `npm run deploy:ugreen` | NAS-specific SSH deploy with Docker checks |

### Cross-Architecture Build (e.g. x86 → ARM NAS)

```bash
PLATFORM=linux/arm64 npm run build:image
```

### Push to a Private Registry

```bash
REGISTRY=registry.local:5000 PUSH=true npm run build:image
```

## NAS Deployment

Brise is designed for home-server and NAS deployments on trusted networks.

- **[Ugreen NAS (UGOS Pro) →](ugreen-nas/)** — step-by-step for SSH or Docker GUI deploy
- **Synology / QNAP / Unraid** — standard Docker Compose: install Docker via package manager, create container from `docker-compose.yml`, map volumes for `data/`, `personas/`, `proxies/`

## Manual Build (No Docker)

```bash
npm run build
node dist/server/entry.mjs
```

## Reverse Proxy

For remote access, place Brise behind Nginx or Traefik with HTTPS and basic auth:

```nginx
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
        auth_basic "Brise";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

## Health Check

```bash
curl http://localhost:4321/api/health
```

Returns:

```json
{"status": "ok"}
```

## Security Warning

Brise does **not** implement authentication, rate limiting, or API key encryption. It is designed for **trusted networks only**. See [SECURITY.md](https://github.com/cedricmarcellin/brise/blob/main/SECURITY.md) for details.
