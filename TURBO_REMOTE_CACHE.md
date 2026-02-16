# Turbo Remote Cache Setup

Turbo's remote caching feature speeds up builds by sharing build artifacts across machines and CI/CD pipelines. This eliminates redundant work when the same code is built multiple times.

## Benefits

- **Faster CI/CD:** Skip rebuilding unchanged packages
- **Team Collaboration:** Share cache across developers
- **Cost Savings:** Reduce build minutes in CI/CD
- **Consistency:** Same artifacts for same inputs

## How It Works

1. Turbo hashes inputs (source code, dependencies, env vars)
2. Checks if hash exists in remote cache
3. If hit: Downloads cached outputs (instant)
4. If miss: Builds and uploads to cache

## Setup for Vercel Users

The easiest way to enable remote caching is via Vercel:

```bash
# Login to Vercel (one-time)
npx turbo login

# Link to your Vercel team/account (one-time)
npx turbo link
```

This creates `.turbo/config.json` with your credentials:

```json
{
  "teamId": "team_xxx",
  "apiUrl": "https://vercel.com/api"
}
```

**Important:** Add `.turbo/config.json` to `.gitignore` (already done)

## Setup for CI/CD (GitHub Actions)

### Step 1: Generate Token

1. Go to [Vercel Settings > Tokens](https://vercel.com/account/tokens)
2. Create a new token with name: "Turbo Remote Cache"
3. Copy the token

### Step 2: Add GitHub Secrets

Add these secrets to your GitHub repository:

```
TURBO_TOKEN=<your-vercel-token>
TURBO_TEAM=<your-team-slug>
```

To find your team slug:

```bash
# Run locally after `turbo link`
cat .turbo/config.json
# Look for "teamId": "team_xxx" - the xxx part is your slug
```

### Step 3: Update GitHub Actions Workflow

Add environment variables to your workflow:

```yaml
name: CI

on: [push, pull_request]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  build:
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
      - run: pnpm turbo run build
      # Turbo will automatically use remote cache
```

## Verification

### Local Development

```bash
# First build (cold cache)
pnpm turbo run build
# Output: "cache miss, executing..."

# Clean local cache
rm -rf .turbo

# Second build (should use remote cache)
pnpm turbo run build
# Output: "cache hit, replaying logs"
```

### CI/CD

Check GitHub Actions logs for:

```
>>> TURBO
>>> Remote caching enabled
>>> Full Turbo
```

Successful cache hits show:

```
@zsn/web:build: cache hit, replaying logs
```

## Configuration Details

### turbo.json

```json
{
  "remoteCache": {
    "signature": true // Enable signature verification for security
  },
  "tasks": {
    "build": {
      "outputs": [".next/**", "dist/**"],
      "env": [
        "DATABASE_URL",
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        // Environment variables that affect build output
      ]
    }
  }
}
```

### Cache Invalidation

Turbo automatically invalidates cache when:

- Source code changes
- Dependencies change (package.json, pnpm-lock.yaml)
- Environment variables change (listed in `env`)
- Task configuration changes (turbo.json)

### Security

**Signature Verification:**

- `"signature": true` ensures cache artifacts are signed
- Prevents cache poisoning attacks
- Required for secure CI/CD environments

**Access Control:**

- Only team members can access remote cache
- Tokens are scoped to specific teams
- Revoke tokens immediately if compromised

## Troubleshooting

### Issue: Remote cache not working

**Check:**

1. Verify `.turbo/config.json` exists (local)
2. Verify `TURBO_TOKEN` and `TURBO_TEAM` set (CI)
3. Check internet connectivity
4. Verify Vercel account is active

**Debug:**

```bash
# Verbose logging
pnpm turbo run build --verbosity=3
```

### Issue: "No remote cache configured"

**Solution:**

```bash
# Re-link to Vercel
npx turbo login
npx turbo link
```

### Issue: Cache hit but build still runs

**Cause:** Environment variables changed

**Solution:**

- Ensure consistent env vars across builds
- Only include env vars that affect output in `turbo.json`

### Issue: Cache miss every time

**Cause:** Non-deterministic builds or inputs changing

**Check:**

1. Timestamps in files (use deterministic builds)
2. Random values in code
3. External API calls during build
4. File permissions or metadata

## Best Practices

### 1. Minimize Environment Variables

Only include env vars that affect build output:

```json
{
  "tasks": {
    "build": {
      // Include: Public vars, API endpoints, feature flags
      "env": ["NEXT_PUBLIC_*", "API_URL"],
      // Exclude: Secrets, runtime-only vars
      "env": ["!INTERNAL_API_SECRET"]
    }
  }
}
```

### 2. Use Consistent Dependencies

```bash
# Always use frozen lockfile
pnpm install --frozen-lockfile
```

### 3. Optimize Cache Outputs

```json
{
  "tasks": {
    "build": {
      // Include only necessary outputs
      "outputs": [".next/**", "!.next/cache/**"]
      // Exclude large files that don't need caching
    }
  }
}
```

### 4. Monitor Cache Effectiveness

Check Turbo metrics:

```bash
pnpm turbo run build --summarize
```

Look for:

- Cache hit rate (target: >80%)
- Time saved per build
- Bandwidth usage

### 5. Clean Up Old Caches

Vercel automatically expires old cache artifacts after 7 days (default).

To manually clear:

```bash
# Clear local cache
rm -rf .turbo

# Remote cache: Delete via Vercel dashboard
# Settings > Caching > Clear Turbo Cache
```

## Costs

**Vercel Free Tier:**

- Unlimited remote caching
- 6,000 build minutes/month (shared with deployments)

**Vercel Pro:**

- Unlimited remote caching
- 24,000 build minutes/month

**Self-Hosted Alternative:**

If you don't use Vercel, you can self-host the cache:

```bash
# Option 1: Turbo Server (OSS)
# https://github.com/vercel/turbo/tree/main/packages/turbo-server

# Option 2: S3-compatible storage
# Configure in turbo.json
{
  "remoteCache": {
    "enabled": true,
    "url": "https://your-cache-server.com"
  }
}
```

## Alternative: Local-Only Caching

If you don't want remote caching:

```json
{
  "remoteCache": {
    "enabled": false
  }
}
```

Turbo will still use local cache (`.turbo` directory) for speed improvements.

## Further Reading

- [Turbo Remote Cache Docs](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Vercel Remote Caching](https://vercel.com/docs/concepts/monorepos/remote-caching)
- [Turbo CI/CD Guide](https://turbo.build/repo/docs/ci)
- [Cache Security Best Practices](https://turbo.build/repo/docs/core-concepts/remote-caching#security)
