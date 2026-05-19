import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const ALLOWED_KEYS = new Set([
  'generation_enabled',
  'auto_publish',
  'weekly_target',
  'quality_threshold',
  'daily_token_cap',
  'ai_model',
]);

export const POST: APIRoute = async ({ request }) => {
  const db = (env as unknown as { BLOG_DB?: D1Database }).BLOG_DB;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), { status: 503 });
  }

  const form = await request.formData();
  const updates: [string, string][] = [];

  for (const key of ALLOWED_KEYS) {
    const raw = form.get(key);
    // Checkboxes send their value only when checked; absence means false
    if (raw === null && (key === 'generation_enabled' || key === 'auto_publish')) {
      updates.push([key, 'false']);
    } else if (raw !== null) {
      updates.push([key, String(raw)]);
    }
  }

  const stmts = updates.map(([k, v]) =>
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(k, v),
  );

  await db.batch(stmts);

  return Response.redirect('/admin/settings', 303);
};
