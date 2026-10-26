# Knoxville SME — one Dockerfile, two images (build context = repository root).
#   target "api": the NestJS API       target "web": Caddy serving the React app and proxying /api to the API

# ── build both workspaces ────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund
COPY backend backend
COPY frontend frontend
# Paybill number shown to clients on banners (optional)
ARG VITE_MPESA_PAYBILL=
ENV VITE_MPESA_PAYBILL=$VITE_MPESA_PAYBILL
RUN npm run build -w backend && npm run build -w frontend

# ── the API's runtime packages only (no React, no build tools) ───────────────
FROM node:22-alpine AS api-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace=backend --no-audit --no-fund

# ── API image ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS api
ENV NODE_ENV=production
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=api-deps /app/node_modules node_modules
WORKDIR /app/backend
COPY --from=build /app/backend/dist dist
COPY backend/package.json ./
# The PDF documents read the logo from <cwd>/assets
COPY backend/assets assets
USER node
EXPOSE 4100
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]

# ── Web image (Caddy: static app + reverse proxy to the API) ─────────────────
FROM caddy:2-alpine AS web
COPY deploy/docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv/web
