# Multi-Stage Production Build for Frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js ./
RUN npm ci

COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

# Production Nginx Server
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
