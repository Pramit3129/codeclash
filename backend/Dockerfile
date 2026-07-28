# ---------- Builder ----------
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Build
RUN bun run build


# ---------- Runner ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install OpenSSL
RUN apt-get update && \
    apt-get install -y openssl && \
    openssl version && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Regenerate Prisma inside the runtime image
RUN npx prisma generate

EXPOSE 8000

CMD ["node", "dist/server.js"]