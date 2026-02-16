# Docker Local Development - Quick Start

## TL;DR

```bash
# Start PostgreSQL + Redis
pnpm services:up

# Stop services
pnpm services:down

# Reset everything (wipes data)
pnpm services:reset
```

## Environment Setup

Add to your `.env` or `.env.local`:

```bash
DATABASE_URL=postgresql://zsn:zsn_dev@localhost:5432/zero_sum_nutrition
REDIS_URL=redis://localhost:6379
USE_MOCK_QUEUE=false
```

## First Time Setup

```bash
# 1. Start services
pnpm services:up

# 2. Wait for health checks (5-10 seconds)
docker compose -f docker-compose.dev.yml ps

# 3. Initialize database
cd apps/web
pnpm prisma migrate dev
pnpm prisma generate

# 4. Start development
pnpm dev:web
```

## Connection Details

| Service    | Port | Connection String                                            |
| ---------- | ---- | ------------------------------------------------------------ |
| PostgreSQL | 5432 | `postgresql://zsn:zsn_dev@localhost:5432/zero_sum_nutrition` |
| Redis      | 6379 | `redis://localhost:6379`                                     |

## Common Commands

```bash
# Check service status
docker compose -f docker-compose.dev.yml ps

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Connect to PostgreSQL
psql postgresql://zsn:zsn_dev@localhost:5432/zero_sum_nutrition

# Connect to Redis
redis-cli -h localhost -p 6379
```

## Troubleshooting

**Services won't start?**

```bash
pnpm services:down
pnpm services:up
```

**Need fresh database?**

```bash
pnpm services:reset
cd apps/web && pnpm prisma migrate dev
```

**Port already in use?**

```bash
lsof -i :5432  # Check what's using PostgreSQL port
lsof -i :6379  # Check what's using Redis port
```

## Full Documentation

See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for complete guide.
