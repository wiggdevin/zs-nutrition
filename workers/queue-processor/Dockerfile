FROM node:20-slim AS base
RUN corepack enable pnpm

FROM base AS build
WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json files for all workspace packages
COPY packages/nutrition-engine/package.json packages/nutrition-engine/
COPY workers/queue-processor/package.json workers/queue-processor/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/nutrition-engine/ packages/nutrition-engine/
COPY workers/queue-processor/ workers/queue-processor/

# Build the queue-processor and its dependencies
RUN pnpm turbo run build --filter=@zsn/queue-processor

FROM base AS runtime
WORKDIR /app

# Copy built artifacts from build stage
COPY --from=build /app/workers/queue-processor/dist ./dist
COPY --from=build /app/workers/queue-processor/package.json ./package.json

# Copy node_modules (includes nutrition-engine)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/workers/queue-processor/node_modules ./node_modules
COPY --from=build /app/packages/nutrition-engine/dist ./node_modules/@zero-sum/nutrition-engine/dist
COPY --from=build /app/packages/nutrition-engine/package.json ./node_modules/@zero-sum/nutrition-engine/package.json

ENV NODE_ENV=production

# Health check endpoint (worker doesn't expose HTTP, but Railway expects it)
# Worker process will be monitored via process health instead
HEALTHCHECK NONE

CMD ["node", "dist/index.js"]
