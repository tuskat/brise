# GCC Docs

Standalone Starlight documentation site for the Gemma Control Center.

This is a **separate Astro build** from the main GCC app. It produces a static site that can be served independently or alongside the main app.

## Quick Start

```bash
# Install dependencies
npm install

# Dev server (port 4322)
npm run dev

# Build static site
npm run build

# Preview built site
npm run preview
```

## Architecture

| | Main App | Docs |
|---|---|---|
| **Directory** | `/` (project root) | `/docs/` |
| **Astro mode** | SSR (`output: 'server'`) | Static (`output: 'static'`) |
| **Port** | 4321 | 4322 |
| **Build output** | `dist/` (Node server) | `docs/dist/` (static HTML) |
| **Dependencies** | Own `package.json` | Own `package.json` |

## Docker

Both sites run in a single container via the `Dockerfile` at the project root:
- Main app: `node dist/server/entry.mjs` on port **4321**
- Docs: `serve -s docs-dist -l 4322` on port **4322**

The `docker-compose.yml` exposes both ports.

## Adding Pages

1. Create a `.md` file in `src/content/docs/`
2. Add frontmatter: `title` and `description` are required
3. Add a sidebar entry in `astro.config.mjs` → `sidebar`

```md
---
title: My New Page
description: Description of the page
---

Content goes here.
```
