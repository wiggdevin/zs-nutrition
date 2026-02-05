# Deployment Guide

This guide covers deploying the Zero Sum Nutrition application to production using Vercel (web app) and Railway (BullMQ worker).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       VERCEL                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js App (@zsn/web)                               │  │
│  │  - Frontend (React 19 + Next.js 15)                   │  │
│  │  - API Routes (tRPC, SSE, Vision)                     │  │
│  │  - Static Assets                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           │ HTTPS                           │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Edge Functions                                       │  │
│  │  - /api/plan/generate (60s timeout)                   │  │
│  │  - /api/plan-stream/[jobId] (300s timeout for SSE)    │  │
│  │  - /api/vision/analyze (30s timeout)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Redis Pub/Sub + BullMQ
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      RAILWAY                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  BullMQ Worker (@zsn/queue-processor)                 │  │
│  │  - Processes plan generation jobs                     │  │
│  │  - Runs 6-agent AI pipeline                           │  │
│  │  - Publishes progress via Redis pub/sub               │  │
│  │  - Saves completed plans via API callback             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                          │
│  - Neon (PostgreSQL Database)                               │
│  - Upstash Redis (BullMQ + Pub/Sub + Rate Limiting)        │
│  - Clerk (Authentication)                                   │
│  - Anthropic Claude API (AI + Vision)                       │
│  - FatSecret Platform API (Nutrition Data)                  │
│  - Vercel Blob (Image Storage)                              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Accounts Required:**
   - Vercel account (for web app hosting)
   - Railway account (for worker hosting)
   - Neon account (PostgreSQL database)
   - Upstash account (Redis)
   - Clerk account (authentication)
   - Anthropic account (Claude API)
   - FatSecret Platform account (nutrition API)

2. **Local Setup:**
   - Node.js 20+
   - pnpm 10.28.2+
   - Git

## Part 1: Vercel Deployment (Web App)

### 1.1 Connect Repository

1. Log in to [Vercel](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the repository root: `/zero-sum-nutrition`

### 1.2 Configure Project Settings

**Framework Preset:** Next.js

**Root Directory:** `apps/web`

**Build Settings:**
- Build Command: `cd ../.. && pnpm turbo run build --filter=@zsn/web`
- Output Directory: `.next`
- Install Command: `pnpm install`

**Node Version:** 20.x

### 1.3 Environment Variables

Add the following environment variables in Vercel project settings:

```bash
# Database
DATABASE_URL=postgresql://...

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# AI Services
ANTHROPIC_API_KEY=sk-ant-...

# FatSecret API
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...

# Redis (Upstash)
REDIS_URL=redis://...

# Storage (Vercel Blob)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Queue Configuration
USE_MOCK_QUEUE=false

# Internal API Secret (for worker callbacks)
INTERNAL_API_SECRET=<generate-a-strong-secret>

# Worker URL (set after Railway deployment)
WEB_APP_URL=https://your-app.vercel.app
```

### 1.4 Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Note the deployed URL (e.g., `https://your-app.vercel.app`)

### 1.5 Function Timeouts

The `vercel.json` configuration automatically sets:
- `/api/plan/generate`: 60s (job creation)
- `/api/plan-stream/[jobId]`: 300s (SSE streaming)
- `/api/vision/analyze`: 30s (Claude Vision analysis)
- `/api/vision/log-meal`: 30s (meal logging with Vision)
- `/api/plan/pdf`: 30s (PDF generation)

## Part 2: Railway Deployment (BullMQ Worker)

### 2.1 Create New Project

1. Log in to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your repository

### 2.2 Configure Service

**Service Name:** `queue-processor`

**Root Directory:** `/zero-sum-nutrition/workers/queue-processor`

**Build Method:** Dockerfile (Railway will auto-detect)

### 2.3 Environment Variables

Add the following in Railway project settings:

```bash
# Redis (same as Vercel)
REDIS_URL=redis://...

# AI Services
ANTHROPIC_API_KEY=sk-ant-...

# FatSecret API
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...

# Web App URL (from Vercel deployment)
WEB_APP_URL=https://your-app.vercel.app

# Internal API Secret (same as Vercel)
INTERNAL_API_SECRET=<same-secret-from-vercel>

# Environment
NODE_ENV=production
```

### 2.4 Deploy

1. Railway will automatically build using the Dockerfile
2. Monitor logs to ensure worker starts successfully
3. Look for: `✅ Worker is running and waiting for jobs...`

### 2.5 Health Monitoring

Railway monitors the worker process health automatically. The worker includes:
- Graceful shutdown handlers (SIGINT, SIGTERM)
- Error recovery and retry logic
- Dead letter queue for permanently failed jobs

**Note:** The `railway.toml` specifies a healthcheck path, but the worker doesn't expose HTTP. Railway will monitor process health instead.

## Part 3: Database Setup (Neon)

### 3.1 Create Database

1. Log in to [Neon](https://neon.tech)
2. Create a new project
3. Copy the connection string

### 3.2 Run Migrations

```bash
# From the web app directory
cd apps/web

# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Push schema to database
pnpm db:push
```

### 3.3 Verify Schema

```bash
# Open Prisma Studio to verify tables
pnpm db:studio
```

Expected tables:
- User
- Profile
- Onboarding
- MealPlan
- Meal
- Ingredient
- SwapHistory
- DailyLog
- WeightEntry
- VisionScan

## Part 4: Turbo Remote Caching (Optional)

Turbo remote caching speeds up CI/CD builds by sharing build artifacts across machines.

### 4.1 For Vercel Users

```bash
# Login to Vercel
npx turbo login

# Link to your Vercel team/account
npx turbo link
```

This creates `.turbo/config.json` with your team ID and auth token.

### 4.2 For GitHub Actions / CI

Add these secrets to your GitHub repository:

```bash
TURBO_TOKEN=<your-vercel-token>
TURBO_TEAM=<your-team-slug>
```

Reference in `.github/workflows/ci.yml`:

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

### 4.3 Verify Remote Caching

```bash
# First build (cold cache)
pnpm turbo run build

# Second build (should use remote cache)
pnpm turbo run build
# Look for: "cache hit, replaying logs"
```

## Part 5: Post-Deployment Verification

### 5.1 Test Web App

1. Navigate to your Vercel URL
2. Sign up / Sign in via Clerk
3. Complete onboarding
4. Generate a meal plan
5. Verify SSE streaming shows progress
6. Check plan displays correctly

### 5.2 Test Worker

1. Monitor Railway logs during plan generation
2. Verify job processing:
   - `📦 Processing job <id>: generate-plan`
   - Agent progress (1-6)
   - `✅ Job <id> completed successfully`
   - `💾 Plan saved to database: <planId>`

3. Check for errors in Railway logs

### 5.3 Test Vision API

1. Navigate to "Track Food"
2. Upload a food photo
3. Verify analysis completes in <30s
4. Check nutrition data is accurate

### 5.4 Monitor Performance

**Vercel Analytics:**
- Enable in Vercel dashboard
- Monitor Core Web Vitals
- Check function execution times

**Railway Metrics:**
- Monitor CPU usage (should be low when idle)
- Memory usage (spikes during plan generation)
- Network I/O (Redis + API calls)

**Upstash Redis:**
- Monitor connection count
- Check memory usage
- Verify pub/sub channels working

## Part 6: Troubleshooting

### Issue: Worker Not Processing Jobs

**Symptoms:** Jobs stuck in queue, no worker logs

**Solutions:**
1. Verify `REDIS_URL` matches between Vercel and Railway
2. Check Railway service is running (not crashed)
3. Verify network connectivity to Redis
4. Check worker logs for connection errors

### Issue: SSE Streaming Not Working

**Symptoms:** Progress stuck, polling fallback only

**Solutions:**
1. Verify Redis pub/sub working (test with Redis CLI)
2. Check function timeout (300s) is sufficient
3. Verify `Cache-Control: no-cache` headers set
4. Test pub/sub channels: `SUBSCRIBE job:*:progress`

### Issue: Function Timeout

**Symptoms:** 504 Gateway Timeout errors

**Solutions:**
1. Verify `vercel.json` function timeouts are set
2. Check Vercel plan supports required timeouts
3. Move long-running tasks to BullMQ worker
4. Optimize database queries

### Issue: Database Connection Errors

**Symptoms:** `P2024: Timed out fetching a new connection`

**Solutions:**
1. Verify `DATABASE_URL` is correct
2. Check Neon database is active
3. Increase connection pool size in Prisma
4. Use connection pooling (Neon Pooler)

### Issue: Rate Limiting Triggering

**Symptoms:** 429 Too Many Requests

**Solutions:**
1. Check Upstash Redis rate limit configuration
2. Adjust rate limits in `lib/rate-limit.ts`
3. Implement exponential backoff on client
4. Monitor abuse patterns

## Part 7: Scaling Considerations

### 7.1 Horizontal Scaling

**Vercel:** Auto-scales based on traffic (serverless)

**Railway Worker:**
- Current config: 1 instance
- To scale: Update `railway.toml` `maxInstances`
- Worker uses BullMQ concurrency: 2 jobs/instance

### 7.2 Database Scaling

**Neon:**
- Start with shared compute
- Upgrade to dedicated compute for production
- Enable autoscaling for variable load
- Use read replicas for analytics

### 7.3 Redis Scaling

**Upstash:**
- Free tier: 10K commands/day
- Pay-as-you-go: Unlimited
- Enable eviction policies for memory management
- Monitor rate limit buckets

### 7.4 Cost Optimization

**Vercel:**
- Use static generation where possible
- Implement route caching
- Optimize images with Next.js Image
- Monitor bandwidth usage

**Railway:**
- Use sleep mode for dev environments
- Monitor concurrency settings
- Optimize worker memory usage
- Use reserved instances for production

**External APIs:**
- Cache FatSecret API responses
- Implement request deduplication
- Use Claude prompt caching
- Monitor API usage dashboards

## Part 8: Monitoring and Observability

### 8.1 Application Monitoring

**Recommended Tools:**
- Sentry (error tracking) - already integrated
- Vercel Analytics (web vitals)
- Railway Logs (worker monitoring)
- Upstash Insights (Redis metrics)

### 8.2 Alerts

**Set up alerts for:**
- Worker crashes (Railway)
- High error rates (Sentry)
- Database connection issues (Neon)
- API rate limits exceeded (Upstash)
- Function timeout rates (Vercel)

### 8.3 Logs

**Vercel Logs:**
```bash
vercel logs <deployment-url>
```

**Railway Logs:**
```bash
railway logs --service queue-processor
```

**Database Logs:**
- Access via Neon dashboard
- Monitor slow queries
- Check connection pool usage

## Part 9: CI/CD Pipeline (Optional)

### 9.1 GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.28.2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run typecheck
      - run: pnpm turbo run lint
      - run: pnpm turbo run test

  deploy-vercel:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vercel/actions/deploy@latest
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-railway:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-cli@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
      - run: railway up --service queue-processor
```

## Part 10: Security Checklist

- [ ] All API keys stored in environment variables (not in code)
- [ ] `INTERNAL_API_SECRET` is strong and unique
- [ ] Clerk authentication configured correctly
- [ ] Rate limiting enabled on all public endpoints
- [ ] CORS configured properly (Clerk middleware)
- [ ] Database connection uses SSL (Neon default)
- [ ] Redis connection uses TLS (Upstash default)
- [ ] Sentry configured to not log PII
- [ ] Environment variables not exposed to client
- [ ] API routes validate user permissions
- [ ] File uploads validated and scanned
- [ ] SQL injection prevented (Prisma ORM)

## Support

For issues or questions:
1. Check Railway/Vercel logs
2. Review Sentry error reports
3. Consult API provider documentation
4. Open GitHub issue with logs and error details

## Next Steps

1. **Performance Testing:**
   - Load test with 100 concurrent plan generations
   - Measure SSE connection stability
   - Test database query performance

2. **Feature Flags:**
   - Implement gradual rollouts
   - A/B test new features
   - Quick rollback capability

3. **Backup Strategy:**
   - Configure Neon backups (automatic)
   - Export user data periodically
   - Document disaster recovery plan

4. **Compliance:**
   - GDPR data export/deletion
   - HIPAA compliance review (if applicable)
   - Cookie consent banner
   - Privacy policy updates
