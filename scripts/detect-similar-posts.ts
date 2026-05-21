#!/usr/bin/env tsx
/**
 * Accountic Blog Automation — Similar Post Detector
 *
 * Scans all published blog posts for pairwise bigram-Jaccard similarity and
 * writes a ranked report of pairs above the threshold.
 *
 * Usage:
 *   npx tsx scripts/detect-similar-posts.ts
 *   npx tsx scripts/detect-similar-posts.ts --threshold 0.65
 *   npx tsx scripts/detect-similar-posts.ts --threshold 0.4 --verbose
 *
 * Output:
 *   similar-posts-report.md   — human-readable Markdown table per pair
 *   similar-posts-report.json — machine-readable array for --from-report
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../src/lib/frontmatter';
import { computeBigramJaccard } from '../src/lib/regression';

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let threshold = 0.55;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--threshold' && args[i + 1]) {
    threshold = parseFloat(args[++i]);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      process.stderr.write('Error: --threshold must be a number between 0 and 1\n');
      process.exit(1);
    }
  } else if (args[i] === '--verbose') {
    verbose = true;
  }
}

// ── File discovery ────────────────────────────────────────────────────────────

function findBlogFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ── Post loading ──────────────────────────────────────────────────────────────

interface Post {
  slug: string;
  title: string;
  pubDate: string;
  body: string;
}

const blogDir = path.resolve('src/content/blog');
const files = findBlogFiles(blogDir);

const posts: Post[] = [];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  const slug = path.basename(file).replace(/\.(mdx?)$/, '');
  posts.push({
    slug,
    title: String(data.title ?? slug),
    pubDate: String(data.pubDate ?? ''),
    body: content,
  });
}

process.stdout.write(`Loaded ${posts.length} posts from src/content/blog/\n`);
process.stdout.write(`Running pairwise comparison (threshold: ${threshold.toFixed(2)})...\n`);

// ── Pairwise comparison ───────────────────────────────────────────────────────

interface SimilarPair {
  slugA: string;
  slugB: string;
  score: number;
  titleA: string;
  titleB: string;
  pubDateA: string;
  pubDateB: string;
}

const pairs: SimilarPair[] = [];
const total = (posts.length * (posts.length - 1)) / 2;
let checked = 0;

for (let i = 0; i < posts.length; i++) {
  for (let j = i + 1; j < posts.length; j++) {
    const a = posts[i];
    const b = posts[j];
    const score = computeBigramJaccard(a.body, b.body);
    checked++;

    if (verbose) {
      process.stdout.write(`  [${checked}/${total}] ${a.slug} <-> ${b.slug}: ${score.toFixed(3)}\n`);
    }

    if (score >= threshold) {
      pairs.push({
        slugA: a.slug,
        slugB: b.slug,
        score,
        titleA: a.title,
        titleB: b.title,
        pubDateA: a.pubDate,
        pubDateB: b.pubDate,
      });
    }
  }
}

// ── No matches ────────────────────────────────────────────────────────────────

if (pairs.length === 0) {
  process.stdout.write(`No similar pairs found above threshold ${threshold.toFixed(2)}\n`);
  process.exit(0);
}

// ── Sort by score descending ──────────────────────────────────────────────────

pairs.sort((a, b) => b.score - a.score);

// ── Write JSON report ─────────────────────────────────────────────────────────

writeFileSync('similar-posts-report.json', JSON.stringify(pairs, null, 2), 'utf8');

// ── Write Markdown report ─────────────────────────────────────────────────────

const lines: string[] = [
  '# Similar Posts Report',
  '',
  `Threshold: \`${threshold.toFixed(2)}\` | Pairs found: **${pairs.length}** | Total posts: ${posts.length}`,
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '> To delete the older post from each pair:',
  '> `npx tsx scripts/delete-similar-posts.ts --from-report similar-posts-report.json --dry-run`',
  '',
  '---',
  '',
];

for (const p of pairs) {
  lines.push(`## Score: ${p.score.toFixed(3)}`);
  lines.push('');
  lines.push('| Field | Post A | Post B |');
  lines.push('|-------|--------|--------|');
  lines.push(`| **Slug** | \`${p.slugA}\` | \`${p.slugB}\` |`);
  lines.push(`| **Title** | ${p.titleA} | ${p.titleB} |`);
  lines.push(`| **Published** | ${p.pubDateA} | ${p.pubDateB} |`);
  lines.push('');
}

writeFileSync('similar-posts-report.md', lines.join('\n'), 'utf8');

// ── Summary ───────────────────────────────────────────────────────────────────

process.stdout.write(`\nFound ${pairs.length} similar pair(s) above threshold ${threshold.toFixed(2)}\n`);
process.stdout.write(`Reports written to:\n`);
process.stdout.write(`  similar-posts-report.md\n`);
process.stdout.write(`  similar-posts-report.json\n`);
