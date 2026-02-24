FROM node:20-slim

# Install system dependencies required by @sparticuz/chromium + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable pnpm

WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json ./

# Copy package.json files for all workspace packages needed by the worker
# Include apps/web so pnpm installs the prisma CLI (needed for prisma generate)
COPY packages/nutrition-engine/package.json packages/nutrition-engine/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/queue-config/package.json packages/queue-config/
COPY workers/queue-processor/package.json workers/queue-processor/
COPY apps/web/package.json apps/web/

# Copy Prisma schema BEFORE install (apps/web postinstall runs prisma generate)
COPY apps/web/prisma/ apps/web/prisma/

# Install dependencies (frozen lockfile — postinstall generates Prisma client)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/nutrition-engine/ packages/nutrition-engine/
COPY packages/shared-types/ packages/shared-types/
COPY packages/queue-config/ packages/queue-config/
COPY workers/queue-processor/ workers/queue-processor/

# Build the queue-processor and its dependencies
RUN pnpm turbo run build --filter=@zsn/queue-processor

ENV NODE_ENV=production

WORKDIR /app/workers/queue-processor

EXPOSE 3457
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3457/ || exit 1

CMD ["node", "dist/index.js"]
