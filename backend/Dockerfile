FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native addon
RUN apk add --no-cache make g++ gcc python3

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache sqlite


COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
