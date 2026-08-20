# Multi-Stage Production Build for Frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json vite.config.ts ./
RUN npm ci

COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

# Output image simply holds the static files
FROM alpine:3.20 AS exporter
COPY --from=builder /app/dist /dist
CMD ["cp", "-r", "/dist/.", "/output/"]
