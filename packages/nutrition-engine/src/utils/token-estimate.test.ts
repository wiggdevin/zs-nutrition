import { describe, it, expect } from 'vitest';
import { estimateTokens, MAX_PROMPT_TOKENS } from './token-estimate';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates correctly for short text (ceil of length / 4)', () => {
    // "hello" = 5 chars -> ceil(5/4) = 2
    expect(estimateTokens('hello')).toBe(2);
    // "hi" = 2 chars -> ceil(2/4) = 1
    expect(estimateTokens('hi')).toBe(1);
    // "test" = 4 chars -> ceil(4/4) = 1
    expect(estimateTokens('test')).toBe(1);
  });

  it('estimates correctly for long text', () => {
    const longText = 'a'.repeat(1000);
    expect(estimateTokens(longText)).toBe(250);

    // Non-divisible by 4: 1001 chars -> ceil(1001/4) = 251
    const slightlyLonger = 'a'.repeat(1001);
    expect(estimateTokens(slightlyLonger)).toBe(251);
  });
});

describe('MAX_PROMPT_TOKENS', () => {
  it('is 180000', () => {
    expect(MAX_PROMPT_TOKENS).toBe(180000);
  });
});
