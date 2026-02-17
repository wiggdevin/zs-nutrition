# Staging Environment

This document covers the staging environment for Zero Sum Nutrition, including deployment, configuration, feature flags, and troubleshooting.

## Architecture Overview

```
staging branch push
        |
        v
GitHub Actions (staging.yml)
  |-- Quality gates (typecheck, lint, test, build)
  |-- Prisma migrate deploy (Neon staging branch)
  |-- Vercel deploy --target=staging
  |-- Health check (/api/health)
  |-- Playwright smoke tests
        |
        v
  Staging environment
  |- Vercel (web app)
  |- Neon (PostgreSQL staging branch)
  |- Railway (BullMQ worker - staging service)
  |- Upstash Redis (staging instance)
```

## Environment Variables

All staging secrets are prefixed with `STAGING_` in GitHub Actions. In the Vercel staging environment and Railway staging service, they use their standard names.

| Variable                            | Description                                        | Where           |
| ----------------------------------- | -------------------------------------------------- | --------------- |
| `DATABASE_URL`                      | Neon PostgreSQL connection string (staging branch) | Vercel, Railway |
| `CLERK_SECRET_KEY`                  | Clerk secret key (staging instance)                | Vercel          |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (staging)                    | Vercel          |
| `ANTHROPIC_API_KEY`                 | Claude API key                                     | Vercel, Railway |
| `FATSECRET_CLIENT_ID`               | FatSecret client ID                                | Vercel, Railway |
| `FATSECRET_CLIENT_SECRET`           | FatSecret client secret                            | Vercel, Railway |
| `REDIS_URL`                         | Upstash Redis URL (staging)                        | Vercel, Railway |
| `BLOB_READ_WRITE_TOKEN`             | Vercel Blob storage token                          | Vercel          |
| `USE_MOCK_QUEUE`                    | Set to `false` in staging                          | Vercel          |
| `USDA_API_KEY`                      | USDA FoodData Central API key                      | Vercel, Railway |
| `INTERNAL_API_SECRET`               | Shared secret for worker-to-web auth               | Vercel, Railway |
| `WEB_APP_URL`                       | Staging web URL (e.g. `https://staging.zsn.app`)   | Railway         |
| `TOKEN_ENCRYPTION_KEY`              | Token encryption key (staging-specific)            | Vercel, Railway |
| `UPSTASH_REDIS_REST_URL`            | Upstash REST URL for rate limiting                 | Vercel          |
| `UPSTASH_REDIS_REST_TOKEN`          | Upstash REST token for rate limiting               | Vercel          |
| `SKIP_ENV_VALIDATION`               | Set to `true` during CI builds only                | GitHub Actions  |

### GitHub Actions Secrets

Add these secrets to the repository under Settings > Secrets and variables > Actions:

- `STAGING_DATABASE_URL`
- `STAGING_CLERK_SECRET_KEY`
- `STAGING_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `STAGING_ANTHROPIC_API_KEY`
- `STAGING_FATSECRET_CLIENT_ID`
- `STAGING_FATSECRET_CLIENT_SECRET`
- `STAGING_REDIS_URL`
- `STAGING_USDA_API_KEY`
- `STAGING_URL` (e.g. `https://staging-zsn.vercel.app`)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Neon DB Branch Management

Staging uses a dedicated Neon database branch to isolate data from production.

### Create a staging branch

```bash
# Via Neon CLI
neonctl branches create --name staging --project-id <project-id>

# Copy the connection string and set it as STAGING_DATABASE_URL
```

### Run migrations on staging

Migrations are run automatically by the GitHub Actions workflow. To run manually:

```bash
DATABASE_URL="<staging-connection-string>" npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma
```

### Reset staging data

```bash
DATABASE_URL="<staging-connection-string>" npx prisma migrate reset --schema=apps/web/prisma/schema.prisma
```

**Warning:** This drops all data in the staging branch.

## Railway Staging Worker

The BullMQ queue processor runs on Railway as a separate staging service.

### Setup

1. Create a new Railway service in the staging environment.
2. Set the start command to `pnpm --filter @zsn/queue-processor start`.
3. Configure environment variables: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`, `USDA_API_KEY`, `INTERNAL_API_SECRET`, `WEB_APP_URL`, `TOKEN_ENCRYPTION_KEY`.
4. Ensure `REDIS_URL` points to the staging Upstash Redis instance (same one used by Vercel staging).

### Monitoring

Check Railway logs for worker health. The worker logs startup confirmation and Redis connectivity status.

## Feature Flag Management

Feature flags are managed via Vercel Edge Config with environment variable fallbacks.

### Available Flags

| Flag Name              | Description                              |
| ---------------------- | ---------------------------------------- |
| `new-meal-plan-ui`     | New meal plan UI redesign                |
| `fast-path-generation` | Fast-path plan generation (skip Agent 3) |
| `food-scan`            | Food scanning via Claude Vision          |
| `plan-versioning`      | Plan version history                     |
| `advanced-macros`      | Advanced macro tracking display          |

### Flag Types

- **Boolean**: Simple on/off toggle. Set in Edge Config as `{"enabled": true}` or via env var as `FEATURE_FLAG_NEW_MEAL_PLAN_UI=true`.
- **Percentage rollout**: Gradual rollout to a percentage of users. `{"enabled": true, "rolloutPercent": 25}` enables for 25% of users based on deterministic hashing.
- **Allowlist**: Enable for specific user IDs. `{"enabled": true, "allowlist": ["user_abc", "user_xyz"]}`.

### Setting Flags via Edge Config

1. Go to the Vercel dashboard > your project > Storage > Edge Config.
2. Add or update the flag key (e.g. `fast-path-generation`) with a JSON value.

### Setting Flags via Environment Variables

If Edge Config is not configured, flags fall back to environment variables:

```bash
# Boolean
FEATURE_FLAG_FAST_PATH_GENERATION=true

# JSON (supports percentage + allowlist)
FEATURE_FLAG_FAST_PATH_GENERATION='{"enabled":true,"rolloutPercent":50}'
```

### Using Flags in Code

```typescript
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags';

const enabled = await isFeatureEnabled(FEATURE_FLAGS.FAST_PATH_GENERATION, userId);
```

## Deployment Workflow

### Automatic Deployment

1. Create or update the `staging` branch from `main` (or a feature branch):

   ```bash
   git checkout -b staging origin/main
   git push origin staging
   ```

2. The GitHub Actions `staging.yml` workflow triggers automatically:
   - Runs quality gates (typecheck, lint, test, build)
   - Deploys Prisma migrations to the staging Neon branch
   - Deploys to Vercel staging environment
   - Runs health check against `/api/health`
   - Executes Playwright smoke tests

3. Monitor the workflow run in the GitHub Actions tab.

### Manual Deployment

Trigger a manual deployment via GitHub Actions:

1. Go to Actions > "Staging Deploy" workflow.
2. Click "Run workflow" and select the `staging` branch.

### Promoting to Production

After validating on staging:

```bash
git checkout main
git merge staging
git push origin main
```

## Smoke Test Execution

### Run against staging

```bash
STAGING_URL=https://staging-zsn.vercel.app npx playwright test --config=playwright.staging.config.ts
```

### Run locally

```bash
npx playwright test --config=playwright.staging.config.ts
```

This defaults to `http://localhost:3000`.

### Smoke test coverage

1. Landing page returns 200
2. `/api/health` returns ok/degraded status with expected fields
3. `/sign-in` page renders (Clerk auth)
4. Page has proper meta tags (viewport, charset, title)

## Troubleshooting

### Health check returns `error` status

The `/api/health` endpoint returns `error` when the database is unreachable.

1. Check that `DATABASE_URL` is correctly set in Vercel staging environment variables.
2. Verify the Neon staging branch exists and is not suspended: `neonctl branches list --project-id <id>`.
3. Try connecting directly: `psql "<staging-database-url>" -c "SELECT 1"`.

### Health check returns `degraded` status

This means the database is reachable but Redis is not.

1. Verify `REDIS_URL` is set in Vercel staging environment variables.
2. Check Upstash dashboard for the staging Redis instance status.
3. Ensure the Redis URL uses `rediss://` (TLS) for Upstash connections.

### Vercel deploy fails

1. Check that `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets are set in GitHub.
2. Verify the token has not expired.
3. Run manually: `npx vercel deploy --target=staging --token=<token> --yes`.

### Prisma migration fails

1. Ensure the staging `DATABASE_URL` is accessible from GitHub Actions runners.
2. Check for pending migrations: `npx prisma migrate status --schema=apps/web/prisma/schema.prisma`.
3. If a migration is stuck, check Neon dashboard for active connections or locks.

### Smoke tests fail in CI

1. Check that `STAGING_URL` is set correctly and the deployment completed.
2. Verify Playwright browsers are installed: the workflow runs `npx playwright install chromium --with-deps`.
3. Run locally against the staging URL to reproduce: `STAGING_URL=<url> npx playwright test --config=playwright.staging.config.ts`.

### Railway worker not processing jobs

1. Check Railway logs for startup errors.
2. Verify `REDIS_URL` matches the staging Upstash instance.
3. Ensure `INTERNAL_API_SECRET` matches between Vercel and Railway.
4. Check that `WEB_APP_URL` points to the staging web URL (the worker calls back to the web app).

### Feature flags not working

1. If using Edge Config: verify the Edge Config is connected to the Vercel project and the key names match.
2. If using env vars: check that the variable name follows the pattern `FEATURE_FLAG_<NAME>` with uppercase and underscores.
3. Percentage rollouts require a `userId` -- anonymous users will always get `false`.
