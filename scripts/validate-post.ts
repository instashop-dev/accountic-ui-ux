#!/usr/bin/env tsx
/**
 * Accountic Blog Automation — Pre-publish Frontmatter Validator
 *
 * Validates a blog post's frontmatter against the Zod schema before committing.
 *
 * Usage:
 *   npm run blog:validate <path-to-post.md>
 *   npx tsx scripts/validate-post.ts src/content/blog/my-post.md
 *
 * Exit codes:
 *   0 — valid
 *   1 — invalid or usage error
 */

import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseFrontmatter } from '../src/lib/frontmatter';
import { validatePostFrontmatter } from '../src/lib/schema-validate';
import { scoreArticle } from '../src/lib/quality';
import { toSlug } from '../src/lib/slug';

const filePath = process.argv[2];

if (!filePath) {
	process.stderr.write(
		'Usage: npx tsx scripts/validate-post.ts <path-to-post.md>\n' +
		'   or: npm run blog:validate <path-to-post.md>\n',
	);
	process.exit(1);
}

const absPath = resolve(filePath);

let raw: string;
try {
	raw = readFileSync(absPath, 'utf8');
} catch {
	process.stderr.write(`Error: File not found: ${absPath}\n`);
	process.exit(1);
}

const { data } = parseFrontmatter(raw);
const result = validatePostFrontmatter(data);

if (!result.success) {
	process.stderr.write(`✗ Invalid frontmatter in: ${filePath}\n\n`);
	for (const err of result.errors) {
		process.stderr.write(`  • ${err}\n`);
	}
	process.stderr.write('\n');
	process.exit(1);
}

const slug = basename(absPath).replace(/\.(md|mdx)$/, '');
const qualityReport = scoreArticle(raw, data as Record<string, unknown>, slug);

process.stdout.write(`✓ Frontmatter valid: ${result.data.title}\n`);
process.stdout.write(`  title:              ${result.data.title}\n`);
process.stdout.write(`  pillar:             ${result.data.pillar}\n`);
process.stdout.write(`  tone:               ${result.data.tone}\n`);
process.stdout.write(`  pubDate:            ${result.data.pubDate.toISOString().slice(0, 10)}\n`);
process.stdout.write(`\nQuality checks:\n`);
process.stdout.write(`  readability:        ${qualityReport.scores.readability.toFixed(1)}\n`);
process.stdout.write(`  originality:        ${qualityReport.scores.originality}\n`);
process.stdout.write(`  schemaValid:        ${qualityReport.scores.schemaValid}\n`);
process.stdout.write(`  audienceVoiceValid: ${qualityReport.scores.audienceVoiceValid}\n`);

if (!qualityReport.passed) {
	process.stderr.write(`\n✗ Quality checks failed:\n`);
	for (const err of qualityReport.errors) {
		process.stderr.write(`  • ${err}\n`);
	}
	process.stderr.write('\n');
	process.exit(1);
}

process.stdout.write(`\n✓ All checks passed\n`);
process.exit(0);
