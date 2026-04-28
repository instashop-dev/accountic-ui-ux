import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PILLARS, TONES } from './blog-meta';

export { PILLARS, TONES };
export type { Pillar, Tone } from './blog-meta';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			pillar: z.enum(PILLARS),
			author: z.string().default('DPS & Co.'),
			readTime: z.number().int().positive().default(5),
			tone: z.enum(TONES).default('emerald'),
			featured: z.boolean().default(false),
		}),
});

export const collections = { blog };
