// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FoodScan from './FoodScan';

// Mock the sub-components to isolate FoodScan logic
vi.mock('./food-scan/IdleState', () => ({
  IdleState: ({
    fileInputRef,
    onFileSelect,
  }: {
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <div data-testid="idle-state">
      <input ref={fileInputRef} type="file" data-testid="file-input" onChange={onFileSelect} />
      <button data-testid="camera-btn">Snap Your Meal</button>
    </div>
  ),
}));

vi.mock('./food-scan/AnalyzingState', () => ({
  AnalyzingState: ({ imageData }: { imageData: string | null }) => (
    <div data-testid="analyzing-state">
      Analyzing...{imageData && <img src={imageData} alt="preview" />}
    </div>
  ),
}));

vi.mock('./food-scan/ReviewState', () => ({
  ReviewState: ({
    adjustedResult,
    onReset,
    onConfirm,
    onAdjust,
    onNameChange,
  }: {
    adjustedResult: { meal_name: string; estimated_nutrition: Record<string, number> };
    onReset: () => void;
    onConfirm: () => void;
    onAdjust: (field: string, value: string) => void;
    onNameChange: (name: string) => void;
  }) => (
    <div data-testid="review-state">
      <span data-testid="meal-name">{adjustedResult.meal_name}</span>
      <span data-testid="calories">{adjustedResult.estimated_nutrition.calories}</span>
      <button data-testid="confirm-btn" onClick={onConfirm}>
        Log Meal
      </button>
      <button data-testid="cancel-btn" onClick={onReset}>
        Cancel
      </button>
      <button data-testid="adjust-btn" onClick={() => onAdjust('calories', '9999')}>
        Adjust
      </button>
      <button data-testid="name-btn" onClick={() => onNameChange('New Name')}>
        Rename
      </button>
    </div>
  ),
}));

vi.mock('./food-scan/ErrorState', () => ({
  ErrorState: ({ error, onReset }: { error: string; onReset: () => void }) => (
    <div data-testid="error-state">
      <span data-testid="error-msg">{error}</span>
      <button data-testid="try-again-btn" onClick={onReset}>
        Try Again
      </button>
    </div>
  ),
}));

vi.mock('./food-scan/SuccessState', () => ({
  SuccessState: () => <div data-testid="success-state">Meal Logged!</div>,
}));

// Mock ClaudeVisionClient
vi.mock('@/lib/vision/claude-vision', () => ({
  ClaudeVisionClient: {
    validateImageFile: vi.fn(),
    fileToBase64: vi.fn(),
  },
}));

// Get references to mocked statics
import { ClaudeVisionClient } from '@/lib/vision/claude-vision';
const mockValidate = vi.mocked(ClaudeVisionClient.validateImageFile);
const mockFileToBase64 = vi.mocked(ClaudeVisionClient.fileToBase64);

// Helper to create a mock File
function createMockFile(name = 'meal.jpg', size = 50000, type = 'image/jpeg') {
  const content = new ArrayBuffer(size);
  return new File([content], name, { type });
}

// Mock analysis result
const mockAnalysisResult = {
  meal_name: 'Grilled Chicken Salad',
  description: 'A fresh salad with grilled chicken',
  ingredients: [{ name: 'Chicken breast', amount: '150g', confidence: 'high' as const }],
  estimated_nutrition: { calories: 450, protein_g: 45, carbs_g: 20, fat_g: 15 },
  portion_size_estimate: 'Medium',
  confidence_score: 85,
  warnings: [],
};

describe('FoodScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders idle state by default', () => {
    render(<FoodScan />);
    expect(screen.getByTestId('idle-state')).toBeDefined();
  });

  it('shows error state when file validation fails', async () => {
    mockValidate.mockReturnValue({
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
    });

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    const file = createMockFile('bad.gif', 50000, 'image/gif');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeDefined();
      expect(screen.getByTestId('error-msg').textContent).toContain('Invalid file type');
    });
  });

  it('transitions to analyzing state after valid file selection', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc123');
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ scanId: 'scan-1', result: mockAnalysisResult }), {
        status: 200,
      })
    );

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    // Should show analyzing state while fetch is in progress
    await waitFor(() => {
      // It transitions quickly to reviewing once fetch resolves
      const analyzing = screen.queryByTestId('analyzing-state');
      const reviewing = screen.queryByTestId('review-state');
      expect(analyzing !== null || reviewing !== null).toBe(true);
    });
  });

  it('transitions to review state after successful analysis', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc123');
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ scanId: 'scan-1', result: mockAnalysisResult }), {
        status: 200,
      })
    );

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('review-state')).toBeDefined();
      expect(screen.getByTestId('meal-name').textContent).toBe('Grilled Chicken Salad');
    });
  });

  it('shows error state when analysis API fails', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc123');
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Vision API unavailable' }), { status: 500 })
    );

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeDefined();
      expect(screen.getByTestId('error-msg').textContent).toContain('Vision API unavailable');
    });
  });

  it('shows error state when fileToBase64 throws', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockRejectedValue(new Error('Failed to read file'));

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeDefined();
      expect(screen.getByTestId('error-msg').textContent).toContain('Failed to read file');
    });
  });

  it('Try Again button from error state resets to idle', async () => {
    mockValidate.mockReturnValue({ valid: false, error: 'Test error' });

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('try-again-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('idle-state')).toBeDefined();
    });
  });

  it('Cancel button from review state resets to idle', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc');
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ scanId: 'scan-1', result: mockAnalysisResult }), {
        status: 200,
      })
    );

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('review-state')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('cancel-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('idle-state')).toBeDefined();
    });
  });

  it('transitions to success state after confirming meal', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc');
    // First fetch: analyze
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ scanId: 'scan-1', result: mockAnalysisResult }), {
          status: 200,
        })
      )
      // Second fetch: log-meal
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('review-state')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeDefined();
    });
  });

  it('shows error when log-meal API fails', async () => {
    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc');
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ scanId: 'scan-1', result: mockAnalysisResult }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Failed to log meal' }), { status: 500 })
      );

    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('review-state')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeDefined();
      expect(screen.getByTestId('error-msg').textContent).toContain('Failed to log meal');
    });
  });

  it('calls onMealLogged callback after success timeout', async () => {
    const onMealLogged = vi.fn();

    mockValidate.mockReturnValue({ valid: true });
    mockFileToBase64.mockResolvedValue('data:image/jpeg;base64,abc');
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ scanId: 'scan-1', result: mockAnalysisResult }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    render(<FoodScan onMealLogged={onMealLogged} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByTestId('review-state')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeDefined();
    });

    // The component calls onMealLogged after a 2s setTimeout.
    // Wait for it with a longer timeout instead of fake timers (avoids waitFor conflicts).
    await waitFor(
      () => {
        expect(onMealLogged).toHaveBeenCalledOnce();
      },
      { timeout: 3000 }
    );
  });

  it('ignores file change event with no files', () => {
    render(<FoodScan />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [] } });

    // Should stay in idle state
    expect(screen.getByTestId('idle-state')).toBeDefined();
  });
});
