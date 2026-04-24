---
title: Brise
description: Documentation for the self-hosted AI observability platform.
---

Welcome to the **Brise** documentation.

Brise is a self-hosted AI observability platform that proxies and orchestrates multiple LLM backends through a persona-driven interface. Run it on your home server, NAS, or dev machine — no cloud dependency, no vendor lock-in.

## What is Brise?

- **Multi-Proxy Support** — Configure and switch between Ollama, OpenAI-compatible, Groq, LM Studio, and more
- **Persona System** — Pre-configured system prompts with per-persona hyperparameters (temperature, top_p, max_tokens)
- **Conversation Chat** — Multi-turn chat with SSE streaming, conversation history, and per-message latency tracking
- **Playground** — Single-shot and batch prompt testing with multi-format output extraction (code, JSON, CSV, HTML, Markdown)
- **Observability** — SQLite-based request logging with metrics dashboard, export, and activity timeline
- **Self-Hosted First** — Designed for trusted networks. No auth required on LAN; reverse-proxy with basic auth for remote access

## Quick Links

- [Getting Started](/getting-started)
- [Configuration](/configuration)
- [Deployment](/deployment)
- [API Reference](/api-overview)
- [Architecture](/architecture)
