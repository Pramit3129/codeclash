# ---------- Builder ----------
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Build only realtime server
RUN bun run build:realtime


# ---------- Runner ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV WS_PORT=8001

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 8001

CMD ["node", "dist/ws-server.js"]