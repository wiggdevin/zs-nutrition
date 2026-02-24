# ADR-001: Testing Strategy

## Status

Adopted (Phase 5)

## Context

The ZS-MAC codebase has grown to include complex UI components, tRPC routers, and utility functions. Previously, only tRPC routers had test coverage (`tracking.test.ts`). To ensure reliability and facilitate refactoring, we needed to establish a comprehensive testing strategy.

### Challenges

- React component testing requires different tools than backend logic
- tRPC queries/mutations are async and require mocking
- Some components handle external APIs (Claude Vision, FatSecret)
- Need to balance test coverage with maintenance burden

## Decision

Adopt **Vitest + React Testing Library** for all component and utility tests. Use **tRPC mocking** patterns from existing router tests.

### Testing Levels

1. **Unit Tests** — Utility functions, hooks, and simple components
   - Fast execution
   - Mock external dependencies
   - Example: `rate-limit.test.ts`

2. **Component Tests** — React components with user interaction
   - Test user-facing behavior, not implementation
   - Mock tRPC hooks, API calls
   - Use React Testing Library (not Enzyme or Snapshot testing)
   - Example: `ErrorBoundary.test.tsx`, `FoodScan.test.tsx`

3. **Integration Tests** — Full feature flows across multiple components
   - Test from user perspective
   - Mock external APIs only
   - Lower frequency (only critical paths)

4. **Router Tests** — tRPC procedure logic (already established)
   - Mock Prisma, external APIs
   - Test error handling, validation, permissions
   - Example: `tracking.test.ts`

## Implementation

### Environment Configuration

- **Backend/utility tests**: Use default `node` environment (set in `vitest.config.ts`)
- **Component tests**: Use `// @vitest-environment jsdom` directive at the top of each file
- This avoids changing the global config and breaking existing server tests

### Naming Convention

- Colocate tests with source files: `Component.test.tsx`, `utility.test.ts`
- Test files use `*.test.ts` or `*.test.tsx` extension

### File Structure

```
apps/web/
├── src/
│   ├── components/
│   │   ├── tracking/
│   │   │   ├── FoodScan.tsx
│   │   │   └── FoodScan.test.tsx
│   │   ├── dashboard/
│   │   │   ├── InsightsSection.tsx
│   │   │   └── InsightsSection.test.tsx
│   │   └── ui/
│   │       ├── ErrorBoundary.tsx
│   │       └── ErrorBoundary.test.tsx
│   ├── lib/
│   │   ├── rate-limit.ts
│   │   └── rate-limit.test.ts
│   └── server/
│       └── routers/
│           ├── tracking.ts
│           └── tracking.test.ts
```

### Mocking Strategy

**tRPC Hooks** (for component tests):

```typescript
const mockUseQuery = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    insights: {
      getInsights: { useQuery: (...args) => mockUseQuery(...args) },
    },
  },
}));
```

**Sub-components** (for isolating parent logic):

```typescript
vi.mock('./food-scan/IdleState', () => ({
  IdleState: (props) => <div data-testid="idle-state">...</div>,
}));
```

**External APIs**: Mock at the API client level (`ClaudeVisionClient`, `fetch`)

### Test Coverage Goals

- **Minimum**: 50% line coverage (configured threshold in vitest.config.ts)
- **Target**: 70%+ for critical components and utilities
- **High-value targets**: Components with complex logic, tRPC routers, rate limiting

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific file
pnpm test -- --run apps/web/src/lib/rate-limit.test.ts

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Consequences

### Positive

- Confidence in refactoring
- Catch regressions early
- Faster feedback loop during development
- Tests serve as documentation for component behavior

### Negative

- Additional maintenance burden (tests must update when code changes)
- Initial time investment to establish patterns and mocks
- Some deeply nested components may be harder to test

## Alternatives Considered

### 1. No Tests (Previous Approach)

- Rejected: Risk outweighs benefits at this codebase size

### 2. Only E2E Tests (Playwright)

- Rejected: Better as supplement; too slow and brittle as primary strategy

### 3. Jest + Enzyme

- Rejected: Vitest is faster and more modern; RTL encourages better testing practices

## References

- Vitest: https://vitest.dev/
- React Testing Library: https://testing-library.com/react
- tRPC Testing: https://trpc.io/docs/server/testing
- Testing Best Practices: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
