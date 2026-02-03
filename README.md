# ZS-MAC — Zero Sum Nutrition

AI-powered meal planning and macro tracking web application. Transforms your demographics, goals, and dietary preferences into a validated 7-day meal plan with verified nutrition data.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| State | Zustand |
| Backend | Node.js (Next.js serverless + Railway worker) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Cache/Queue | Upstash Redis + BullMQ |
| API | tRPC v11 (end-to-end type safety) |
| Auth | Clerk (magic links + OAuth) |
| AI | Claude SDK (recipe curation) + Claude Vision (food scanning) |
| Nutrition Data | FatSecret Platform API |
| Deployment | Vercel (web) + Railway (worker) |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
zero-sum-nutrition/
├── apps/
│   └── web/                     # Next.js 15 application
│       ├── src/app/             # App Router pages
│       ├── src/components/      # React components
│       ├── src/lib/             # Utilities, tRPC client
│       └── prisma/              # Database schema
├── packages/
│   └── nutrition-engine/        # Standalone AI pipeline
│       ├── src/agents/          # Agents 1-6
│       ├── src/adapters/        # FatSecret adapter
│       ├── src/types/           # Shared Zod schemas
│       └── src/orchestrator.ts  # Pipeline orchestrator
├── workers/
│   └── queue-processor/         # BullMQ worker
├── turbo.json                   # Turborepo config
├── pnpm-workspace.yaml          # Workspace config
└── init.sh                      # Dev environment setup
```

## Quick Start

```bash
# 1. Clone and install
pnpm install

# 2. Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
# Fill in your API keys (see Prerequisites below)

# 3. Set up database
cd apps/web && npx prisma migrate dev && cd ../..

# 4. Start development
pnpm dev

# 5. Open http://localhost:3000
```

Or use the setup script:

```bash
chmod +x init.sh
./init.sh
```

## Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- **Neon PostgreSQL** account (cloud database)
- **Upstash Redis** account (cloud cache/queue)
- **Clerk** account (authentication)
- **Anthropic API** key (Claude for recipe curation)
- **FatSecret Platform API** credentials (nutrition data)

## Environment Variables

Create `apps/web/.env.local` with:

```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
ANTHROPIC_API_KEY=sk-ant-...
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...
REDIS_URL=redis://...
BLOB_READ_WRITE_TOKEN=...
```

## The 6-Agent Nutrition Pipeline

1. **Intake Normalizer** — Validates and normalizes user input to metric
2. **Metabolic Calculator** — Computes BMR, TDEE, goal calories, macro targets
3. **Recipe Curator** (LLM) — Generates diverse meal ideas via Claude
4. **Nutrition Compiler** — Verifies nutrition via FatSecret API
5. **QA Validator** — Enforces ±3% kcal / ±5% macro tolerances
6. **Brand Renderer** — Generates HTML/PDF deliverables

## Core Features

- 6-step onboarding wizard with resumable state
- Real-time plan generation with SSE progress
- 7-day meal plan grid with full recipes
- Meal swap engine (8-15 second target)
- Macro tracking dashboard with animated rings
- FatSecret food search with autocomplete
- Weekly trend charts (Recharts)
- Training day calorie adjustments
- Auto-generated grocery lists by store section
- Dark premium UI with orange accent theme

## Development

```bash
pnpm dev          # Start all services
pnpm build        # Build all packages
pnpm lint         # Lint all packages
```

## License

Private — All rights reserved.
