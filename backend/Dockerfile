# Multi-Stage Production Dockerfile for InterviewPrep Backend (SOTA 2026 Native Build)
FROM node:22-bookworm-slim AS builder

# Install build tools for native SQLite bindings
RUN apt-get update && apt-get install -y --fix-missing --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 1. Build shared contract library
WORKDIR /shared
COPY shared/package*.json shared/tsconfig.json ./
RUN npm ci
COPY shared/src/ ./src/
RUN npm run build
RUN npm prune --omit=dev

# 2. Build backend application
WORKDIR /app
COPY backend/package*.json backend/tsconfig.json ./
RUN npm ci
COPY backend/src/ ./src/
RUN npm run build
RUN npm prune --omit=dev

# Stage 2: Hardened Production Runtime
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production

# Install minimal runtime dependencies (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built shared dist and production dependencies
WORKDIR /shared
COPY --from=builder /shared/dist ./dist
COPY --from=builder /shared/package*.json ./
COPY --from=builder /shared/node_modules ./node_modules

# Copy pre-built backend dist and production dependencies
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY backend/package*.json ./

# Copy canonical manifests and seed JSONs into container
COPY scenarios/ ./scenarios/
COPY json/ ./json/

# Expose internal API port
EXPOSE 5000

# Create data and storage volume directories for SQLite & Audio caching
RUN mkdir -p /app/data /app/storage

CMD ["node", "dist/server.js"]

