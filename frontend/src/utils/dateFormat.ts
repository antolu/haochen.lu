/**
 * Global date formatting utilities using European locale conventions
 * Using built-in Intl.DateTimeFormat for zero-dependency internationalization
 */

// Global European locale configuration
const DEFAULT_LOCALE = 'en-GB'; // Uses DD/MM/YYYY format

// Pre-configured formatters for better performance
const europeanDateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const europeanShortDateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const europeanSimpleDateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE);

const europeanDateTimeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false, // Use 24-hour format
});

/**
 * Format a date in European style
 * Example: "18 September 2025"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    return europeanDateFormatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Format a date in short European style
 * Example: "18 Sep 2025"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    return europeanShortDateFormatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting short date:', error);
    return '';
  }
}

/**
 * Format a date with time in European style (24-hour format)
 * Example: "18 Sep 2025, 14:30"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    return europeanDateTimeFormatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
}

/**
 * Format a date in simple DD/MM/YYYY format
 * Example: "18/09/2025"
 */
export function formatDateSimple(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    return europeanSimpleDateFormatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting simple date:', error);
    return '';
  }
}

/**
 * Check if a date string/object is valid
 */
export function isValidDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
}
