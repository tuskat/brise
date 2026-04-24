---
title: API Overview
description: REST API reference for Brise.
---

All API responses follow this envelope:

```json
{
  "status": "success" | "error",
  "data": {},
  "latency_ms": 123
}
```

## Endpoints

### Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proxy` | Legacy prompt endpoint |
| GET | `/api/proxies` | List proxies |
| POST | `/api/proxies` | Create proxy |
| PUT | `/api/proxies` | Update proxy |
| DELETE | `/api/proxies` | Delete proxy |
| POST | `/api/proxies/test` | Test connection |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/:id` | Get conversation |
| DELETE | `/api/chat/:id` | Delete conversation |
| POST | `/api/chat/:id/messages` | Send message (SSE stream) |
| PUT | `/api/chat/:id/title` | Rename conversation |

### History & Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | Prompt logs |
| GET | `/api/metrics` | Dashboard stats |
