#!/usr/bin/env tsx
/**
 * Manually triggers humanization for specific draft IDs.
 * Usage: npx tsx scripts/trigger-humanize.ts <draft_id> [<draft_id> ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT_ID = 'abae0a994f0f50196e9f8cfecc2df6f3';
const HUMANIZE_QUEUE_ID = '26c74332b02c4347ba65c10a0bb7c420';

function getWranglerOAuthToken(): string {
  const configPath = join(
    process.env.APPDATA ?? `${process.env.HOME}/.config`,
    'xdg.config/.wrangler/config/default.toml',
  );
  const toml = readFileSync(configPath, 'utf8');
  const match = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) throw new Error('No OAuth token found. Run: wrangler login');
  return match[1];
}

async function sendToHumanize(draftId: string): Promise<void> {
  const token = getWranglerOAuthToken();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/queues/${HUMANIZE_QUEUE_ID}/messages/batch`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ body: { draft_id: draftId }, content_type: 'json' }] }),
    },
  );
  const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message ?? `HTTP ${res.status}`);
  }
  console.log(`Queued for humanization: ${draftId}`);
}

async function main(): Promise<void> {
  const draftIds = process.argv.slice(2);
  if (draftIds.length === 0) {
    console.error('Usage: npx tsx scripts/trigger-humanize.ts <draft_id> [<draft_id> ...]');
    process.exit(1);
  }
  for (const id of draftIds) {
    await sendToHumanize(id);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error('Error:', (e as Error).message);
  process.exit(1);
});
