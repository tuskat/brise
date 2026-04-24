---
title: Architecture
description: High-level system architecture of Brise.
---

## System Pattern

Brise follows a **"Centralized Proxy & Observability"** pattern — it never runs an LLM itself, it orchestrates:

- **The Controller (Brise)** — A Dockerized web app. Orchestrates prompts, manages personas, logs results.
- **The Workers (LLMs)** — External nodes (Ollama on LAN, NVIDIA NIM, cloud APIs) that receive standardized requests.
- **The Registry (Personas)** — JSON files defining *how* the LLM should behave (system prompt + hyperparameters).
- **The Ledger (History)** — SQLite recording every Playground interaction for performance and quality auditing.

## Data Flow

```
Playground ──POST──▶ /api/proxy ──▶ forwardToProxy() ──▶ LLM
                                    │
                                    └──▶ logInteraction() ──▶ prompt_logs
                                           │
                                           ├──▶ /api/history   (History view)
                                           └──▶ /api/metrics   (Dashboard)

Chat ──POST──▶ /api/chat/:id/messages ──▶ chatWithProxy() ──▶ LLM
                                              │
                                              └──▶ conversation_messages (only)
```

Key design rule: **Chat does NOT write to `prompt_logs`**. Playground does. History & Dashboard only see Playground data.

## Dual-Build Architecture

The project has two independent Astro builds:

| | Main App (root) | Docs (`docs/`) |
|---|---|---|
| **Astro mode** | SSR (`output: 'server'`) | Static (`output: 'static'`) |
| **Port** | 4321 | 4322 |
| **Own `package.json`** | Yes | Yes |
| **Own `astro.config.mjs`** | Yes | Yes |

In Docker, both run in a single container: main app via Node, docs via `serve`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ESM) |
| Framework | Astro 6 (SSR, `@astrojs/node` adapter) |
| Frontend | Vanilla JS (ES modules) + CSS custom properties |
| Database | SQLite (`better-sqlite3`) — single file in `/data/` |
| LLM Backend | Ollama REST API + OpenAI-compatible APIs |
| Docs | Astro Starlight (separate static build) |
| Runtime | Docker |

## Frontend Architecture

- **No framework** — vanilla JS organized as ES modules in `src/utils/`
- **Astro = HTML only** — components contain structure, not logic
- **CSS in `src/styles/`** — chunked files with theme tokens, utilities, and per-tab styles
- **State modules** — each domain has a `*-state.js` (CRUD + modal management) and `*-dom.js` (rendering)
- **Tab switching** — `tab-nav.js` orchestrates sidebar, theme toggle, and per-view initialization via `window.*` hooks

## Database

Two SQLite access modules share the same `data/history.db` file:

| Module | Tables | Used by |
|--------|--------|---------|
| `src/lib/db.js` | `prompt_logs` | Playground, History, Metrics, Export |
| `src/db/index.js` | `conversations`, `conversation_messages` | Chat API |
