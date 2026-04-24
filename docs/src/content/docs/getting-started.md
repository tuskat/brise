---
title: Getting Started
description: Install and run Brise locally.
---

## Prerequisites

- Node.js 20+
- npm

## Installation

```bash
# Clone the repository
git clone https://github.com/cedricmarcellin/brise.git
cd brise

# Install dependencies
npm install

# Start the development server
npm run dev

# Access at http://localhost:4321
```

## First Steps

1. **Configure a Proxy** — Go to the **Proxies** tab and add your first LLM backend (e.g. a local Ollama instance)
2. **Create a Persona** — Go to the **Personas** tab and define a system prompt with hyperparameters
3. **Try the Playground** — Go to the **Playground** tab for a quick single-shot test
4. **Start Chatting** — Go to the **Chat** tab for multi-turn conversation with streaming

## Project Structure

```
brise/
├── src/
│   ├── pages/
│   │   └── api/          # REST API routes
│   ├── components/
│   │   ├── tabs/         # Full-page tab views (Dashboard, Chat, Playground, History, Personas, Proxies)
│   │   ├── components/   # Reusable feature blocks (Toast, WelcomeModal)
│   │   └── atoms/        # Smallest pieces (Sidebar, StatCard, EmptyState)
│   ├── layouts/          # HTML shell + theme flash guard
│   ├── lib/              # Server-side business logic (proxy-client, loaders, db)
│   ├── db/               # Database module (dbOperations for conversations/messages)
│   ├── styles/           # Chunked CSS: theme tokens, design system, per-tab styles
│   └── utils/            # Client-side JS modules (vanilla ES, no framework)
├── personas/             # Persona JSON configs
├── proxies/              # Proxy JSON configs
├── data/                 # SQLite database (gitignored)
├── docs/                 # Standalone Starlight documentation site (port 4322)
└── public/               # Static assets (favicon)
```

## Running Tests

```bash
npm test           # Run golden test suite
npm run test:watch # Watch mode
```

The golden test suite guards CSS class inventories, HTML structure, JS DOM class strings, API contracts, and helper function signatures.
