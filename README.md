# Gemma-Control-Center

A self-hosted AI observability platform for proxying and orchestrating multiple LLM backends through a persona-driven interface.

> **⚠️ Security Warning:** This application is designed for **local/self-hosted use on trusted networks only**. It does not implement authentication, rate limiting, or API key encryption. See [SECURITY.md](SECURITY.md) for details.

---

## Features

- **Multi-Proxy Support** — Configure and switch between multiple LLM backends (Ollama, OpenAI-compatible, Groq, etc.)
- **Persona System** — Pre-configured system prompts with hyperparameter tuning per persona
- **Conversation Chat** — Multi-turn chat with conversation history, streaming responses, and per-message latency tracking
- **Playground** — Single-shot prompt testing ground for quick experiments
- **Request Logging** — SQLite-based history with metrics dashboard
- **Production Dashboard** — Modern dark-mode UI with sidebar navigation, real-time stats, and charts

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ESM) |
| Framework | Astro 6 (SSR, `@astrojs/node` adapter) |
| Frontend | Vanilla JS (ES modules) + CSS custom properties |
| Database | SQLite (`better-sqlite3`) |
| LLM Backend | Ollama REST API / OpenAI-compatible APIs |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:4321
```

## Configuration

### Proxies

Proxy configurations live in `/proxies/*.json`. Example:

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

### Personas

Persona configurations live in `/personas/*.json`. Example:

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

## Docker Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Docker deployment instructions.

Quick start with Docker Compose:

```bash
docker-compose up -d
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proxy` | Send prompt to LLM (legacy) |
| GET | `/api/proxies` | List all proxies |
| POST | `/api/proxies` | Create proxy |
| PUT | `/api/proxies` | Update proxy |
| DELETE | `/api/proxies` | Delete proxy |
| POST | `/api/proxies/test` | Test proxy connection |
| GET | `/api/personas` | List all personas |
| GET / POST | `/api/chat/conversations` | List / create conversations |
| GET / DELETE | `/api/chat/:id` | Get / delete conversation |
| POST | `/api/chat/:id/messages` | Send message (SSE streaming) |
| PUT | `/api/chat/:id/title` | Rename conversation |
| GET | `/api/history` | Get prompt history |
| GET | `/api/metrics` | Get dashboard metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `4321` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATA_DIR` | `./data` | SQLite database directory |

## Project Documentation

User-facing documentation is built with [Starlight](https://starlight.astro.build) and served at `/docs` when running the app. Source files live in `src/content/docs/`.

Internal project documentation (architecture specs, phase roadmaps, conventions, agent guidelines) lives in `.project-docs/` (gitignored).

## License

MIT License — see [LICENSE](LICENSE) for details.
