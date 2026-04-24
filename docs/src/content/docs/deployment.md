---
title: Deployment
description: Deploy GCC with Docker or manually.
---

## Docker Compose (Recommended)

```bash
docker-compose up -d
```

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

## Manual Build

```bash
npm run build
node dist/server/entry.mjs
```

## Reverse Proxy

For HTTPS and authentication, place GCC behind Nginx or Traefik with basic auth.

```nginx
server {
    listen 443 ssl;
    location / {
        proxy_pass http://localhost:4321;
        proxy_http_version 1.1;
        auth_basic "GCC";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```
