# ── Stage 1: Build the main Brise app (SSR) ─────────────────────────
FROM node:lts-alpine3.22 AS builder-app
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --verbose --no-audit --no-fund
COPY . .
RUN npm run build

# ── Stage 2: Build the docs site (static) ─────────────────────────
FROM node:lts-alpine3.22 AS builder-docs
WORKDIR /docs
COPY docs/package*.json ./
RUN npm ci --verbose --no-audit --no-fund
COPY docs/ .
RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────────
FROM node:lts-alpine3.22 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Non-root user matching the typical NAS share UID (1000).
# Override at build time if your NAS uses a different UID/GID.
ARG APP_UID=1000
ARG APP_GID=1000
RUN addgroup -g ${APP_GID} app && adduser -D -u ${APP_UID} -G app app

# su-exec lets the entrypoint drop from root to the app user after fixing volume perms.
RUN apk add --no-cache su-exec

# Install production deps (native better-sqlite3 needs build tools at install time only).
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev --verbose --no-audit --no-fund \
 && apk del .build-deps

# Copy built artifacts from builder stages
COPY --from=builder-app /app/dist ./dist
COPY --from=builder-docs /docs/dist ./docs-dist

# Bundled defaults, seeded into bind-mounts on first boot if empty.
COPY personas ./personas.sample
COPY proxies ./proxies.sample
# Format schemas are read from the working dir at runtime, not bind-mounted.
COPY format-schemas ./format-schemas

# Create volume dirs and hand ownership to the app user
RUN mkdir -p /app/data /app/personas /app/proxies \
 && chown -R app:app /app

# Lightweight static server for the docs site
RUN npm install -g serve@latest --no-audit --no-fund

# Entrypoint: run as root just long enough to fix bind-mount ownership, then drop to app.
# Runs serve + node together and exits if either dies.
RUN cat > /app/entrypoint.sh <<'EOF' && chmod +x /app/entrypoint.sh
#!/bin/sh
set -e
for d in /app/data /app/personas /app/proxies; do
  mkdir -p "$d"
  chown -R app:app "$d" 2>/dev/null || true
done
# Seed defaults on first boot (only if the bind-mount is empty)
for name in personas proxies; do
  if [ -d "/app/${name}.sample" ] && [ -z "$(ls -A "/app/$name" 2>/dev/null)" ]; then
    cp -a "/app/${name}.sample/." "/app/$name/"
    chown -R app:app "/app/$name"
  fi
done
exec su-exec app:app /bin/sh -c '
  set -e
  serve /app/docs-dist -l 4322 &
  DOCS_PID=$!
  node /app/dist/server/entry.mjs &
  APP_PID=$!
  wait -n "$DOCS_PID" "$APP_PID"
  kill "$DOCS_PID" "$APP_PID" 2>/dev/null || true
  exit 1
'
EOF

EXPOSE 4321 4322

ENTRYPOINT ["/app/entrypoint.sh"]
