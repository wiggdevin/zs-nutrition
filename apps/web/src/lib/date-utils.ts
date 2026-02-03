/**
 * Date Utility Functions for Local Time Day Boundaries
 *
 * This module provides functions to handle dates correctly across timezones.
 * The key issue is that JavaScript Dates are internally stored in UTC,
 * but we want to work with local calendar days (midnight to midnight in user's timezone).
 *
 * For example:
 * - A user in Pacific Time (UTC-8) logs a meal at 11:30 PM on Feb 3
 * - In UTC that's 7:30 AM on Feb 4
 * - We want this meal assigned to Feb 3 (the user's local day), not Feb 4
 *
 * Solution: Store dates as UTC midnight representing the local calendar day.
 * Feb 3 local = 2025-02-03T00:00:00.000Z (not the actual UTC time of logging)
 */

/**
 * Converts a date to a UTC midnight timestamp representing the local calendar day.
 *
 * @param date - The date to convert (defaults to now)
 * @returns A Date object set to midnight UTC representing the local calendar day
 *
 * Example:
 * - User in PST (UTC-8) at 2025-02-03 23:30:00 local time
 * - Input: new Date('2025-02-03T23:30:00') // This is stored as 2025-02-04T07:30:00Z in UTC
 * - Output: new Date('2025-02-03T00:00:00Z') // Returns Feb 3 at midnight UTC
 */
export function toLocalDay(date: Date = new Date()): Date {
  // Use local methods (getFullYear, getMonth, getDate) to get the user's calendar day
  // Then create a UTC date with those components
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ))
}

/**
 * Parses an ISO date string (YYYY-MM-DD) to a local day Date object.
 *
 * @param dateString - ISO date string (e.g., "2025-02-03")
 * @returns A Date object set to midnight UTC representing that calendar day
 *
 * Example:
 * - Input: "2025-02-03"
 * - Output: new Date('2025-02-03T00:00:00Z')
 */
export function parseLocalDay(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)) // month is 0-indexed
}

/**
 * Formats a Date as a local day ISO string (YYYY-MM-DD).
 *
 * @param date - The date to format
 * @returns ISO date string (e.g., "2025-02-03")
 *
 * Example:
 * - Input: new Date('2025-02-03T15:30:00Z')
 * - Output: "2025-02-03"
 */
export function formatLocalDay(date: Date): string {
  return toLocalDay(date).toISOString().split('T')[0]
}

/**
 * Checks if a date is today (in local time).
 *
 * @param date - The date to check
 * @returns true if the date is today
 */
export function isToday(date: Date): boolean {
  const today = toLocalDay()
  const target = toLocalDay(date)
  return today.getTime() === target.getTime()
}

/**
 * Gets the start of a day range (inclusive).
 *
 * @param date - The date to get the start of
 * @returns A Date object at midnight UTC
 */
export function startOfDay(date: Date = new Date()): Date {
  return toLocalDay(date)
}

/**
 * Gets the end of a day range (exclusive, for database queries).
 *
 * @param date - The date to get the end of
 * @returns A Date object at midnight UTC of the next day
 */
export function endOfDay(date: Date = new Date()): Date {
  const start = toLocalDay(date)
  return new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + 1
  ))
}

/**
 * Adds days to a date.
 *
 * @param date - The base date
 * @param days - Number of days to add (can be negative)
 * @returns A new Date with the days added
 */
export function addDays(date: Date, days: number): Date {
  const result = toLocalDay(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/**
 * Gets the difference in days between two dates.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between the dates
 */
export function diffDays(date1: Date, date2: Date): number {
  const d1 = toLocalDay(date1).getTime()
  const d2 = toLocalDay(date2).getTime()
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
}

/**
 * Validates that a date is not in the future.
 *
 * @param date - The date to validate
 * @returns true if the date is today or in the past
 */
export function isNotFuture(date: Date): boolean {
  const today = toLocalDay()
  const target = toLocalDay(date)
  return target <= today
}
