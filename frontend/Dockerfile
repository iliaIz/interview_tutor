# Multi-Stage Production Build for Frontend (SOTA 2026)
FROM node:22-alpine AS builder

# 1. Build shared contract library
WORKDIR /shared
COPY shared/package*.json shared/tsconfig.json ./
RUN npm ci
COPY shared/src/ ./src/
RUN npm run build
RUN npm prune --omit=dev

# 2. Build frontend application
WORKDIR /app
COPY frontend/package*.json frontend/tsconfig*.json frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js ./
RUN npm ci

COPY frontend/index.html ./
COPY frontend/scripts/ ./scripts/
COPY frontend/public/ ./public/
COPY frontend/src/ ./src/

RUN npm run build

# Production Nginx Server
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
