import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing job id' }), { status: 400 });
  }

  const runtime = (locals as {
    runtime?: { env?: { BLOG_DB?: D1Database; BLOG_PIPELINE_QUEUE?: Queue } };
  }).runtime;
  const db = runtime?.env?.BLOG_DB;
  const queue = runtime?.env?.BLOG_PIPELINE_QUEUE;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), { status: 503 });
  }

  const job = await db
    .prepare('SELECT id, stage, stage_payload, status FROM generation_jobs WHERE id = ?')
    .bind(id)
    .first<{ id: string; stage: string; stage_payload: string | null; status: string }>();

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
  }

  // Reset the job status so the worker will re-process it
  await db
    .prepare(`UPDATE generation_jobs SET status = 'pending', error = NULL, updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  if (queue && job.stage_payload) {
    try {
      const payload = JSON.parse(job.stage_payload) as object;
      await queue.send(payload);
    } catch {
      // Fallback: send minimal replay signal
      await queue.send({ stage: job.stage, replay_job_id: job.id });
    }
  }

  return Response.redirect('/admin/jobs', 303);
};
