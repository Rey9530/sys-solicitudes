# syntax=docker/dockerfile:1.7
# Dockerfile multi-stage para Next.js 16 (App Router, output standalone).
# Detalles: PLANIFICACION/01-setup-base.md (T-007).

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps
FROM node:24-alpine AS deps
WORKDIR /app

# Copiamos primero los manifests para cachear las capas
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY tsconfig.base.json ./

# Install con npm (frozen lockfile si está disponible)
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: builder
FROM node:24-alpine AS builder
WORKDIR /app

# Heredamos node_modules de deps
COPY --from=deps /app/node_modules ./node_modules

# package.json raíz: build:contracts es un script de workspace
# (`npm run build --workspace=@app/contracts`) y requiere el manifest raíz.
COPY package.json package-lock.json* ./

# Copiamos el código fuente necesario
COPY tsconfig.base.json ./
COPY packages ./packages
COPY frontend ./frontend

# Importante: compilar @app/contracts primero
WORKDIR /app
RUN npm run build:contracts

# Build de Next.js
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Las variables NEXT_PUBLIC_* se inlinean en build-time (no runtime). Se pasan
# como build args desde docker-compose.prod.yml. En el patrón BFF, lib/api.ts las
# usa server-side para alcanzar al backend a través del dominio público.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: runner (imagen final)
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copiamos solo el standalone output (ya incluye las deps serializadas)
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000

# Healthcheck opcional
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", "frontend/server.js"]
