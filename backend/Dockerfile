# Use official Bun runtime as base image
FROM oven/bun:1 AS base

# Set working directory inside the container
WORKDIR /app

RUN apt-get update && \
    apt-get install -y wget && \
    rm -rf /var/lib/apt/lists/*

# Stage 1: Install dependencies
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build / Prepare release
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client if Prisma schema exists
RUN if [ -f "./prisma/schema.prisma" ]; then bunx prisma generate; fi

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose backend port
EXPOSE 8000

# Command to run the application
CMD ["bun", "run", "src/server.ts"]
