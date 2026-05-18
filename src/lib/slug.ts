/**
 * Deterministic kebab-case slug generation from a post title.
 * Pure TypeScript — no astro:* imports. Safe to use in Workers and scripts.
 */

const MAX_LENGTH = 60;

/**
 * Converts a post title to a URL-safe kebab-case slug, max 60 characters.
 *
 * Steps:
 *   1. Lowercase
 *   2. Replace non-alphanumeric characters with hyphens
 *   3. Collapse consecutive hyphens to one
 *   4. Strip leading/trailing hyphens
 *   5. Truncate to 60 characters
 *   6. Strip trailing hyphen introduced by truncation
 */
export function toSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, MAX_LENGTH)
		.replace(/-$/, '');
}
