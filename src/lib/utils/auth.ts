/**
 * Auth related utilities
 */

/**
 * Gets the JWT token from local storage
 * @returns token string or empty string
 */
export function getAuthToken(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem("pc_token") ?? "";
}
