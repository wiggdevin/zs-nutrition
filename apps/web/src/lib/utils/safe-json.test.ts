import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { safeJsonParse } from './safe-json';

describe('safeJsonParse', () => {
  const stringSchema = z.string();
  const numberSchema = z.number();

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, stringSchema, 'default')).toBe('default');
  });

  it('returns fallback for undefined input', () => {
    expect(safeJsonParse(undefined, stringSchema, 'default')).toBe('default');
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', stringSchema, 'default')).toBe('default');
  });

  it('parses valid JSON that matches schema', () => {
    expect(safeJsonParse('"hello"', stringSchema, 'default')).toBe('hello');
    expect(safeJsonParse('42', numberSchema, 0)).toBe(42);
  });

  it('returns fallback for valid JSON that fails schema validation', () => {
    // JSON parses fine as a number, but schema expects a string
    expect(safeJsonParse('42', stringSchema, 'default')).toBe('default');
  });

  it('returns fallback for malformed JSON', () => {
    expect(safeJsonParse('{invalid json}', stringSchema, 'default')).toBe('default');
    expect(safeJsonParse('not json at all', numberSchema, -1)).toBe(-1);
  });

  it('works with complex nested schemas', () => {
    const userSchema = z.object({
      name: z.string(),
      age: z.number(),
      address: z.object({
        city: z.string(),
      }),
    });

    const fallback = { name: 'Unknown', age: 0, address: { city: 'N/A' } };

    const validJson = JSON.stringify({ name: 'Alice', age: 30, address: { city: 'NYC' } });
    const result = safeJsonParse(validJson, userSchema, fallback);
    expect(result).toEqual({ name: 'Alice', age: 30, address: { city: 'NYC' } });

    // Missing required field
    const invalidJson = JSON.stringify({ name: 'Bob' });
    expect(safeJsonParse(invalidJson, userSchema, fallback)).toEqual(fallback);
  });

  it('works with array schemas', () => {
    const arraySchema = z.array(z.number());
    const fallback: number[] = [];

    expect(safeJsonParse('[1, 2, 3]', arraySchema, fallback)).toEqual([1, 2, 3]);
    expect(safeJsonParse('["a", "b"]', arraySchema, fallback)).toEqual(fallback);
  });

  it('returns fallback type correctly (type safety)', () => {
    const schema = z.object({ id: z.number(), label: z.string() });
    const fallback = { id: 0, label: 'none' };

    // Valid parse
    const valid = safeJsonParse('{"id": 1, "label": "test"}', schema, fallback);
    expect(valid.id).toBe(1);
    expect(valid.label).toBe('test');

    // Invalid parse returns the exact fallback object
    const invalid = safeJsonParse('{}', schema, fallback);
    expect(invalid).toBe(fallback);
  });
});
