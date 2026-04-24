# ── Stage 1: Build the main Brise app (SSR) ─────────────────────────
FROM node:20-alpine AS builder-app
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Build the docs site (static) ─────────────────────────
FROM node:20-alpine AS builder-docs
WORKDIR /docs
COPY docs/package*.json ./
RUN npm ci
COPY docs/ .
RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Create directories for persistent data
RUN mkdir -p /app/data /app/personas /app/proxies

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built main app
COPY --from=builder-app /app/dist ./dist

# Copy docs static site — served by the main app's reverse-proxy or a sidecar
COPY --from=builder-docs /docs/dist ./docs-dist

EXPOSE 4321

# Start both: main app on 4321, docs on 4322 via a lightweight static server
RUN npm install -g serve@latest

# Wrapper script that starts both processes
RUN printf '#!/bin/sh\nserve -s /app/docs-dist -l 4322 &\nnode /app/dist/server/entry.mjs\n' > /app/start.sh && chmod +x /app/start.sh

CMD ["/bin/sh", "/app/start.sh"]
