---
title: Configuration
description: Configure proxies and personas for GCC.
---

## Proxies

Proxy configurations live in `/proxies/*.json`. Each proxy defines a connection to an LLM backend.

### Example: Local Ollama

```json
{
  "id": "ollama-local",
  "name": "Ollama Local",
  "url": "http://192.168.1.100:11434/api/generate",
  "model": "gemma4:e2b",
  "is_local_network": true,
  "api_key": null
}
```

### Example: Cloud Provider

```json
{
  "id": "groq-llama",
  "name": "Groq Llama",
  "url": "https://api.groq.com/openai/v1/chat/completions",
  "model": "llama3-70b-8192",
  "is_local_network": false,
  "api_key": "gsk_..."
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `url` | string | API endpoint URL |
| `model` | string | Model name |
| `is_local_network` | boolean | Whether the proxy is on LAN |
| `api_key` | string \| null | API key (nullable for local) |

## Personas

Persona configurations live in `/personas/*.json`.

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
| `temperature` | number | Sampling randomness (0–2) |
| `top_p` | number | Nucleus sampling (0–1) |
| `max_tokens` | number | Maximum response length |
