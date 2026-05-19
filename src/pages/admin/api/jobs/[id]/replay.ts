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
    return new Response(JSON.stringify({ error: 'Missing job id' }), {
      status: 400,
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

  const job = await db
    .prepare('SELECT id, stage, stage_payload, status FROM generation_jobs WHERE id = ?')
    .bind(id)
    .first<{ id: string; stage: string; stage_payload: string | null; status: string }>();

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  if (job.status !== 'failed') {
    return new Response(JSON.stringify({ error: 'Only failed jobs can be replayed' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', ...ADMIN_SECURITY_HEADERS },
    });
  }

  await db
    .prepare(`UPDATE generation_jobs SET status = 'pending', error = NULL, updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  if (queue && job.stage_payload) {
    try {
      const payload = JSON.parse(job.stage_payload) as object;
      await queue.send(payload);
    } catch {
      await queue.send({ stage: job.stage, replay_job_id: job.id });
    }
  }

  return Response.redirect('/admin/jobs', 303);
};
