import { json } from '@sveltejs/kit';

/**
 * Standardizes API error responses across the seller application.
 * Returns a SvelteKit JSON response with consistent { error: string, code?: string } format.
 * 
 * @param status HTTP status code
 * @param message Error message
 * @param code Optional internal error code
 * @returns SvelteKit JSON response
 */
export function apiError(status: number, message: string, code?: string) {
    return json({ error: message, code }, { status });
}
