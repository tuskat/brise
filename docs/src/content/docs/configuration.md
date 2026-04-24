---
title: Configuration
description: Configure proxies and personas for Brise.
---

## Proxies

Proxy configurations live in `/proxies/*.json`. Each proxy defines a connection to an LLM backend. Proxies can be managed via the UI (Proxies tab) or by editing the JSON files directly.

### Example: Local Ollama (Native Schema)

```json
{
  "id": "ollama-local",
  "name": "Ollama Local",
  "url": "http://192.168.1.100:11434/api/generate",
  "model": "your-model",
  "is_local_network": true,
  "api_key": null,
  "api_schema": "ollama"
}
```

### Example: Cloud Provider (OpenAI-Compatible Schema)

```json
{
  "id": "groq-llama",
  "name": "Groq Llama",
  "url": "https://api.groq.com/openai/v1/chat/completions",
  "model": "llama3-70b-8192",
  "is_local_network": false,
  "api_key": "gsk_...",
  "api_schema": "openai"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (auto-generated from name) |
| `name` | string | Display name |
| `url` | string | Full API endpoint URL |
| `model` | string | Default model to use with this proxy |
| `is_local_network` | boolean | `true` for LAN (no API key), `false` for cloud providers |
| `api_key` | string \| null | API key (null for local proxies) |
| `api_schema` | string | `"ollama"` for native Ollama, `"openai"` for OpenAI-compatible APIs |

### Supported API Schemas

- **Ollama (Native)** — `/api/generate` or `/api/chat` endpoints on local Ollama instances
- **OpenAI-Compatible** — `/v1/chat/completions` endpoints (Groq, LM Studio, NVIDIA NIM, OpenAI, etc.)

## Personas

Persona configurations live in `/personas/*.json`. Personas can be managed via the UI (Personas tab) or by editing the JSON files directly.

```json
{
  "id": "coder-pro",
  "name": "Senior Software Engineer",
  "system_prompt": "You are an expert software engineer...",
  "parameters": {
    "temperature": 0.2,
    "top_p": 0.9,
    "max_tokens": 2000
  }
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature` | number | Sampling randomness (0–2). Lower = more deterministic, higher = more creative |
| `top_p` | number | Nucleus sampling threshold (0–1). Controls diversity of token selection |
| `max_tokens` | number | Maximum response length in tokens |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `4321` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATA_DIR` | `./data` | SQLite database directory |
