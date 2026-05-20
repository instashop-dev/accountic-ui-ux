#!/usr/bin/env tsx
/**
 * Sends a topic-discovery message to the blog-pipeline queue.
 * Uses the wrangler OAuth session — no API token env var required.
 *
 * Usage:
 *   npm run blog:generate
 *   npm run blog:generate -- --count 5
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT_ID = 'abae0a994f0f50196e9f8cfecc2df6f3';
const QUEUE_ID = '1e8d77ab12064f8597361803663f47dc'; // blog-pipeline

function getWranglerOAuthToken(): string {
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let count = 3;
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = parseInt(args[countIdx + 1], 10);
    if (isNaN(count) || count < 1) {
      console.error('--count must be a positive integer');
      process.exit(1);
    }
  }

  console.log(`Sending topic-discovery message (count=${count}) to blog-pipeline...`);
  await sendQueueMessage({ stage: 'topic-discovery', count });
  console.log('Done. Pipeline started.');
}

main().catch((e) => {
  console.error('Error:', (e as Error).message);
  process.exit(1);
});
