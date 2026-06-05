# syntax=docker/dockerfile:1.7
# Dockerfile multi-stage para NestJS 11 + Prisma 7.
# Detalles: PLANIFICACION/01-setup-base.md (T-008).

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps
FROM node:24-alpine AS deps
WORKDIR /app

# OpenSSL es necesario para Prisma
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY tsconfig.base.json ./

RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: builder
FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY packages ./packages
COPY backend ./backend

# Compilar @app/contracts primero
RUN npm run build:contracts

# Generar el Prisma Client (necesario para la build)
WORKDIR /app/backend
RUN npx prisma generate

# Build de NestJS
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: runner
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=4000

# Usuario no-root
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 --ingroup nestjs nestjs

# Copiamos el dist/, los node_modules productivos y el Prisma Client
COPY --from=builder --chown=nestjs:nestjs /app/backend/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nestjs /app/backend/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nestjs /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=builder --chown=nestjs:nestjs /app/packages/contracts/package.json /app/packages/contracts/package.json

USER nestjs
EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:4000/api/ping || exit 1

# start:prod corre `prisma migrate deploy` antes de levantar NestJS
CMD ["npm", "run", "start:prod"]
