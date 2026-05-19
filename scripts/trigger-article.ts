#!/usr/bin/env tsx
/**
 * Accountic Blog Automation — Manual Article Trigger
 *
 * Inserts a pre-researched topic into D1 and enqueues one outline-generation
 * message to start the pipeline. Bypasses topic-discovery for a controlled
 * first run with a known high-value topic.
 *
 * Usage:
 *   npm run blog:trigger-article -- --title "..." --pillar "..."
 *
 * Example:
 *   npm run blog:trigger-article -- \
 *     --title "Section 148 Notice Reply: Step-by-Step Guide for Assessees" \
 *     --pillar "Income Tax Notices"
 *
 * Prerequisites:
 *   - CF_API_TOKEN   — Cloudflare API token with D1:Edit and Queues:Write
 *   - CF_ACCOUNT_ID  — Cloudflare account ID
 *   - D1_DATABASE_ID — D1 database ID (defaults to value from wrangler.pipeline.jsonc)
 *
 * Valid pillars:
 *   Income Tax Notices | Faceless Assessment | DPDP Compliance |
 *   ICAI Ethics | Case Law Notes | Firm Operations
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Config ────────────────────────────────────────────────────────────────────
// Uses wrangler OAuth session — no CF_API_TOKEN required.

const VALID_PILLARS = [
  'Income Tax Notices',
  'Faceless Assessment',
  'DPDP Compliance',
  'ICAI Ethics',
  'Case Law Notes',
  'Firm Operations',
] as const;

const USAGE = `
Usage: npm run blog:trigger-article -- --title "..." --pillar "..."

Required arguments:
  --title   Article title (quoted string)
  --pillar  Content pillar (one of the following):
            "Income Tax Notices"
            "Faceless Assessment"
            "DPDP Compliance"
            "ICAI Ethics"
            "Case Law Notes"
            "Firm Operations"

Required environment variables:
  CF_API_TOKEN   — Cloudflare API token with D1:Edit and Queues:Write
  CF_ACCOUNT_ID  — Cloudflare account ID

Optional:
  D1_DATABASE_ID — Override D1 database ID (default: from wrangler.pipeline.jsonc)

Example:
  CF_API_TOKEN=... CF_ACCOUNT_ID=... npm run blog:trigger-article -- \\
    --title "Section 148 Notice Reply: Step-by-Step Guide for Assessees" \\
    --pillar "Income Tax Notices"
`.trim();

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(): { title: string; pillar: string } {
  const args = process.argv.slice(2);
  let title = '';
  let pillar = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[++i];
    } else if (args[i] === '--pillar' && args[i + 1]) {
      pillar = args[++i];
    }
  }

  const errors: string[] = [];
  if (!title) errors.push('--title is required');
  if (!pillar) errors.push('--pillar is required');
  else if (!VALID_PILLARS.includes(pillar as (typeof VALID_PILLARS)[number])) {
    errors.push(`--pillar "${pillar}" is not valid. Must be one of:\n  ${VALID_PILLARS.join('\n  ')}`);
  }

  if (errors.length) {
    console.error('\nErrors:');
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    console.error(`\n${USAGE}`);
    process.exit(1);
  }

  return { title, pillar };
}

// ── SQL escape helper ─────────────────────────────────────────────────────────

function sq(s: string): string {
  return s.replace(/'/g, "''");
}

// ── Wrangler D1 helpers (uses OAuth session) ──────────────────────────────────

function wranglerD1Command(sql: string): string {
  return execSync(`npx wrangler d1 execute BLOG_DB --remote --command "${sql.replace(/"/g, '\\"')}" --json`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function wranglerD1File(sqlPath: string): string {
  return execSync(`npx wrangler d1 execute BLOG_DB --remote --file="${sqlPath}" --json`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function d1QueryJson<T>(output: string): T[] {
  const parsed = JSON.parse(output) as { results?: T[] }[];
  return parsed?.[0]?.results ?? [];
}

// ── ID generator (matches src/lib/queue.ts generateId()) ─────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ── Queue helper (CF REST API via wrangler OAuth token) ───────────────────────

const ACCOUNT_ID = 'abae0a994f0f50196e9f8cfecc2df6f3';
const QUEUE_ID = '1e8d77ab12064f8597361803663f47dc'; // blog-pipeline

function getWranglerOAuthToken(): string {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const configPath = join(
    process.env.APPDATA ?? `${process.env.HOME}/.config`,
    'xdg.config/.wrangler/config/default.toml',
  );
  const toml = readFileSync(configPath, 'utf8');
  const match = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) throw new Error('No OAuth token found in wrangler config. Run: wrangler login');
  return match[1];
}

async function sendQueueMessage(messageBody: Record<string, unknown>): Promise<void> {
  const token = getWranglerOAuthToken();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/queues/${QUEUE_ID}/messages/batch`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ body: messageBody, content_type: 'json' }] }),
    },
  );
  const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message ?? `HTTP ${res.status}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function triggerArticle(): Promise<void> {
  const { title, pillar } = parseArgs();

  const SEPARATOR = '─'.repeat(60);
  console.log('\n🚀 Accountic — Manual Article Trigger');
  console.log('Using wrangler OAuth session\n');
  console.log(SEPARATOR);
  console.log(`Title  : ${title}`);
  console.log(`Pillar : ${pillar}\n`);

  // ── Step 1: Insert topic into D1 ───────────────────────────────────────────
  const topicId = generateId();
  console.log('Step 1/2 — Inserting topic into D1...');

  const insertSql = `INSERT OR IGNORE INTO topics (id, title, pillar, rationale, status, created_at, updated_at) VALUES ('${sq(topicId)}', '${sq(title)}', '${sq(pillar)}', 'Manual first-run trigger', 'queued', datetime('now'), datetime('now'));`;
  const tmpFile = join(tmpdir(), `trigger-topic-${Date.now()}.sql`);
  try {
    writeFileSync(tmpFile, insertSql, 'utf8');
    wranglerD1File(tmpFile);
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  // Verify the row (INSERT OR IGNORE silently skips on title conflict)
  const selectOut = wranglerD1Command(`SELECT id FROM topics WHERE title = '${sq(title)}' LIMIT 1`);
  const rows = d1QueryJson<{ id: string }>(selectOut);

  if (rows.length === 0) {
    throw new Error('Topic insert succeeded but row not found in D1. Check migrations.');
  }

  const resolvedTopicId = rows[0].id;
  console.log(`  ✓ Topic in D1: ${resolvedTopicId}`);
  if (resolvedTopicId !== topicId) {
    console.log(`  ⓘ  Title already existed — reusing existing topic ID`);
  }

  // ── Step 2: Enqueue outline-generation message ──────────────────────────────
  console.log('\nStep 2/2 — Enqueuing outline-generation message...');

  try {
    await sendQueueMessage({ stage: 'outline-generation', topic_id: resolvedTopicId });
    console.log('  ✓ Message sent to blog-pipeline queue');
  } catch (e) {
    const errMsg = (e as Error).message;
    console.error(`  ✗ Queue send failed: ${errMsg}`);
    console.error('\n  Fallback: send the message manually with:');
    console.error(
      `  npx wrangler queues send blog-pipeline --message-body '{"stage":"outline-generation","topic_id":"${resolvedTopicId}"}'`,
    );
    process.exit(1);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + SEPARATOR);
  console.log('✓ Article trigger complete\n');
  console.log(`  topic_id : ${resolvedTopicId}`);
  console.log(`  title    : ${title}`);
  console.log(`  pillar   : ${pillar}`);
  console.log('\nNext steps:');
  console.log('  1. Monitor pipeline at /admin/jobs (outline → article → humanizer)');
  console.log('  2. Review draft at /admin/queue once status reaches "humanized"');
  console.log('  3. Approve to publish via the publisher worker');
}

triggerArticle().catch((e) => {
  console.error('\nUnexpected error:', (e as Error).message);
  process.exit(1);
});
