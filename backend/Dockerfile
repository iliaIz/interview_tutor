# Multi-Stage Production Dockerfile for InterviewPrep Backend (SOTA 2026 Single-Pass Native Build)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build tools for native SQLite bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build
RUN npm prune --omit=dev

# Stage 2: Hardened Production Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install minimal runtime dependencies (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built production node_modules (with compiled better-sqlite3 native bindings)
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy compiled JavaScript output
COPY --from=builder /app/dist ./dist

# Expose internal API port
EXPOSE 5000

# Create data and storage volume directories for SQLite & Audio caching
RUN mkdir -p /app/data /app/storage

CMD ["node", "dist/server.js"]
