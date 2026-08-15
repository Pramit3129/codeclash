# ---------- Builder ----------
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Build TypeScript
RUN bun run build


# ---------- Worker ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install:
# - OpenSSL for Prisma
# - Docker CLI for spawning judge containers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      openssl \
      docker.io && \
    docker --version && \
    openssl version && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Regenerate Prisma inside runtime image
RUN npx prisma generate

# Worker entrypoint
CMD ["node", "dist/judge-worker.js"]