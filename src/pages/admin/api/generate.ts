import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { topicDiscoveryMessage } from '../../../lib/queue';
import { ADMIN_SECURITY_HEADERS, validateCsrf } from '../../../lib/admin-security';

export const prerender = false;

const FORBIDDEN = JSON.stringify({ error: 'Forbidden' });

export const POST: APIRoute = async ({ request }) => {
  const expectedOrigin = new URL(request.url).origin;
  if (!validateCsrf(request, expectedOrigin)) {
    return new Response(FORBIDDEN, {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  const db = (env as unknown as { BLOG_DB?: D1Database; BLOG_PIPELINE_QUEUE?: Queue }).BLOG_DB;
  const queue = (env as unknown as { BLOG_DB?: D1Database; BLOG_PIPELINE_QUEUE?: Queue }).BLOG_PIPELINE_QUEUE;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  if (!queue) {
    return new Response(JSON.stringify({ error: 'Pipeline queue not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  const setting = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind('generation_enabled')
    .first<{ value: string }>();

  if (setting?.value !== 'true') {
    return new Response(
      JSON.stringify({ error: 'Generation is disabled. Enable it in Settings first.' }),
      { status: 409, headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS } },
    );
  }

  await queue.send(topicDiscoveryMessage(1));

  return Response.redirect(new URL('/admin/jobs', request.url).href, 303);
};
