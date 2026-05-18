/**
 * Runtime Zod validation for blog post frontmatter.
 * Imports PILLARS and TONES from src/blog-meta.ts — single source of truth.
 * Uses astro/zod (a direct re-export of zod) to match src/content.config.ts.
 *
 * No astro:* imports — safe to use in Workers and Node.js scripts.
 */

import { z } from 'astro/zod';
import { PILLARS, TONES } from '../blog-meta';

// Runtime schema mirrors src/content.config.ts, with heroImage as optional
// string (the Astro image() helper is build-time only and cannot be used here).
const PostFrontmatterSchema = z.object({
	title:       z.string().min(1),
	description: z.string().min(1),
	pubDate:     z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	heroImage:   z.string().optional(),
	pillar:      z.enum(PILLARS),
	author:      z.string().default('Accountic Team'),
	readTime:    z.number().int().positive().default(5),
	tone:        z.enum(TONES).default('emerald'),
	featured:    z.boolean().default(false),
});

export type PostData = z.infer<typeof PostFrontmatterSchema>;

export type ValidationResult =
	| { success: true; data: PostData }
	| { success: false; errors: string[] };

/**
 * Validates raw frontmatter data against the blog post schema.
 * Returns a discriminated union: success with typed data, or failure with
 * a human-readable list of error strings (field path + message).
 */
export function validatePostFrontmatter(data: unknown): ValidationResult {
	const result = PostFrontmatterSchema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data };
	}

	const errors = result.error.issues.map((issue) => {
		const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
		return `${path}: ${issue.message}`;
	});

	return { success: false, errors };
}
