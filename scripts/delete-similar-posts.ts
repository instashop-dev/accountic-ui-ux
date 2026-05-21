#!/usr/bin/env tsx
/**
 * Accountic Blog Automation — Delete Similar Posts
 *
 * Removes identified duplicate/similar posts from the filesystem and D1.
 * Defaults to dry-run — pass --confirm to execute deletions.
 *
 * Usage:
 *   npx tsx scripts/delete-similar-posts.ts --slugs slug-a,slug-b --dry-run
 *   npx tsx scripts/delete-similar-posts.ts --from-report similar-posts-report.json
 *   npx tsx scripts/delete-similar-posts.ts --slugs slug-a --env production --confirm
 *
 * Deletion order (respects FK constraints):
 *   1. generation_jobs WHERE post_id = posts.id
 *   2. drafts WHERE slug = ?
 *   3. posts WHERE slug = ?
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let slugsList: string[] = [];
let fromReport = '';
let confirm = false;
let env = 'local';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--slugs' && args[i + 1]) {
    slugsList = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
  } else if (args[i] === '--from-report' && args[i + 1]) {
    fromReport = args[++i];
  } else if (args[i] === '--confirm') {
    confirm = true;
  } else if (args[i] === '--env' && args[i + 1]) {
    env = args[++i];
  }
}

if (!slugsList.length && !fromReport) {
  process.stderr.write('Error: Provide --slugs <slug1,slug2> or --from-report <path>\n\n');
  process.stderr.write('Usage:\n');
  process.stderr.write('  npx tsx scripts/delete-similar-posts.ts --slugs slug-a,slug-b\n');
  process.stderr.write('  npx tsx scripts/delete-similar-posts.ts --from-report similar-posts-report.json\n');
  process.stderr.write('\nAdd --confirm to execute (default is dry-run).\n');
  process.exit(1);
}

// ── Build slug list from report ───────────────────────────────────────────────

if (fromReport) {
  interface Pair {
    slugA: string;
    slugB: string;
    pubDateA: string;
    pubDateB: string;
  }
  let pairs: Pair[];
  try {
    pairs = JSON.parse(readFileSync(fromReport, 'utf8')) as Pair[];
  } catch {
    process.stderr.write(`Error: Could not read report file: ${fromReport}\n`);
    process.exit(1);
  }

  for (const p of pairs) {
    // Delete the older post (earlier pubDate); if equal, delete slugA
    const dateA = p.pubDateA ? new Date(p.pubDateA).getTime() : 0;
    const dateB = p.pubDateB ? new Date(p.pubDateB).getTime() : 0;
    slugsList.push(dateA <= dateB ? p.slugA : p.slugB);
  }
  slugsList = [...new Set(slugsList)];
}

// ── D1 helpers ────────────────────────────────────────────────────────────────

const d1Flag = env === 'production' ? '--remote' : '--local';

function sq(s: string): string {
  return s.replace(/'/g, "''");
}

function d1Query<T>(sql: string): T[] {
  try {
    const out = execSync(
      `npx wrangler d1 execute BLOG_DB ${d1Flag} --command "${sql.replace(/"/g, '\\"')}" --json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(out) as { results?: T[] }[];
    return parsed?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

function d1Execute(sql: string): void {
  const tmpFile = path.join(tmpdir(), `del-posts-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  try {
    writeFileSync(tmpFile, sql, 'utf8');
    execSync(`npx wrangler d1 execute BLOG_DB ${d1Flag} --file="${tmpFile}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const blogDir = path.resolve('src/content/blog');
let filesDeleted = 0;
let d1RecordsCleaned = 0;
let warnings = 0;

if (!confirm) {
  process.stdout.write('[DRY RUN] The following would be deleted (pass --confirm to execute):\n\n');
  for (const slug of slugsList) {
    process.stdout.write(`[DRY RUN] Would delete: ${slug}\n`);
  }
  process.stdout.write(`\nRe-run with --confirm to execute deletions.\n`);
  process.exit(0);
}

process.stdout.write(`Deleting ${slugsList.length} post(s) [env: ${env}]...\n\n`);

for (const slug of slugsList) {
  process.stdout.write(`Processing: ${slug}\n`);

  // ── Filesystem deletion ───────────────────────────────────────────────────
  const mdPath = path.join(blogDir, `${slug}.md`);
  const mdxPath = path.join(blogDir, `${slug}.mdx`);
  const filePath = existsSync(mdPath) ? mdPath : existsSync(mdxPath) ? mdxPath : null;

  if (filePath) {
    try {
      unlinkSync(filePath);
      filesDeleted++;
      process.stdout.write(`  ✓ Deleted: ${path.relative(process.cwd(), filePath)}\n`);
    } catch (e) {
      process.stderr.write(`  ✗ Failed to delete file: ${(e as Error).message}\n`);
      warnings++;
    }
  } else {
    process.stderr.write(`  ⚠ File not found in src/content/blog/ for slug: ${slug}\n`);
    warnings++;
  }

  // ── D1 deletion ───────────────────────────────────────────────────────────
  const rows = d1Query<{ id: string }>(`SELECT id FROM posts WHERE slug = '${sq(slug)}'`);
  const postId = rows[0]?.id ?? null;

  if (postId) {
    const sql = [
      `DELETE FROM generation_jobs WHERE post_id = '${sq(postId)}';`,
      `DELETE FROM drafts WHERE slug = '${sq(slug)}';`,
      `DELETE FROM posts WHERE slug = '${sq(slug)}';`,
    ].join('\n');

    try {
      d1Execute(sql);
      d1RecordsCleaned++;
      process.stdout.write(`  ✓ D1 records deleted (generation_jobs, drafts, posts)\n`);
    } catch (e) {
      process.stderr.write(`  ✗ D1 deletion failed: ${(e as Error).message}\n`);
      warnings++;
    }
  } else {
    process.stderr.write(`  ⚠ No posts row found in D1 for slug: ${slug}\n`);
    warnings++;
  }
}

process.stdout.write(
  `\nDeleted ${filesDeleted} file(s), cleaned ${d1RecordsCleaned} D1 record(s), ${warnings} warning(s)\n`,
);
