import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { refreshMessage } from '../../../lib/queue';
import { loadSnapshot } from '../../../lib/snapshot';

export const prerender = false;

const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Robots-Tag': 'noindex',
  'Cache-Control': 'private, no-store',
};

type CfEnv = {
  BLOG_DB?: D1Database;
  BLOG_REFRESH_QUEUE?: Queue;
  BLOG_ASSETS?: R2Bucket;
  GITHUB_TOKEN?: string;
};

interface PostRow {
  id: string;
  slug: string;
  title: string;
  source: string;
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: SECURITY_HEADERS });
}

function err(message: string): Response {
  return new Response(JSON.stringify({ error: message }), { status: 200, headers: SECURITY_HEADERS });
}

const GITHUB_OWNER = 'instashop-dev';
const GITHUB_REPO = 'accountic-ui-ux';
const GITHUB_BRANCH = 'main';

export const POST: APIRoute = async ({ request, url }) => {
  const cfEnv = env as unknown as CfEnv;
  const db = cfEnv.BLOG_DB;
  if (!db) return err('Database not available');

  const pathname = url.pathname;

  // ── Restore endpoint ────────────────────────────────────────────────────────
  if (pathname === '/admin/api/refresh/restore') {
    const body = await request.json().catch(() => null) as { post_id?: string; snapshot_key?: string } | null;
    const { post_id, snapshot_key } = body ?? {};

    if (!post_id || !snapshot_key) return err('post_id and snapshot_key are required');

    const r2 = cfEnv.BLOG_ASSETS;
    if (!r2) return err('R2 not available');

    const mdxContent = await loadSnapshot(r2, snapshot_key);
    if (!mdxContent) return err('Snapshot not found');

    const post = await db
      .prepare('SELECT id, slug, title FROM posts WHERE id = ?')
      .bind(post_id)
      .first<PostRow>();
    if (!post) return err('Post not found');

    const token = cfEnv.GITHUB_TOKEN;
    if (!token) return err('GITHUB_TOKEN not configured');

    const filePath = `src/content/blog/${post.slug}.mdx`;
    let existingSha: string | undefined;
    try {
      const checkResp = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );
      if (checkResp.ok) {
        const fileData = await checkResp.json() as { sha?: string };
        existingSha = fileData.sha;
      }
    } catch { /* proceed without sha */ }

    const contentBase64 = btoa(unescape(encodeURIComponent(mdxContent)));
    const commitBody: Record<string, unknown> = {
      message: `[ai-restore] ${post.title} | snapshot=${snapshot_key.split('/').pop()}`,
      content: contentBase64,
      branch: GITHUB_BRANCH,
    };
    if (existingSha) commitBody.sha = existingSha;

    const putResp = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(commitBody),
      },
    );

    if (!putResp.ok) {
      const errBody = await putResp.text().catch(() => `HTTP ${putResp.status}`);
      return err(`GitHub commit failed: ${putResp.status} ${errBody.slice(0, 100)}`);
    }

    const putData = await putResp.json() as { commit?: { sha?: string } };
    return ok({ restored: true, commit_sha: putData.commit?.sha ?? null });
  }

  // ── Manual refresh trigger ──────────────────────────────────────────────────
  const body = await request.json().catch(() => null) as { post_id?: string } | null;
  const { post_id } = body ?? {};
  if (!post_id) return err('post_id is required');

  const post = await db
    .prepare('SELECT id, slug, title, source FROM posts WHERE id = ?')
    .bind(post_id)
    .first<PostRow>();

  if (!post) return err('Not found');
  if (post.source !== 'ai') return err('Only AI-authored posts can be refreshed');

  const queue = cfEnv.BLOG_REFRESH_QUEUE;
  if (!queue) return err('BLOG_REFRESH_QUEUE not available');

  await queue.send(refreshMessage(post_id));
  return ok({ queued: true });
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: SECURITY_HEADERS,
  });
