/**
 * Utility functions for handling Calendly links with correct timezone
 */

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Format a date for Calendly URL parameters in São Paulo timezone
 */
export function formatDateTimeForCalendly(
  scheduledAt: string | Date,
  timeZone: string = TIMEZONE
): { date: string; time: string } {
  const date = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;

  // Use Intl.DateTimeFormat to get parts in the correct timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return {
    date: dateFormatter.format(date), // YYYY-MM-DD format
    time: timeFormatter.format(date), // HH:mm format
  };
}

/**
 * Add date/time parameters to a Calendly link if not already present
 */
export function withCalendlyDateTimeParams(
  baseUrl: string | undefined | null,
  scheduledAt: string | Date,
  timeZone: string = TIMEZONE
): string | undefined {
  if (!baseUrl) return undefined;
  if (!baseUrl.includes('calendly.com')) return baseUrl;
  if (baseUrl.includes('date=') && baseUrl.includes('time=')) return baseUrl;

  const { date, time } = formatDateTimeForCalendly(scheduledAt, timeZone);
  const separator = baseUrl.includes('?') ? '&' : '?';
  
  return `${baseUrl}${separator}date=${date}&time=${time}`;
}
