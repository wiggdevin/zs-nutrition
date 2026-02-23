FROM node:20-slim

# Install system dependencies required by @sparticuz/chromium
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
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable pnpm

WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json ./

# Copy package.json files for all workspace packages needed by the worker
COPY packages/nutrition-engine/package.json packages/nutrition-engine/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/queue-config/package.json packages/queue-config/
COPY workers/queue-processor/package.json workers/queue-processor/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/nutrition-engine/ packages/nutrition-engine/
COPY packages/shared-types/ packages/shared-types/
COPY packages/queue-config/ packages/queue-config/
COPY workers/queue-processor/ workers/queue-processor/

# Generate Prisma client
# Prisma v6 auto-install of devDependencies fails in Docker (pnpm frozen lockfile),
# but generate itself completes before that step — ignore the exit code, then verify.
COPY apps/web/prisma/ apps/web/prisma/
RUN npm install -g prisma@6.19.2 \
    && (prisma generate --schema=./apps/web/prisma/schema.prisma || true) \
    && node -e "require('@prisma/client'); console.log('✅ Prisma client generated successfully')"

# Build the queue-processor and its dependencies
RUN pnpm turbo run build --filter=@zsn/queue-processor

ENV NODE_ENV=production

WORKDIR /app/workers/queue-processor

CMD ["node", "dist/index.js"]
