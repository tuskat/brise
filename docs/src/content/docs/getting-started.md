---
title: Getting Started
description: Install and run Brise locally.
---

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd brise

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:4321`.

## First Steps

1. **Configure a Proxy** — Go to the Proxies tab and add your first LLM backend
2. **Create a Persona** — Go to the Personas tab and define a system prompt
3. **Start Chatting** — Go to the Chat tab and send your first message

## Project Structure

```
control-center/
├── src/
│   ├── pages/api/     # API routes
│   ├── components/    # Vue/Astro UI components
│   ├── lib/           # Business logic
│   └── db/            # SQLite operations
├── personas/         # Persona JSON configs
├── proxies/          # Proxy JSON configs
└── data/             # SQLite database (gitignored)
```
