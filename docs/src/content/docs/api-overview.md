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

Error responses include an `error` field instead of `data`:

```json
{
  "status": "error",
  "error": "Description of what went wrong"
}
```

## Endpoints

### Proxy Gateway

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proxy` | Send a single-shot prompt to the selected LLM (Playground). Logged to `prompt_logs`. |

### Proxy Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proxies` | List all proxies |
| POST | `/api/proxies` | Create proxy |
| PUT | `/api/proxies` | Update proxy (masked API keys are rejected) |
| DELETE | `/api/proxies` | Delete proxy |
| POST | `/api/proxies/test` | Test proxy connection (returns latency + model list) |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas |
| POST | `/api/personas` | Create persona |
| PUT | `/api/personas` | Update persona |
| DELETE | `/api/personas` | Delete persona |

### Chat

Chat messages are stored in `conversation_messages` only — they do **not** appear in History or Dashboard.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/conversations` | Create conversation (with persona + proxy selection) |
| GET | `/api/chat/:id` | Get conversation with messages |
| DELETE | `/api/chat/:id` | Delete conversation |
| POST | `/api/chat/:id/messages` | Send message (SSE streaming response) |
| PUT | `/api/chat/:id/title` | Rename conversation |

### History & Metrics

These endpoints read from `prompt_logs` (Playground only — Chat data is separate).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | List prompt logs (supports `?limit=N`) |
| GET | `/api/history/:id/download?file=N` | Download extracted file from a playground response |
| GET | `/api/metrics` | Dashboard statistics (total prompts, success rate, avg latency, persona usage) |

### Export & Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export?format=json\|csv` | Export prompt history |
| GET | `/api/health` | Health check (`{"status":"ok"}`) |

## SSE Streaming (Chat)

`POST /api/chat/:id/messages` returns a server-sent events stream:

```
event: token
data: {"content": "Hello"}

event: meta
data: {"latency": 1234, "status": "success"}

event: done
data: {}
```

## API Key Masking

API keys are masked as `********` (ASCII asterisks) in all responses. When updating a proxy, submitting an all-asterisk key preserves the existing key — no need to re-enter it.
