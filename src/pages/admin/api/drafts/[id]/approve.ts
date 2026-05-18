import type { APIRoute } from 'astro';
import { publishMessage } from '../../../../../lib/queue';

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing draft id' }), { status: 400 });
  }

  const runtime = (locals as { runtime?: { env?: { BLOG_DB?: D1Database; BLOG_PUBLISH_QUEUE?: Queue } } }).runtime;
  const db = runtime?.env?.BLOG_DB;
  const queue = runtime?.env?.BLOG_PUBLISH_QUEUE;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), { status: 503 });
  }

  const draft = await db
    .prepare('SELECT id, status FROM drafts WHERE id = ?')
    .bind(id)
    .first<{ id: string; status: string }>();

  if (!draft) {
    return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
  }
  if (draft.status !== 'ready') {
    return new Response(
      JSON.stringify({ error: `Draft status is '${draft.status}', not 'ready'` }),
      { status: 409 },
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
