// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InsightsSection } from './InsightsSection';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage[key];
  }),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Mock tRPC hooks
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    insights: {
      getInsights: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
      refreshInsights: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
  },
}));

// Mock InsightCard
vi.mock('./InsightCard', () => ({
  InsightCard: ({
    insight,
    onDismiss,
  }: {
    insight: { id: string; title: string };
    onDismiss: (id: string) => void;
  }) => (
    <div data-testid={`insight-card-${insight.id}`}>
      <span>{insight.title}</span>
      <button data-testid={`dismiss-${insight.id}`} onClick={() => onDismiss(insight.id)}>
        Dismiss
      </button>
    </div>
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockInsights = [
  {
    id: 'insight-1',
    category: 'macro_deficiency',
    title: 'Low Protein Intake',
    body: 'Your protein intake has been below target for the past 7 days.',
    supportingData: { metric: 'Avg Protein', actual: '85g', target: '150g', trend: 'declining' },
    severity: 'warning' as const,
    ctaType: 'adjust_macros' as const,
    ctaLabel: 'Adjust Macros',
  },
  {
    id: 'insight-2',
    category: 'positive_streak',
    title: 'Great Consistency',
    body: 'You have tracked meals for 10 consecutive days!',
    supportingData: { metric: 'Streak', actual: '10', target: '7' },
    severity: 'info' as const,
    ctaType: 'view_trends' as const,
    ctaLabel: 'View Trends',
  },
];

describe('InsightsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mock session storage
    Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);

    // Default mutation mock
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
  });

  it('shows skeleton during loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<InsightsSection />);

    expect(screen.getByTestId('insights-skeleton')).toBeDefined();
  });

  it('renders insight cards when data is available', () => {
    mockUseQuery.mockReturnValue({
      data: { insights: mockInsights, generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    expect(screen.getByText('Low Protein Intake')).toBeDefined();
    expect(screen.getByText('Great Consistency')).toBeDefined();
  });

  it('shows error message when query fails', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    });

    render(<InsightsSection />);

    expect(screen.getByText(/failed to load insights/i)).toBeDefined();
  });

  it('shows insufficient data message', () => {
    mockUseQuery.mockReturnValue({
      data: {
        insights: [],
        generatedAt: new Date().toISOString(),
        fromCache: false,
        insufficientData: true,
        daysTracked: 2,
      },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    expect(screen.getByText(/track at least 3 days/i)).toBeDefined();
    expect(screen.getByText('2/3 days tracked')).toBeDefined();
  });

  it('dismiss button removes an insight from view', async () => {
    mockUseQuery.mockReturnValue({
      data: { insights: mockInsights, generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    expect(screen.getByText('Low Protein Intake')).toBeDefined();
    expect(screen.getByText('Great Consistency')).toBeDefined();

    fireEvent.click(screen.getByTestId('dismiss-insight-1'));

    await waitFor(() => {
      expect(screen.queryByText('Low Protein Intake')).toBeNull();
      expect(screen.getByText('Great Consistency')).toBeDefined();
    });
  });

  it('shows "all dismissed" message when all insights are dismissed', async () => {
    mockUseQuery.mockReturnValue({
      data: { insights: mockInsights, generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    fireEvent.click(screen.getByTestId('dismiss-insight-1'));
    fireEvent.click(screen.getByTestId('dismiss-insight-2'));

    await waitFor(() => {
      expect(screen.getByText(/all insights dismissed/i)).toBeDefined();
    });
  });

  it('refresh button calls mutation', () => {
    const mockMutate = vi.fn();
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
    });

    mockUseQuery.mockReturnValue({
      data: { insights: mockInsights, generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    fireEvent.click(screen.getByTestId('refresh-insights-btn'));

    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('shows "Refreshing..." text while mutation is pending', () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      error: null,
    });

    mockUseQuery.mockReturnValue({
      data: { insights: mockInsights, generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    expect(screen.getByText('Refreshing...')).toBeDefined();
  });

  it('shows refresh error message', () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: { message: 'Refresh failed' },
    });

    mockUseQuery.mockReturnValue({
      data: { insights: mockInsights, generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    expect(screen.getByText('Refresh failed')).toBeDefined();
  });

  it('returns null when there are no insights at all', () => {
    mockUseQuery.mockReturnValue({
      data: { insights: [], generatedAt: new Date().toISOString(), fromCache: false },
      isLoading: false,
      error: null,
    });

    const { container } = render(<InsightsSection />);

    expect(container.innerHTML).toBe('');
  });

  it('uses session cache when available', () => {
    const cachedData = {
      insights: mockInsights,
      generatedAt: new Date().toISOString(),
      timestamp: Date.now(),
    };
    mockSessionStorage['zsn-insights-cache'] = JSON.stringify(cachedData);

    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<InsightsSection />);

    // Should render insights from cache even though query returned nothing
    expect(screen.getByText('Low Protein Intake')).toBeDefined();

    // Query should be called with enabled: false (because sessionCache exists)
    expect(mockUseQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: false })
    );
  });
});
