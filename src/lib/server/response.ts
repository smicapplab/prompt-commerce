import { json } from '@sveltejs/kit';

/**
 * Standardizes API error responses across the seller application.
 * Returns a SvelteKit JSON response with consistent { error: string } format.
 * 
 * @param status HTTP status code
 * @param message Error message
 * @returns SvelteKit JSON response
 */
export function apiError(status: number, message: string) {
    return json({ error: message }, { status });
}
