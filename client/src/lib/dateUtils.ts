/**
 * Date Utilities
 * Centralized date formatting and parsing to ensure consistency across the app
 */

/**
 * Parse a date string like "June 3, 2026" into a Date object
 */
export function parseBriefDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format a date as "D Mon YYYY" (e.g., "3 Jun 2026")
 * Ensures no leading zeros on day
 */
export function formatBriefDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return dateObj.toLocaleDateString("en-US", options);
}

/**
 * Format a date as uppercase "D MON YYYY" (e.g., "3 JUN 2026")
 * Used for masthead display
 */
export function formatBriefDateUppercase(date: Date | string): string {
  return formatBriefDate(date).toUpperCase();
}

/**
 * Get the latest date from a list of date strings
 */
export function getLatestDate(dates: string[]): string {
  if (dates.length === 0) return "";
  return dates.reduce((latest, current) => {
    const latestDate = new Date(latest);
    const currentDate = new Date(current);
    return currentDate > latestDate ? current : latest;
  });
}

/**
 * Compare two date strings
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}
