#!/usr/bin/env tsx
/**
 * Accountic Blog Automation — One-time Cloudflare Resource Provisioner
 *
 * Run this once per environment to create the required Cloudflare resources.
 * Do NOT run in CI — this is an operator script.
 *
 * Usage:
 *   npx tsx scripts/provision.ts
 *
 * After running, copy the printed IDs into wrangler.jsonc to replace
 * each placeholder value.
 *
 * Prerequisites:
 *   - wrangler installed (npx wrangler or global)
 *   - Authenticated: run `wrangler login` first
 *   - Your Cloudflare account ID is set in wrangler.jsonc or CLOUDFLARE_ACCOUNT_ID env var
 */

import { execSync } from 'node:child_process';

const SEPARATOR = '─'.repeat(60);

function run(cmd: string): string {
	try {
		return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string };
		const detail = error.stderr ?? error.message ?? String(err);
		throw new Error(`Command failed: ${cmd}\n${detail}`);
	}
}

function section(title: string) {
	console.log(`\n${SEPARATOR}`);
	console.log(`  ${title}`);
	console.log(SEPARATOR);
}

console.log('\n🚀 Accountic Blog Automation — Cloudflare Provisioner');
console.log('Run this once per environment. Do not run in CI.\n');

// ── D1 Database ───────────────────────────────────────────────────────────────
section('1/4  Creating D1 Database: blog-db');
try {
	const d1Output = run('npx wrangler d1 create blog-db');
	console.log(d1Output);
	// wrangler 4 prints the ID in JSON format: "database_id": "uuid"
	const match = d1Output.match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/i);
	if (match) {
		console.log(`\n✓ D1 database_id: ${match[1]}`);
		console.log(`  → Update wrangler.jsonc  d1_databases[0].database_id = "${match[1]}"`);
	} else {
		console.log('  ⚠ Could not parse database_id from output above. Copy it manually.');
	}
} catch (e) {
	console.error(`  ✗ ${(e as Error).message}`);
	console.log('  (If the database already exists, run: npx wrangler d1 list)');
}

// ── KV Namespace ──────────────────────────────────────────────────────────────
section('2/4  Creating KV Namespace: BLOG_KV');
try {
	// wrangler 4 uses `kv namespace` (no colon); wrangler 3 used `kv:namespace`
	const kvOutput = run('npx wrangler kv namespace create BLOG_KV');
	console.log(kvOutput);
	// wrangler 4 prints the ID in JSON format: "id": "hex32"
	const match = kvOutput.match(/"id"\s*:\s*"([0-9a-f]{32})"/i);
	if (match) {
		console.log(`\n✓ KV namespace id: ${match[1]}`);
		console.log(`  → Update wrangler.jsonc  kv_namespaces[0].id = "${match[1]}"`);
	} else {
		console.log('  ⚠ Could not parse namespace id from output above. Copy it manually.');
	}
} catch (e) {
	console.error(`  ✗ ${(e as Error).message}`);
	console.log('  (If the namespace already exists, run: npx wrangler kv namespace list)');
}

// ── R2 Bucket ─────────────────────────────────────────────────────────────────
section('3/4  Creating R2 Bucket: accountic-blog-assets');
try {
	const r2Output = run('npx wrangler r2 bucket create accountic-blog-assets');
	console.log(r2Output);
	console.log('\n✓ R2 bucket created: accountic-blog-assets');
	console.log('  → wrangler.jsonc already references bucket_name = "accountic-blog-assets"');
	console.log('  → No change needed unless you renamed the bucket.');
} catch (e) {
	console.error(`  ✗ ${(e as Error).message}`);
	console.log('  (If the bucket already exists, it can be reused.)');
}

// ── Queues ────────────────────────────────────────────────────────────────────
section('4/4  Creating Queues');
for (const queueName of ['blog-pipeline', 'blog-publish']) {
	try {
		const qOutput = run(`npx wrangler queues create ${queueName}`);
		console.log(qOutput.trim());
		console.log(`  ✓ Queue created: ${queueName}`);
	} catch (e) {
		console.error(`  ✗ ${queueName}: ${(e as Error).message}`);
		console.log('  (If the queue already exists, it can be reused.)');
	}
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${SEPARATOR}`);
console.log('  Next Steps');
console.log(SEPARATOR);
console.log(`
1. Copy the database_id, kv namespace id printed above into wrangler.jsonc
   (replace the 00000000-... and 00000000... placeholder values)

2. Apply the D1 schema migration:
   npm run db:migrate

3. Add CLOUDFLARE_API_TOKEN to your GitHub repository secrets:
   https://github.com/<org>/<repo>/settings/secrets/actions

4. Push to main — the GitHub Actions workflow will deploy automatically.
`);
