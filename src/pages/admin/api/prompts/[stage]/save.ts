import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { generateId } from '../../../../../lib/queue';

export const prerender = false;

const VALID_STAGES = new Set([
  'topic-discovery',
  'outline-generation',
  'article-generation',
  'humanizer',
  'publisher',
]);

export const POST: APIRoute = async ({ params, request }) => {
  const { stage } = params;
  if (!stage || !VALID_STAGES.has(stage)) {
    return new Response(JSON.stringify({ error: 'Invalid stage' }), { status: 400 });
  }

  const db = (env as unknown as { BLOG_DB?: D1Database }).BLOG_DB;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), { status: 503 });
  }

  const form = await request.formData();
  const systemPrompt = String(form.get('system_prompt') ?? '').trim();
  const userPromptTemplate = String(form.get('user_prompt_template') ?? '').trim();

  if (!systemPrompt || !userPromptTemplate) {
    return new Response(JSON.stringify({ error: 'Both prompt fields are required' }), { status: 400 });
  }

  const maxRow = await db
    .prepare('SELECT MAX(version) as max_v FROM prompts WHERE stage = ?')
    .bind(stage)
    .first<{ max_v: number | null }>();
  const nextVersion = (maxRow?.max_v ?? 0) + 1;

  await db.batch([
    db.prepare(`UPDATE prompts SET is_active = 0 WHERE stage = ?`).bind(stage),
    db.prepare(
      `INSERT INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
    ).bind(generateId(), stage, nextVersion, systemPrompt, userPromptTemplate),
  ]);

  return Response.redirect('/admin/prompts', 303);
};
