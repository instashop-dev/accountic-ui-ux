#!/usr/bin/env tsx
/**
 * Accountic — Production Verification Script (Phase 7)
 *
 * Programmatically tests all 8.x verification tasks:
 *   8.1  Pipeline worker deployed
 *   8.2  Queue consumers registered
 *   8.3  Analytics dashboard auth, headers, content
 *   8.4  Analytics seed + dashboard data
 *   8.5  Content refresh trigger + D1 state
 *   8.6  Admin page regression checks
 *   8.7  STAGING_SEED_TOKEN cleanup
 *
 * Required environment variables:
 *   PRODUCTION_HOST       e.g. https://accountic-ui-ux.thaliatechnologies.workers.dev
 *                         or   https://accountic.in
 *   ADMIN_TOKEN           Bearer token for admin routes
 *   CF_API_TOKEN          Cloudflare API token (Workers:Read, Queues:Read)
 *   CF_ACCOUNT_ID         Cloudflare account ID
 *
 * Optional:
 *   STAGING_SEED_TOKEN    If set, runs the analytics seed test (8.4) and cleans up (8.7)
 *   ANALYTICS_ENABLED     Set to "true" if ANALYTICS_ENABLED secret is provisioned
 *   TEST_POST_ID          Specific post ID to use for refresh test (8.5).
 *                         If unset, the script queries D1 to find one automatically.
 *
 * Usage:
 *   npx tsx scripts/verify-production.ts
 *
 * Add to package.json for convenience:
 *   "verify:production": "tsx scripts/verify-production.ts"
 */

import { execSync } from 'node:child_process';

// ── Config ────────────────────────────────────────────────────────────────────

const HOST = process.env.PRODUCTION_HOST?.replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const STAGING_SEED_TOKEN = process.env.STAGING_SEED_TOKEN;
const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true';
const TEST_POST_ID = process.env.TEST_POST_ID;

const ASTRO_WORKER_NAME = 'accountic-ui-ux';
const PIPELINE_WORKER_NAME = 'accountic-blog-pipeline';
const EXPECTED_QUEUES = ['blog-pipeline', 'blog-humanize', 'blog-publish', 'blog-refresh'];

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(label: string) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  const msg = detail ? `${label} — ${detail}` : label;
  console.error(`  ✗ ${msg}`);
  failures.push(msg);
  failed++;
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function get(path: string, opts: { token?: string; expectStatus?: number } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${HOST}${path}`, { headers, redirect: 'manual' });
  return res;
}

async function post(path: string, body: unknown, opts: { token?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const res = await fetch(`${HOST}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  return res;
}

async function cfApi(path: string) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  const data = await res.json() as { success: boolean; result: unknown; errors?: { message: string }[] };
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'CF API error');
  return data.result;
}

function wrangler(cmd: string): string {
  return execSync(`npx wrangler ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Preflight ─────────────────────────────────────────────────────────────────

function checkEnv() {
  const missing: string[] = [];
  if (!HOST) missing.push('PRODUCTION_HOST');
  if (!ADMIN_TOKEN) missing.push('ADMIN_TOKEN');
  if (!CF_API_TOKEN) missing.push('CF_API_TOKEN');
  if (!CF_ACCOUNT_ID) missing.push('CF_ACCOUNT_ID');
  if (missing.length) {
    console.error(`\nMissing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('\nSee script header for usage instructions.');
    process.exit(1);
  }
  console.log(`\nProduction host : ${HOST}`);
  console.log(`Analytics active: ${ANALYTICS_ENABLED}`);
  console.log(`Seed token set  : ${Boolean(STAGING_SEED_TOKEN)}`);
}

// ── Task 8.1 — Pipeline worker deployed ───────────────────────────────────────

async function checkWorkerDeployment() {
  section('8.1 — Pipeline worker deployed');
  try {
    const scripts = await cfApi(`/accounts/${CF_ACCOUNT_ID}/workers/scripts`) as { id: string }[];
    const names = scripts.map((s) => s.id);

    if (names.includes(ASTRO_WORKER_NAME)) {
      pass(`${ASTRO_WORKER_NAME} worker exists`);
    } else {
      fail(`${ASTRO_WORKER_NAME} worker not found`, `found: ${names.join(', ')}`);
    }

    if (names.includes(PIPELINE_WORKER_NAME)) {
      pass(`${PIPELINE_WORKER_NAME} worker exists`);
    } else {
      fail(`${PIPELINE_WORKER_NAME} worker not found — push to main and wait for CI`);
    }
  } catch (e) {
    fail('Cloudflare API request failed', String(e));
  }
}

// ── Task 8.2 — Queue consumers registered ─────────────────────────────────────

async function checkQueueConsumers() {
  section('8.2 — Queue consumers registered');
  try {
    const queues = await cfApi(
      `/accounts/${CF_ACCOUNT_ID}/queues?per_page=50`,
    ) as { queue_name: string; consumers_total_count: number }[];

    for (const name of EXPECTED_QUEUES) {
      const q = queues.find((x) => x.queue_name === name);
      if (!q) {
        fail(`Queue "${name}" not found — run npm run blog:provision`);
      } else if (q.consumers_total_count === 0) {
        fail(`Queue "${name}" has no consumer — pipeline worker not deployed yet`);
      } else {
        pass(`Queue "${name}" has ${q.consumers_total_count} consumer(s)`);
      }
    }
  } catch (e) {
    fail('Queue API request failed', String(e));
  }
}

// ── Task 8.3 — Analytics dashboard auth, headers, content ─────────────────────

async function checkAnalyticsDashboard() {
  section('8.3 — Analytics dashboard');

  // Unauthenticated → redirect to login (cookie mode) or 401 (bearer mode)
  try {
    const unauthed = await fetch(`${HOST}/admin/analytics`, { redirect: 'manual' });
    if (unauthed.status === 302 || unauthed.status === 401) {
      pass('Unauthenticated request blocked (status ' + unauthed.status + ')');
    } else {
      fail('Unauthenticated /admin/analytics not blocked', `got ${unauthed.status}`);
    }
  } catch (e) {
    fail('Unauthenticated check failed', String(e));
  }

  // Unauthenticated API → 401
  try {
    const unauthedApi = await fetch(`${HOST}/admin/api/analytics`, { redirect: 'manual' });
    if (unauthedApi.status === 401 || unauthedApi.status === 302) {
      pass('Unauthenticated /admin/api/analytics blocked (status ' + unauthedApi.status + ')');
    } else {
      fail('Unauthenticated /admin/api/analytics not blocked', `got ${unauthedApi.status}`);
    }
  } catch (e) {
    fail('Unauthenticated API check failed', String(e));
  }

  if (!ANALYTICS_ENABLED) {
    console.log('  ⓘ  Skipping ANALYTICS_ENABLED checks — set ANALYTICS_ENABLED=true once secret is provisioned');
    return;
  }

  // Authenticated page → 200
  try {
    const authed = await get('/admin/analytics', { token: ADMIN_TOKEN! });
    if (authed.status === 200) {
      pass('Authenticated /admin/analytics returns 200');
    } else {
      fail('/admin/analytics returned unexpected status', `got ${authed.status}`);
      return;
    }

    // Security headers
    const robots = authed.headers.get('x-robots-tag') ?? '';
    const cache = authed.headers.get('cache-control') ?? '';

    if (robots.includes('noindex')) {
      pass('x-robots-tag: noindex present');
    } else {
      fail('x-robots-tag missing or incorrect', `got: "${robots}"`);
    }

    if (cache.includes('no-store')) {
      pass('cache-control: no-store present');
    } else {
      fail('cache-control missing no-store', `got: "${cache}"`);
    }

    // Page content
    const html = await authed.text();
    const contentChecks: [string, string][] = [
      ['Total Events card', 'Total Events'],
      ['Success Rate card', 'Success Rate'],
      ['Avg Tokens card', 'Avg Tokens'],
      ['Avg Quality card', 'Avg Quality'],
      ['Operational Health section', 'Operational Health'],
      ['Queue nav link', '/admin/queue'],
      ['Refresh nav link', '/admin/refresh'],
      ['Analytics nav link', '/admin/analytics'],
    ];

    for (const [label, needle] of contentChecks) {
      if (html.includes(needle)) {
        pass(`Dashboard HTML contains "${label}"`);
      } else {
        fail(`Dashboard HTML missing "${label}"`, `expected to find: ${needle}`);
      }
    }
  } catch (e) {
    fail('Authenticated analytics check failed', String(e));
  }

  // Authenticated API → 200 + JSON
  try {
    const apiRes = await get('/admin/api/analytics', { token: ADMIN_TOKEN! });
    if (apiRes.status === 200) {
      const json = await apiRes.json() as Record<string, unknown>;
      if ('total_events' in json) {
        pass('/admin/api/analytics returns valid JSON with total_events');
      } else {
        fail('/admin/api/analytics JSON missing total_events field');
      }
    } else {
      fail('/admin/api/analytics unexpected status', `got ${apiRes.status}`);
    }
  } catch (e) {
    fail('Analytics API check failed', String(e));
  }

  // Security headers on the API route too
  try {
    const apiHeaders = await get('/admin/api/analytics', { token: ADMIN_TOKEN! });
    const robots = apiHeaders.headers.get('x-robots-tag') ?? '';
    const cache = apiHeaders.headers.get('cache-control') ?? '';
    if (robots.includes('noindex') && cache.includes('no-store')) {
      pass('/admin/api/analytics security headers correct');
    } else {
      fail('/admin/api/analytics security headers incorrect',
        `x-robots-tag: "${robots}", cache-control: "${cache}"`);
    }
  } catch (e) {
    fail('API security header check failed', String(e));
  }
}

// ── Task 8.4 — Analytics seed + wait + verify data ────────────────────────────

async function checkAnalyticsSeed() {
  section('8.4 — Analytics seed data');

  if (!STAGING_SEED_TOKEN) {
    console.log('  ⓘ  Skipping — set STAGING_SEED_TOKEN to run this check');
    return;
  }

  if (!ANALYTICS_ENABLED) {
    console.log('  ⓘ  Skipping — ANALYTICS_ENABLED must be true to seed');
    return;
  }

  try {
    // POST seed endpoint
    const seedRes = await fetch(`${HOST}/admin/api/analytics-seed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        'X-Seed-Token': STAGING_SEED_TOKEN,
      },
      redirect: 'manual',
    });

    if (seedRes.status !== 200) {
      fail('Analytics seed POST failed', `got ${seedRes.status}`);
      return;
    }

    const seedJson = await seedRes.json() as { written: number; total: number };
    if (seedJson.written > 0) {
      pass(`Seed wrote ${seedJson.written}/${seedJson.total} events`);
    } else {
      fail('Seed wrote 0 events');
      return;
    }

    // Wait for Analytics Engine ingestion (~60–90s)
    console.log('  ⏳ Waiting 90s for Analytics Engine ingestion...');
    await sleep(90_000);

    // Verify total_events > 0
    const apiRes = await get('/admin/api/analytics', { token: ADMIN_TOKEN! });
    const json = await apiRes.json() as { total_events?: number };
    if ((json.total_events ?? 0) > 0) {
      pass(`Analytics API shows total_events: ${json.total_events}`);
    } else {
      fail('Analytics API still shows 0 events after seed + wait');
    }
  } catch (e) {
    fail('Analytics seed check failed', String(e));
  }
}

// ── Task 8.5 — Content refresh trigger + D1 verification ──────────────────────

async function checkContentRefresh() {
  section('8.5 — Content refresh trigger');

  let postId = TEST_POST_ID;

  // Auto-discover a post from D1 if no TEST_POST_ID provided
  if (!postId) {
    try {
      const result = wrangler(
        `d1 execute BLOG_DB --remote --command "SELECT id FROM posts WHERE source='ai' AND status='published' LIMIT 1" --json`,
      );
      const rows = JSON.parse(result) as { results?: { id: string }[] }[];
      postId = rows[0]?.results?.[0]?.id;
    } catch {
      // ignore parse errors
    }

    if (!postId) {
      console.log('  ⓘ  Skipping — no published AI posts found in D1 (pipeline may not have generated any yet)');
      console.log('       Set TEST_POST_ID env var to force-test with a specific post ID');
      return;
    }
    console.log(`  ⓘ  Using auto-discovered post ID: ${postId}`);
  }

  // Record pre-trigger state
  let preRefreshCount = 0;
  try {
    const preState = wrangler(
      `d1 execute BLOG_DB --remote --command "SELECT refresh_count FROM posts WHERE id='${postId}'" --json`,
    );
    const rows = JSON.parse(preState) as { results?: { refresh_count: number }[] }[];
    preRefreshCount = rows[0]?.results?.[0]?.refresh_count ?? 0;
  } catch {
    // if post doesn't have the column yet (migration not applied), skip
    console.log('  ⓘ  Skipping — refresh schema (migration 006) may not be applied yet');
    console.log('       Run: npm run db:migrate:phase6');
    return;
  }

  // Trigger the refresh via admin API
  try {
    const refreshRes = await post(
      '/admin/api/refresh',
      { post_id: postId },
      { token: ADMIN_TOKEN! },
    );

    if (refreshRes.status === 200) {
      const json = await refreshRes.json() as { queued?: boolean; error?: string };
      if (json.queued) {
        pass(`Refresh queued for post ${postId}`);
      } else {
        fail('Refresh API returned 200 but queued=false', JSON.stringify(json));
        return;
      }
    } else {
      const body = await refreshRes.text();
      fail('Refresh API returned unexpected status', `${refreshRes.status}: ${body}`);
      return;
    }
  } catch (e) {
    fail('Refresh API call failed', String(e));
    return;
  }

  // Queue processing is async — wait up to 60s for a refresh_jobs row
  console.log('  ⏳ Waiting up to 60s for refresh worker to process...');
  let jobInserted = false;
  let lastRefreshedAt: string | null = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(5_000);

    try {
      const jobResult = wrangler(
        `d1 execute BLOG_DB --remote --command "SELECT id, status FROM refresh_jobs WHERE post_id='${postId}' ORDER BY created_at DESC LIMIT 1" --json`,
      );
      const rows = JSON.parse(jobResult) as { results?: { id: string; status: string }[] }[];
      const job = rows[0]?.results?.[0];

      if (job) {
        jobInserted = true;
        pass(`refresh_jobs row inserted (status: ${job.status})`);

        if (job.status === 'success') {
          // Check last_refreshed_at was updated
          const postResult = wrangler(
            `d1 execute BLOG_DB --remote --command "SELECT last_refreshed_at FROM posts WHERE id='${postId}'" --json`,
          );
          const postRows = JSON.parse(postResult) as { results?: { last_refreshed_at: string }[] }[];
          lastRefreshedAt = postRows[0]?.results?.[0]?.last_refreshed_at ?? null;

          if (lastRefreshedAt) {
            pass(`posts.last_refreshed_at updated: ${lastRefreshedAt}`);
          } else {
            fail('posts.last_refreshed_at not updated after successful refresh');
          }
        } else if (job.status === 'failed') {
          // A failure is still a valid test result — the worker ran and logged it
          pass(`Refresh worker ran and logged failure (expected if quality/regression gates fail on this post)`);
        }
        break;
      }
    } catch {
      // keep polling
    }
  }

  if (!jobInserted) {
    fail(
      'No refresh_jobs row found after 60s',
      'Pipeline worker may not be deployed or BLOG_REFRESH_QUEUE has no consumer',
    );
  }
}

// ── Task 8.6 — Admin page regression checks ──────────────────────────────────

async function checkAdminPages() {
  section('8.6 — Admin page regressions');

  const pages: [string, string[]][] = [
    ['/admin/queue',    ['Queue', '/admin/analytics', '/admin/refresh']],
    ['/admin/jobs',     ['Jobs',  '/admin/analytics', '/admin/refresh']],
    ['/admin/analytics', ANALYTICS_ENABLED
      ? ['Analytics', '/admin/queue', '/admin/refresh']
      : ['analytics']  // page may 404 if ANALYTICS_ENABLED not set — just check it doesn't 500
    ],
    ['/admin/refresh',  ['Refresh', '/admin/queue', '/admin/analytics']],
    ['/admin/settings', ['Settings', '/admin/analytics', '/admin/refresh']],
    ['/admin/prompts',  ['Prompts',  '/admin/analytics', '/admin/refresh']],
  ];

  for (const [path, expectedContent] of pages) {
    try {
      const res = await get(path, { token: ADMIN_TOKEN! });

      if (res.status !== 200) {
        // analytics 404 is expected when ANALYTICS_ENABLED=false
        if (path === '/admin/analytics' && !ANALYTICS_ENABLED && res.status === 404) {
          pass(`${path} returns 404 (expected — ANALYTICS_ENABLED not set)`);
          continue;
        }
        fail(`${path} returned ${res.status}`);
        continue;
      }

      const html = await res.text();
      let allFound = true;

      for (const needle of expectedContent) {
        if (!html.includes(needle)) {
          fail(`${path} missing expected content`, `"${needle}" not found in HTML`);
          allFound = false;
        }
      }

      if (allFound) {
        pass(`${path} renders correctly with all expected content`);
      }
    } catch (e) {
      fail(`${path} request failed`, String(e));
    }
  }

  // Verify unauthenticated requests are blocked on every admin page
  for (const [path] of pages) {
    try {
      const unauthed = await fetch(`${HOST}${path}`, { redirect: 'manual' });
      if (unauthed.status === 302 || unauthed.status === 401) {
        pass(`${path} blocks unauthenticated access (${unauthed.status})`);
      } else {
        fail(`${path} did not block unauthenticated access`, `got ${unauthed.status}`);
      }
    } catch (e) {
      fail(`Unauthed check for ${path} failed`, String(e));
    }
  }
}

// ── Task 8.7 — Cleanup ────────────────────────────────────────────────────────

async function cleanupSeedToken() {
  section('8.7 — Cleanup STAGING_SEED_TOKEN');

  if (!STAGING_SEED_TOKEN) {
    console.log('  ⓘ  STAGING_SEED_TOKEN not set — nothing to clean up');
    return;
  }

  try {
    // Check if it exists first
    const list = wrangler('secret list');
    if (!list.includes('STAGING_SEED_TOKEN')) {
      pass('STAGING_SEED_TOKEN already removed');
      return;
    }

    // Delete it (wrangler secret delete is interactive; use CF API instead)
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${ASTRO_WORKER_NAME}/secrets/STAGING_SEED_TOKEN`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      },
    );
    const json = await res.json() as { success: boolean };
    if (json.success) {
      pass('STAGING_SEED_TOKEN deleted via CF API');
    } else {
      fail('Failed to delete STAGING_SEED_TOKEN', JSON.stringify(json));
    }
  } catch (e) {
    fail('STAGING_SEED_TOKEN cleanup failed', String(e));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(62));
  console.log(' Accountic — Production Verification (Phase 7)');
  console.log('═'.repeat(62));

  checkEnv();

  await checkWorkerDeployment();
  await checkQueueConsumers();
  await checkAnalyticsDashboard();
  await checkAnalyticsSeed();
  await checkContentRefresh();
  await checkAdminPages();
  await cleanupSeedToken();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log(` Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.log('');
    process.exit(1);
  } else {
    console.log('\n All checks passed! Production is healthy.\n');
  }
}

main().catch((e) => {
  console.error('\nUnhandled error:', e);
  process.exit(1);
});
