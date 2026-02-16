# Deployment Quick Start

Fast-track guide to deploy Zero Sum Nutrition to production in 30 minutes.

## Prerequisites Checklist

- [ ] GitHub repository with code pushed
- [ ] Vercel account (free tier OK)
- [ ] Railway account (free tier OK initially)
- [ ] Neon PostgreSQL database (free tier OK)
- [ ] Upstash Redis account (free tier OK)
- [ ] Clerk account configured
- [ ] Anthropic API key
- [ ] FatSecret Platform API credentials
- [ ] Node.js 20+ installed locally

## 10-Step Deployment

### Step 1: Database Setup (5 min)

1. Create Neon database: https://neon.tech
2. Copy connection string (looks like `postgresql://...`)
3. Run migrations locally:

```bash
cd zero-sum-nutrition/apps/web
export DATABASE_URL="postgresql://..."
pnpm db:push
```

### Step 2: Redis Setup (2 min)

1. Create Upstash Redis: https://upstash.com
2. Copy Redis URL (looks like `redis://...` or `rediss://...`)

### Step 3: Prepare Environment Variables (3 min)

Create a file with all your environment variables:

```bash
# Database
DATABASE_URL=postgresql://...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# FatSecret
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...

# Redis
REDIS_URL=redis://...

# Vercel Blob (will be set automatically by Vercel)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Queue
USE_MOCK_QUEUE=false

# Internal API (generate a random string)
INTERNAL_API_SECRET=<generate-with: openssl rand -base64 32>

# Web App URL (will be set after Vercel deployment)
WEB_APP_URL=https://your-app.vercel.app
```

### Step 4: Deploy to Vercel (5 min)

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Framework:** Next.js
   - **Root Directory:** `apps/web`
   - **Build Command:** `cd ../.. && pnpm turbo run build --filter=@zsn/web`
   - **Output Directory:** `.next`
   - **Install Command:** `pnpm install`
4. Add all environment variables from Step 3
5. Click "Deploy"
6. Wait for deployment (2-3 minutes)
7. Copy the deployed URL (e.g., `https://your-app.vercel.app`)

### Step 5: Update WEB_APP_URL (1 min)

1. In Vercel dashboard, go to Settings > Environment Variables
2. Update `WEB_APP_URL` to your actual Vercel URL
3. No need to redeploy (serverless functions pick up new env vars automatically)

### Step 6: Deploy Worker to Railway (5 min)

1. Go to https://railway.app
2. Click "New Project" > "Deploy from GitHub repo"
3. Select your repository
4. Configure service:
   - **Service Name:** `queue-processor`
   - **Root Directory:** Leave blank (Railway will use Dockerfile)
5. Add environment variables:
   ```bash
   REDIS_URL=redis://...
   ANTHROPIC_API_KEY=sk-ant-...
   FATSECRET_CLIENT_ID=...
   FATSECRET_CLIENT_SECRET=...
   WEB_APP_URL=https://your-app.vercel.app
   INTERNAL_API_SECRET=<same-as-vercel>
   NODE_ENV=production
   ```
6. Railway will auto-detect and use `workers/queue-processor/Dockerfile`
7. Click "Deploy"
8. Monitor logs for: `✅ Worker is running and waiting for jobs...`

### Step 7: Configure Vercel Blob Storage (2 min)

1. In Vercel dashboard, go to Storage
2. Click "Create Database" > "Blob"
3. Connect to your project
4. Vercel will automatically set `BLOB_READ_WRITE_TOKEN`

### Step 8: Setup Turbo Remote Caching (2 min)

```bash
# Login to Vercel
npx turbo login

# Link to your project
npx turbo link
```

This enables build caching across deployments.

### Step 9: Verify Deployment (3 min)

**Test Web App:**

1. Visit your Vercel URL
2. Sign up with Clerk
3. Complete onboarding
4. Generate a meal plan
5. Watch SSE progress stream
6. Verify plan displays

**Check Railway Logs:**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs --service queue-processor
```

Look for job processing:

```
📦 Processing job <id>: generate-plan
  Agent 1 (Intake Normalizer): Cleaning and validating...
  Agent 2 (Metabolic Calculator): Calculating BMR, TDEE...
  ...
✅ Job <id> completed successfully
💾 Plan saved to database: <planId>
```

### Step 10: Production Health Check (2 min)

- [ ] Web app loads without errors
- [ ] Authentication works (sign up/in)
- [ ] Onboarding saves profile
- [ ] Meal plan generation completes
- [ ] SSE streaming shows real-time progress
- [ ] Dashboard displays data
- [ ] Vision API analyzes food photos
- [ ] No errors in Vercel logs
- [ ] No errors in Railway logs
- [ ] Database connections stable

## Common Issues & Quick Fixes

### Issue: "Failed to fetch" errors

**Cause:** CORS or API route issues

**Fix:**

```bash
# Check Vercel deployment logs
vercel logs <your-url>

# Verify environment variables set
# Vercel Dashboard > Settings > Environment Variables
```

### Issue: Plans stuck in "pending"

**Cause:** Worker not processing jobs

**Fix:**

1. Check Railway service is running (not crashed)
2. Verify `REDIS_URL` matches Vercel and Railway
3. Check Railway logs for errors
4. Restart Railway service

### Issue: "Unauthorized" errors

**Cause:** Clerk not configured correctly

**Fix:**

1. Verify Clerk publishable key is PUBLIC (starts with `pk_`)
2. Verify Clerk secret key is correct (starts with `sk_`)
3. Check Clerk dashboard > Application > API Keys
4. Ensure domain is added to Clerk allowed domains

### Issue: SSE not streaming

**Cause:** Redis pub/sub not working

**Fix:**

1. Test Redis connection:
   ```bash
   redis-cli -u $REDIS_URL ping
   ```
2. Check Upstash dashboard for connection errors
3. Verify `REDIS_URL` uses `rediss://` (TLS) for Upstash
4. Check Vercel function logs

## Post-Deployment Tasks

### Enable Monitoring

1. **Sentry (already integrated):**
   - Errors automatically tracked
   - Check dashboard for issues

2. **Vercel Analytics:**
   - Enable in Vercel dashboard
   - Monitor web vitals

3. **Railway Metrics:**
   - Monitor CPU/memory usage
   - Set up alerts for service downtime

### Configure Alerts

**Railway:**

- Settings > Notifications > Slack/Discord/Email
- Alert on: Service crash, high CPU, high memory

**Vercel:**

- Dashboard > Settings > Notifications
- Alert on: Deployment failures, function errors

**Upstash:**

- Dashboard > Alerts
- Alert on: Connection issues, memory limits

### Backup Strategy

**Database (Neon):**

- Free tier: 7-day point-in-time recovery
- Pro tier: 30-day recovery
- Manual backups: `pg_dump` weekly

**Redis (Upstash):**

- Persistence enabled by default
- Daily backups (Pro plan)

### Performance Optimization

1. **Enable Vercel Edge Functions:**
   - Move static content to edge
   - Reduce latency for global users

2. **Database Connection Pooling:**
   - Use Neon Pooler for high traffic
   - Configure in `DATABASE_URL`

3. **Worker Concurrency:**
   - Default: 2 jobs per instance
   - Increase for high volume
   - Edit `workers/queue-processor/src/index.ts`

4. **Redis Optimization:**
   - Enable eviction policies
   - Monitor memory usage
   - Upgrade plan if needed

## Scaling Checklist

When you're ready to scale:

- [ ] Upgrade Vercel to Pro ($20/mo)
  - Increased function execution time
  - More bandwidth
  - Better support

- [ ] Upgrade Railway ($5-20/mo)
  - Dedicated resources
  - Better uptime
  - Multiple worker instances

- [ ] Upgrade Neon to Pro ($19/mo)
  - Dedicated compute
  - Autoscaling
  - Better performance

- [ ] Upgrade Upstash to Pay-as-you-go
  - Unlimited commands
  - Better throughput
  - No daily limits

- [ ] Add CDN for images
  - Cloudflare Images
  - Vercel Image Optimization
  - Reduce bandwidth costs

## Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] `INTERNAL_API_SECRET` is strong (32+ characters)
- [ ] Clerk production instance configured
- [ ] Database uses SSL (Neon default)
- [ ] Redis uses TLS (Upstash default)
- [ ] Rate limiting enabled (already implemented)
- [ ] CORS configured correctly (Clerk middleware)
- [ ] Sentry configured to not log PII
- [ ] API keys not exposed to client
- [ ] File uploads validated

## Next Steps

1. **Set up CI/CD:** Automate testing and deployment
2. **Configure custom domain:** Point your domain to Vercel
3. **Enable edge caching:** Speed up global delivery
4. **Add monitoring dashboards:** Track metrics and errors
5. **Implement feature flags:** Gradual rollouts and A/B testing
6. **Document API:** Generate OpenAPI/Swagger docs
7. **Add end-to-end tests:** Playwright tests for critical flows
8. **Set up staging environment:** Test changes before production

## Resources

- **Full Deployment Guide:** See `DEPLOYMENT.md`
- **Turbo Remote Cache:** See `TURBO_REMOTE_CACHE.md`
- **Architecture Docs:** See `README.md`
- **API Documentation:** See `/docs` directory

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Railway Docs:** https://docs.railway.app
- **Neon Docs:** https://neon.tech/docs
- **Upstash Docs:** https://docs.upstash.com
- **Turbo Docs:** https://turbo.build/repo/docs

## Success!

If you've completed all steps and health checks pass, your application is now live in production!

**Your deployment:**

- Web App: https://your-app.vercel.app
- Worker: Running on Railway
- Database: Hosted on Neon
- Redis: Hosted on Upstash
- Cache: Turbo remote cache enabled

**Performance targets:**

- Page load: <2s
- Plan generation: 120-180s
- Vision analysis: <10s
- API response: <500ms
- Uptime: >99.5%

Monitor these metrics and iterate to improve performance and reliability.
