import { parseBriefDate, formatBriefDate } from "./dateUtils";

/**
 * Get the Monday of the week for a given date
 * @param dateString - Date string like "June 3, 2026"
 * @returns Monday date as Date object
 */
export function getMondayOfWeek(dateString: string): Date {
  const date = parseBriefDate(dateString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

/**
 * Get the Sunday of the week for a given date
 * @param dateString - Date string like "June 3, 2026"
 * @returns Sunday date as Date object
 */
export function getSundayOfWeek(dateString: string): Date {
  const monday = getMondayOfWeek(dateString);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return sunday;
}

/**
 * Get week key for grouping (e.g., "May 27 - Jun 2")
 * @param dateString - Date string like "June 3, 2026"
 * @returns Week key like "May 27 - Jun 2, 2026"
 */
export function getWeekKey(dateString: string): string {
  const monday = getMondayOfWeek(dateString);
  const sunday = getSundayOfWeek(dateString);

  const mondayStr = formatBriefDate(monday);
  const sundayStr = formatBriefDate(sunday);

  // Extract day and month from each
  const [mondayDay, mondayMonth] = mondayStr.split(" ");
  const [sundayDay, sundayMonth, year] = sundayStr.split(" ");

  // Format as "May 27 - Jun 2, 2026"
  return `${mondayMonth} ${mondayDay} - ${sundayMonth} ${sundayDay}, ${year}`;
}

/**
 * Get week start date formatted
 * @param dateString - Date string like "June 3, 2026"
 * @returns Monday of that week formatted as "May 27, 2026"
 */
export function getWeekStartDate(dateString: string): string {
  const monday = getMondayOfWeek(dateString);
  return formatBriefDate(monday);
}

/**
 * Check if two dates are in the same week
 * @param date1 - First date string
 * @param date2 - Second date string
 * @returns true if both dates are in the same Monday-Sunday week
 */
export function isSameWeek(date1: string, date2: string): boolean {
  const monday1 = getMondayOfWeek(date1);
  const monday2 = getMondayOfWeek(date2);
  return monday1.getTime() === monday2.getTime();
}

/**
 * Get current week's Monday
 * @returns Monday of current week
 */
export function getCurrentWeekMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.getFullYear(), today.getMonth(), diff);
}

/**
 * Check if a date is in the current week
 * @param dateString - Date string like "June 3, 2026"
 * @returns true if date is in current week
 */
export function isCurrentWeek(dateString: string): boolean {
  const currentMonday = getCurrentWeekMonday();
  const dateMonday = getMondayOfWeek(dateString);
  return currentMonday.getTime() === dateMonday.getTime();
}

/**
 * Get week number for sorting (0 = current week, -1 = last week, etc.)
 * @param dateString - Date string like "June 3, 2026"
 * @returns Week offset from current week
 */
export function getWeekOffset(dateString: string): number {
  const currentMonday = getCurrentWeekMonday();
  const dateMonday = getMondayOfWeek(dateString);

  const diff = currentMonday.getTime() - dateMonday.getTime();
  const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  return weeks;
}

/**
 * Group briefs by week
 * @param briefs - Array of briefs with date property
 * @returns Object with week keys and array of briefs for each week
 */
export function groupBriefsByWeek<T extends { date: string }>(
  briefs: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const brief of briefs) {
    const weekKey = getWeekKey(brief.date);
    if (!grouped[weekKey]) {
      grouped[weekKey] = [];
    }
    grouped[weekKey].push(brief);
  }

  return grouped;
}

/**
 * Sort week keys from newest to oldest
 * @param weekKeys - Array of week keys like ["May 27 - Jun 2, 2026", "Jun 3 - Jun 9, 2026"]
 * @returns Sorted week keys (newest first)
 */
export function sortWeekKeys(weekKeys: string[]): string[] {
  return weekKeys.sort((a, b) => {
    // Extract the first date from each week key to compare
    const dateA = a.split(" - ")[0];
    const dateB = b.split(" - ")[0];

    const parsedA = parseBriefDate(dateA);
    const parsedB = parseBriefDate(dateB);

    return parsedB.getTime() - parsedA.getTime();
  });
}

/**
 * Get label for week (e.g., "This Week", "Last Week", "2 weeks ago")
 * @param dateString - Date string like "June 3, 2026"
 * @returns Label like "This Week", "Last Week", "2 weeks ago"
 */
export function getWeekLabel(dateString: string): string {
  const offset = getWeekOffset(dateString);

  if (offset === 0) return "This Week";
  if (offset === 1) return "Last Week";
  if (offset === 2) return "2 weeks ago";
  if (offset === 3) return "3 weeks ago";
  if (offset <= 12) return `${offset} weeks ago`;
  return "Archive";
}
