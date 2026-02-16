# Phase 5 Tasks 5.5-5.8 Implementation Complete

## Summary

Successfully implemented error tracking, structured logging, pipeline timing instrumentation, and bundle size analysis for Zero Sum Nutrition.

## Task 5.5: Sentry Configuration (Placeholder)

Created placeholder Sentry configuration files ready for activation when a DSN is provided:

### Files Created:

- `/apps/web/sentry.client.config.ts` - Client-side error tracking
- `/apps/web/sentry.server.config.ts` - Server-side error tracking
- `/apps/web/sentry.edge.config.ts` - Edge runtime error tracking

### Configuration:

- Environment-aware (production only)
- Configurable trace sample rate (0.1 = 10%)
- Session replay on errors only
- Enabled only when `NEXT_PUBLIC_SENTRY_DSN` is set

### Environment Variables Needed:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Next Steps:

1. Create a Sentry project at https://sentry.io
2. Add the DSN to environment variables
3. Install Sentry SDK: `pnpm add @sentry/nextjs`
4. The configuration files are ready to use

---

## Task 5.6: Structured JSON Logging with Request Correlation

### Files Created:

- `/apps/web/src/lib/logger.ts` - Structured logging utility

### Files Modified:

- `/apps/web/src/server/trpc.ts` - Added requestId to context

### Features:

- **Structured JSON output** - All logs are JSON formatted for easy parsing
- **Request correlation** - Each request gets a unique `requestId` via header or UUID
- **Log levels** - debug, info, warn, error
- **Metadata support** - Pass arbitrary metadata to any log call
- **Timestamps** - ISO 8601 timestamps on all entries

### Usage:

```typescript
import { logger } from '@/lib/logger';

// In any tRPC procedure
logger.info('User action', {
  requestId: ctx.requestId,
  userId: ctx.userId,
  action: 'meal_plan_generated',
});

logger.error('Pipeline failed', {
  requestId: ctx.requestId,
  error: error.message,
  stage: 'recipe-curator',
});
```

### Example Output:

```json
{
  "level": "info",
  "message": "User action",
  "timestamp": "2026-02-05T09:08:12.345Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "user_123",
  "action": "meal_plan_generated"
}
```

---

## Task 5.7: Pipeline Timing Instrumentation

### Files Modified:

- `/packages/nutrition-engine/src/orchestrator.ts`

### Features:

- **Per-agent timing** - Tracks execution time for each of the 6 agents
- **Total pipeline time** - Measures end-to-end execution
- **Structured logging** - Outputs timing data as JSON
- **Error timing** - Captures partial timings even on failure

### Output Example:

```json
{
  "level": "info",
  "message": "Pipeline completed",
  "timings": {
    "intakeNormalizer": 45,
    "metabolicCalculator": 12,
    "recipeCurator": 8234,
    "nutritionCompiler": 3456,
    "qaValidator": 234,
    "brandRenderer": 1890
  },
  "totalTime": 13871,
  "timestamp": "2026-02-05T09:10:23.456Z"
}
```

### Insights Enabled:

- Identify slow agents that need optimization
- Track performance regressions over time
- Understand Claude API latency impact
- Monitor FatSecret API performance

---

## Task 5.8: Bundle Size Analysis

### Dependencies Added:

- `@next/bundle-analyzer@^16.1.6`

### Files Modified:

- `/apps/web/next.config.ts` - Wrapped config with withBundleAnalyzer
- `/apps/web/package.json` - Added analyze script

### Usage:

```bash
# Run bundle analysis
cd apps/web
pnpm analyze

# Opens interactive treemap visualization in browser
# Shows detailed breakdown of JavaScript bundle sizes
```

### Features:

- **Interactive visualization** - Treemap showing all chunks and modules
- **Size breakdown** - Parsed, gzipped, and minified sizes
- **Identify bloat** - Quickly spot large dependencies
- **Only on demand** - Disabled by default, enabled with ANALYZE=true

### What to Look For:

- Large dependencies that could be lazy-loaded
- Duplicate dependencies across chunks
- Packages that could be replaced with lighter alternatives
- Opportunities for code splitting

---

## Verification Results

All tasks verified successfully:

- ✅ Sentry config files created (3 files)
- ✅ Logger exports the logger object
- ✅ Orchestrator has timing instrumentation
- ✅ tRPC context includes requestId
- ✅ Next.config wrapped with bundle analyzer
- ✅ Package.json has analyze script

---

## DevOps Impact

### Observability

- **Request correlation** - Trace requests across the entire stack
- **Performance monitoring** - Identify slow pipeline stages
- **Error tracking** - Ready for Sentry integration

### Developer Experience

- **Bundle analysis** - Understand and optimize bundle size
- **Structured logs** - Easy parsing and searching in production
- **Timing data** - Data-driven optimization decisions

### Production Readiness

- **Sentry placeholder** - One DSN away from error tracking
- **JSON logging** - Compatible with CloudWatch, Datadog, etc.
- **Performance metrics** - Track pipeline SLAs

---

## Next Steps

1. **Add Sentry DSN** to enable error tracking
2. **Integrate logger** throughout the codebase
3. **Set up log aggregation** (CloudWatch, Datadog, etc.)
4. **Create dashboards** for pipeline timings
5. **Run bundle analysis** to identify optimization opportunities
6. **Set performance budgets** based on timing data

---

## Files Modified/Created

### Created:

- `/apps/web/sentry.client.config.ts`
- `/apps/web/sentry.server.config.ts`
- `/apps/web/sentry.edge.config.ts`
- `/apps/web/src/lib/logger.ts`

### Modified:

- `/apps/web/src/server/trpc.ts` - Added requestId to context
- `/packages/nutrition-engine/src/orchestrator.ts` - Added timing instrumentation
- `/apps/web/next.config.ts` - Added bundle analyzer
- `/apps/web/package.json` - Added analyze script

---

**Implementation Date:** 2026-02-05
**Status:** ✅ Complete and Verified
