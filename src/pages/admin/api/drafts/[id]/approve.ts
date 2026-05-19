import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { publishMessage } from '../../../../../lib/queue';
import { ADMIN_SECURITY_HEADERS, validateCsrf } from '../../../../../lib/admin-security';

export const prerender = false;

const FORBIDDEN = JSON.stringify({ error: 'Forbidden' });

export const POST: APIRoute = async ({ params, request }) => {
  const expectedOrigin = new URL(request.url).origin;
  if (!validateCsrf(request, expectedOrigin)) {
    return new Response(FORBIDDEN, {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing draft id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  const db = (env as unknown as { BLOG_DB?: D1Database; BLOG_PUBLISH_QUEUE?: Queue }).BLOG_DB;
  const queue = (env as unknown as { BLOG_DB?: D1Database; BLOG_PUBLISH_QUEUE?: Queue }).BLOG_PUBLISH_QUEUE;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  const draft = await db
    .prepare('SELECT id, status FROM drafts WHERE id = ?')
    .bind(id)
    .first<{ id: string; status: string }>();

  if (!draft) {
    return new Response(JSON.stringify({ error: 'Draft not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }
  if (draft.status !== 'ready' && draft.status !== 'humanized') {
    return new Response(
      JSON.stringify({ error: `Draft status is '${draft.status}', expected 'ready' or 'humanized'` }),
      { status: 409, headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS } },
    );
  }

  await db
    .prepare(`UPDATE drafts SET status = 'approved', updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  if (queue) {
    await queue.send(publishMessage(id));
  }

  return Response.redirect('/admin/queue', 303);
};
