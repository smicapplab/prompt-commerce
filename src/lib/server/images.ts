/**
 * Centralized image validation utilities for the seller application.
 * SEC-5: Enforce HTTPS-only for external image URLs.
 */

/**
 * Validates that an image URL is secure (HTTPS) if it's an absolute URL.
 * Relative URLs (local uploads) are permitted.
 * 
 * @param url The image URL to validate
 * @returns true if the URL is considered secure or local, false otherwise
 */
export function isSecureImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;

    // If it's a data URL or relative path, it's considered local/processed
    if (url.startsWith('data:') || url.startsWith('/') || !url.includes('://')) {
        return true;
    }

    // External URLs must be HTTPS
    return url.toLowerCase().startsWith('https://');
}

/**
 * Filters a list of URLs, returning only those that are secure.
 * 
 * @param urls Array of image URLs
 * @returns Filtered array of secure URLs
 */
export function filterSecureImageUrls(urls: (string | null | undefined)[]): string[] {
    return urls.filter((url): url is string => !!url && isSecureImageUrl(url));
}
