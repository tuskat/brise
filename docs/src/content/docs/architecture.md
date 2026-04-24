---
title: Architecture
description: High-level system architecture of GCC.
---

## System Pattern

GCC follows a **"Centralized Proxy & Observability"** pattern:

- **The Controller (The App):** Dockerized web app running on your NAS. Orchestrates prompts, manages settings, logs results.
- **The Workers (The LLMs):** External nodes (Ollama via IP, NVIDIA NIM, cloud APIs) receiving standardized requests.
- **The Registry (Personas):** JSON files defining *how* the LLM should behave.
- **The Ledger (History):** SQLite database recording every interaction.

## Data Flow

1. User selects a **Persona** and **Proxy**
2. User sends a message via the Chat or Playground UI
3. The app fetches the persona's `system_prompt` and parameters
4. The **Proxy Gateway** formats the payload for the target LLM schema (Ollama or OpenAI)
5. The request is forwarded to the LLM backend
6. The **Observability Engine** logs the interaction to SQLite
7. The response is streamed back to the UI

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Astro 6 + Vue 3 + Tailwind CSS |
| Backend | Node.js (Astro SSR) |
| Database | SQLite |
| Runtime | Docker |
