import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
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

  const db = (env as unknown as { BLOG_DB?: D1Database }).BLOG_DB;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  await db
    .prepare(`UPDATE drafts SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  return Response.redirect('/admin/queue', 303);
};
