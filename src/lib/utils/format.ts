/**
 * Currency and date formatting utilities
 */

/**
 * Formats a number as Philippine Peso (PHP)
 * @param n Number to format
 * @returns Formatted currency string
 */
export function formatCurrency(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(n);
}

/**
 * Formats a number as a compact currency string (e.g. ₱1.2k, ₱3.5M)
 * @param n Number to format
 * @returns Compact formatted currency string
 */
export function formatCompactCurrency(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return formatCurrency(n);
}

/**
 * Formats a date string into a long localized format
 * @param d Date string or null
 * @returns Formatted date string
 */
export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a date string into a human-readable relative time (e.g. "5m ago")
 * @param d Date string or null
 * @returns Relative time string
 */
export function relativeTime(d: string | null) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a date string into a simple time (e.g. "10:30 AM")
 * @param d Date string
 * @returns Formatted time string
 */
export function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
