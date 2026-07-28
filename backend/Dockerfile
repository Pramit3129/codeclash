# Stage 1: Build the application
FROM oven/bun:1 AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y wget && \
    rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# Generate Prisma Client if Prisma schema exists
RUN if [ -f "./prisma/schema.prisma" ]; then bunx prisma generate; fi

# Compile TypeScript using Bun
RUN bun run build

# Stage 2: Production runner
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Copy necessary production artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 8000

# Command to run the application using Node.js
CMD ["node", "dist/server.js"]
