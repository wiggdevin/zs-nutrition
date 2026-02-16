FROM node:20-slim
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

# Build the queue-processor and its dependencies
RUN pnpm turbo run build --filter=@zsn/queue-processor

ENV NODE_ENV=production

WORKDIR /app/workers/queue-processor

CMD ["node", "dist/index.js"]
