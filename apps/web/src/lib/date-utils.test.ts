import { describe, it, expect } from 'vitest';
import {
  toLocalDay,
  parseLocalDay,
  formatLocalDay,
  isToday,
  startOfDay,
  endOfDay,
  addDays,
  diffDays,
  isNotFuture,
} from './date-utils';

describe('date-utils', () => {
  describe('toLocalDay', () => {
    it('converts a date to UTC midnight representing the local calendar day', () => {
      const input = new Date('2025-02-03T15:30:00'); // Local time
      const result = toLocalDay(input);

      // Should be Feb 3 at midnight UTC
      expect(result.toISOString()).toBe('2025-02-03T00:00:00.000Z');
    });

    it('handles dates at different times of day', () => {
      const morning = new Date('2025-02-03T08:00:00');
      const evening = new Date('2025-02-03T23:59:59');

      const morningResult = toLocalDay(morning);
      const eveningResult = toLocalDay(evening);

      // Both should normalize to the same day
      expect(morningResult.toISOString()).toBe('2025-02-03T00:00:00.000Z');
      expect(eveningResult.toISOString()).toBe('2025-02-03T00:00:00.000Z');
    });

    it('uses current date when no argument provided', () => {
      const result = toLocalDay();
      const now = new Date();

      // Should be today at midnight
      expect(result.getUTCFullYear()).toBe(now.getFullYear());
      expect(result.getUTCMonth()).toBe(now.getMonth());
      expect(result.getUTCDate()).toBe(now.getDate());
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it('sets time to midnight UTC', () => {
      const input = new Date('2025-02-15T12:34:56.789');
      const result = toLocalDay(input);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('parseLocalDay', () => {
    it('parses ISO date string to local day Date', () => {
      const result = parseLocalDay('2025-02-03');

      expect(result.toISOString()).toBe('2025-02-03T00:00:00.000Z');
    });

    it('handles different dates correctly', () => {
      const dates = ['2025-01-01', '2025-06-15', '2025-12-31'];

      dates.forEach((dateStr) => {
        const result = parseLocalDay(dateStr);
        expect(result.toISOString().split('T')[0]).toBe(dateStr);
      });
    });

    it('handles leap year dates', () => {
      const result = parseLocalDay('2024-02-29');
      expect(result.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });
  });

  describe('formatLocalDay', () => {
    it('formats Date as ISO date string (YYYY-MM-DD)', () => {
      const input = new Date('2025-02-03T15:30:00Z');
      const result = formatLocalDay(input);

      expect(result).toBe('2025-02-03');
    });

    it('handles dates at different times', () => {
      const morning = new Date('2025-02-03T00:00:00');
      const evening = new Date('2025-02-03T23:59:59');

      expect(formatLocalDay(morning)).toBe('2025-02-03');
      expect(formatLocalDay(evening)).toBe('2025-02-03');
    });

    it('formats first day of year', () => {
      const input = new Date('2025-01-01T12:00:00');
      expect(formatLocalDay(input)).toBe('2025-01-01');
    });

    it('formats last day of year', () => {
      const input = new Date('2025-12-31T12:00:00');
      expect(formatLocalDay(input)).toBe('2025-12-31');
    });
  });

  describe('isToday', () => {
    it('returns true for current date', () => {
      const now = new Date();
      expect(isToday(now)).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(isToday(yesterday)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(isToday(tomorrow)).toBe(false);
    });

    it('returns true for today at different times', () => {
      const now = new Date();
      const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
      const evening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      expect(isToday(morning)).toBe(true);
      expect(isToday(evening)).toBe(true);
    });
  });

  describe('startOfDay', () => {
    it('returns midnight UTC for given date', () => {
      const input = new Date('2025-02-03T15:30:00');
      const result = startOfDay(input);

      expect(result.toISOString()).toBe('2025-02-03T00:00:00.000Z');
    });

    it('uses current date when no argument provided', () => {
      const result = startOfDay();
      const now = new Date();

      expect(result.getUTCFullYear()).toBe(now.getFullYear());
      expect(result.getUTCMonth()).toBe(now.getMonth());
      expect(result.getUTCDate()).toBe(now.getDate());
      expect(result.getUTCHours()).toBe(0);
    });
  });

  describe('endOfDay', () => {
    it('returns midnight UTC of next day (exclusive)', () => {
      const input = new Date('2025-02-03T15:30:00');
      const result = endOfDay(input);

      expect(result.toISOString()).toBe('2025-02-04T00:00:00.000Z');
    });

    it('handles month boundary', () => {
      const input = new Date('2025-01-31T12:00:00');
      const result = endOfDay(input);

      expect(result.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    it('handles year boundary', () => {
      const input = new Date('2025-12-31T12:00:00');
      const result = endOfDay(input);

      expect(result.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('uses current date when no argument provided', () => {
      const result = endOfDay();
      const now = new Date();
      const expected = toLocalDay(now);
      expected.setUTCDate(expected.getUTCDate() + 1);

      expect(result.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('addDays', () => {
    it('adds positive days correctly', () => {
      const base = new Date('2025-02-03T12:00:00');
      const result = addDays(base, 5);

      expect(result.toISOString()).toBe('2025-02-08T00:00:00.000Z');
    });

    it('subtracts days when given negative number', () => {
      const base = new Date('2025-02-10T12:00:00');
      const result = addDays(base, -5);

      expect(result.toISOString()).toBe('2025-02-05T00:00:00.000Z');
    });

    it('handles month boundaries', () => {
      const base = new Date('2025-01-28T12:00:00');
      const result = addDays(base, 5);

      expect(result.toISOString()).toBe('2025-02-02T00:00:00.000Z');
    });

    it('handles year boundaries', () => {
      const base = new Date('2025-12-28T12:00:00');
      const result = addDays(base, 5);

      expect(result.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });

    it('returns same day when adding 0 days', () => {
      const base = new Date('2025-02-03T12:00:00');
      const result = addDays(base, 0);

      expect(result.toISOString()).toBe('2025-02-03T00:00:00.000Z');
    });

    it('normalizes to midnight UTC', () => {
      const base = new Date('2025-02-03T23:59:59');
      const result = addDays(base, 1);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });

  describe('diffDays', () => {
    it('calculates difference between two dates', () => {
      const date1 = new Date('2025-02-03');
      const date2 = new Date('2025-02-08');

      expect(diffDays(date1, date2)).toBe(5);
    });

    it('handles negative difference (date2 before date1)', () => {
      const date1 = new Date('2025-02-08');
      const date2 = new Date('2025-02-03');

      expect(diffDays(date1, date2)).toBe(-5);
    });

    it('returns 0 for same day', () => {
      const date1 = new Date('2025-02-03T08:00:00');
      const date2 = new Date('2025-02-03T20:00:00');

      expect(diffDays(date1, date2)).toBe(0);
    });

    it('handles month boundaries', () => {
      const date1 = new Date('2025-01-28');
      const date2 = new Date('2025-02-02');

      expect(diffDays(date1, date2)).toBe(5);
    });

    it('handles year boundaries', () => {
      const date1 = new Date('2025-12-28');
      const date2 = new Date('2026-01-02');

      expect(diffDays(date1, date2)).toBe(5);
    });

    it('ignores time of day', () => {
      const date1 = new Date('2025-02-03T00:00:00');
      const date2 = new Date('2025-02-05T23:59:59');

      expect(diffDays(date1, date2)).toBe(2);
    });
  });

  describe('isNotFuture', () => {
    it('returns true for today', () => {
      const today = new Date();
      expect(isNotFuture(today)).toBe(true);
    });

    it('returns true for past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      expect(isNotFuture(yesterday)).toBe(true);
      expect(isNotFuture(lastWeek)).toBe(true);
    });

    it('returns false for future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      expect(isNotFuture(tomorrow)).toBe(false);
      expect(isNotFuture(nextWeek)).toBe(false);
    });

    it('ignores time of day for today', () => {
      const now = new Date();
      const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const evening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      expect(isNotFuture(morning)).toBe(true);
      expect(isNotFuture(evening)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('parseLocalDay creates consistent UTC dates', () => {
      const original = '2025-02-03';
      const date = parseLocalDay(original);

      // Should be Feb 3 at midnight UTC
      expect(date.toISOString()).toBe('2025-02-03T00:00:00.000Z');

      // Direct ISO split should work
      expect(date.toISOString().split('T')[0]).toBe(original);
    });

    it('parseLocalDay and ISO split round-trip correctly', () => {
      const dates = [
        '2025-01-01',
        '2025-06-15',
        '2025-12-31',
        '2024-02-29', // Leap year
      ];

      dates.forEach((dateStr) => {
        const parsed = parseLocalDay(dateStr);
        const formatted = parsed.toISOString().split('T')[0];
        expect(formatted).toBe(dateStr);
      });
    });

    it('addDays correctly adds days', () => {
      const base = new Date(2025, 1, 3, 12, 0, 0); // Feb 3, 2025 in local time

      const future = addDays(base, 10);

      // Future should be Feb 13 at midnight UTC
      expect(future.toISOString()).toBe('2025-02-13T00:00:00.000Z');
    });

    it('startOfDay and endOfDay create proper range', () => {
      const date = new Date('2025-02-03T15:30:00');
      const start = startOfDay(date);
      const end = endOfDay(date);

      expect(diffDays(start, end)).toBe(1);
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });
});
