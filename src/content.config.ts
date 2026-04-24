import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const PILLARS = [
	'Income Tax Notices',
	'Faceless Assessment',
	'DPDP Compliance',
	'ICAI Ethics',
	'Case Law Notes',
	'Firm Operations',
] as const;

export const TONES = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'] as const;

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
