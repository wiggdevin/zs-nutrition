# Docker Local Development Setup

This guide explains how to use Docker Compose for local development with PostgreSQL and Redis.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2 (included with Docker Desktop)

## Quick Start

```bash
# Start all services (PostgreSQL + Redis)
pnpm services:up

# Stop all services (preserves data)
pnpm services:down

# Reset all services (wipes data and restarts fresh)
pnpm services:reset
```

## Services

### PostgreSQL 16

- **Container**: `zsn-postgres`
- **Port**: `5432`
- **Database**: `zero_sum_nutrition`
- **User**: `zsn`
- **Password**: `zsn_dev`
- **Connection String**: `postgresql://zsn:zsn_dev@localhost:5432/zero_sum_nutrition`

### Redis 7

- **Container**: `zsn-redis`
- **Port**: `6379`
- **Connection String**: `redis://localhost:6379`

## Environment Configuration

### For Local Docker Development

Update your `.env` or `.env.local` file:

```bash
# Use local Docker services
DATABASE_URL=postgresql://zsn:zsn_dev@localhost:5432/zero_sum_nutrition
REDIS_URL=redis://localhost:6379

# Disable mock queue when using real Redis
USE_MOCK_QUEUE=false
```

### For Cloud Development (Neon + Upstash)

Keep your cloud connection strings in `.env`:

```bash
# Use cloud services
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/dbname
REDIS_URL=redis://default:password@xxxxx.upstash.io:6379
```

## Database Operations

### Initialize Database Schema

```bash
# From monorepo root
cd apps/web
pnpm prisma migrate dev
```

### Access PostgreSQL

```bash
# Using Docker exec
docker exec -it zsn-postgres psql -U zsn -d zero_sum_nutrition

# Using local psql client
psql postgresql://zsn:zsn_dev@localhost:5432/zero_sum_nutrition
```

### Access Redis

```bash
# Using Docker exec
docker exec -it zsn-redis redis-cli

# Using local redis-cli
redis-cli -h localhost -p 6379
```

## Health Checks

Both services include health checks that run every 5 seconds:

- **PostgreSQL**: `pg_isready -U zsn`
- **Redis**: `redis-cli ping`

Check service health:

```bash
docker compose -f docker-compose.dev.yml ps
```

## Data Persistence

Data is persisted in Docker volumes:

- `pgdata` - PostgreSQL database files
- `redisdata` - Redis data files

### Backup Data

```bash
# Backup PostgreSQL
docker exec zsn-postgres pg_dump -U zsn zero_sum_nutrition > backup.sql

# Backup Redis
docker exec zsn-redis redis-cli SAVE
docker cp zsn-redis:/data/dump.rdb ./redis-backup.rdb
```

### Restore Data

```bash
# Restore PostgreSQL
docker exec -i zsn-postgres psql -U zsn -d zero_sum_nutrition < backup.sql

# Restore Redis
docker cp ./redis-backup.rdb zsn-redis:/data/dump.rdb
docker restart zsn-redis
```

## Troubleshooting

### Port Already in Use

If ports 5432 or 6379 are already in use:

```bash
# Check what's using the port
lsof -i :5432
lsof -i :6379

# Stop conflicting services
# macOS: brew services stop postgresql
# Linux: sudo systemctl stop postgresql
```

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.dev.yml logs

# Check specific service
docker compose -f docker-compose.dev.yml logs postgres
docker compose -f docker-compose.dev.yml logs redis

# Restart services
pnpm services:down
pnpm services:up
```

### Connection Refused

Ensure services are running and healthy:

```bash
docker compose -f docker-compose.dev.yml ps

# Should show "healthy" status for both services
```

### Database Migration Issues

```bash
# Reset database completely
pnpm services:reset

# Re-run migrations
cd apps/web
pnpm prisma migrate dev
pnpm prisma generate
```

## Network Configuration

Services are connected via the `zsn-network` bridge network. This allows:

- Containers to communicate with each other
- Host machine to access containers via `localhost`
- Isolated network environment

## Production vs Development

This Docker setup is for **local development only**. For production:

- Use managed PostgreSQL (Neon, RDS, etc.)
- Use managed Redis (Upstash, ElastiCache, etc.)
- Never use these credentials in production
- Enable SSL/TLS connections
- Configure proper authentication

## Additional Commands

```bash
# View running containers
docker compose -f docker-compose.dev.yml ps

# View logs (follow mode)
docker compose -f docker-compose.dev.yml logs -f

# Restart specific service
docker compose -f docker-compose.dev.yml restart postgres

# Stop services without removing volumes
docker compose -f docker-compose.dev.yml stop

# Remove stopped containers
docker compose -f docker-compose.dev.yml rm

# Pull latest images
docker compose -f docker-compose.dev.yml pull
```

## Development Workflow

1. **Start services**: `pnpm services:up`
2. **Initialize database**: `cd apps/web && pnpm prisma migrate dev`
3. **Start web app**: `pnpm dev:web`
4. **Start worker** (optional): `pnpm dev:worker`
5. **Stop services when done**: `pnpm services:down`

## CI/CD Integration

These services are not used in CI/CD. For testing:

- GitHub Actions uses PostgreSQL service containers
- Integration tests use test databases
- Production deployments use cloud services
