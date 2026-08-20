# Multi-Stage Production Dockerfile for InterviewPrep Backend
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

# Stage 2: Production Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install production dependencies only with native build tools
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled JavaScript
COPY --from=builder /app/dist ./dist

# Expose internal port
EXPOSE 5000

# Create data and storage volume directories for SQLite & Podcast Audio
RUN mkdir -p /app/data /app/storage

# Run as non-root node user
USER node

CMD ["node", "dist/server.js"]
