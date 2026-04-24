---
title: Deployment
description: Deploy Brise with Docker or manually.
---

## Docker Compose (Recommended)

```bash
docker-compose up -d
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

## Manual Build

```bash
npm run build
node dist/server/entry.mjs
```

## NAS Deployment

Brise is designed for home-server and NAS deployments on trusted networks. The Docker container works on Synology, QNAP, and Unraid:

1. Install Docker via your NAS package manager
2. Create a container from the `docker-compose.yml`
3. Map volumes for `data/`, `personas/`, and `proxies/`
4. Set restart policy to "Always"

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
