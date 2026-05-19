import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing draft id' }), { status: 400 });
  }

  const db = (env as unknown as { BLOG_DB?: D1Database }).BLOG_DB;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), { status: 503 });
  }

  await db
    .prepare(`UPDATE drafts SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  return Response.redirect('/admin/queue', 303);
};
