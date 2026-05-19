import { generateId } from '../../lib/queue';
import { findInternalLinks, injectInternalLinks } from '../../lib/linker';
import { buildSchemaScriptBlock } from '../../lib/seo-schema';
import { logEvent } from '../../lib/analytics';
import { checkEmergencyStop, EmergencyStopError } from '../../lib/safety';
import { redactSecrets } from '../../lib/redact';
import { validateSlug } from '../../lib/admin-security';

interface Env {
  BLOG_DB: D1Database;
  GITHUB_TOKEN: string;
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
}

interface PublishMessage {
  stage: string;
  draft_id: string;
}

interface Draft {
  id: string;
  slug: string;
  content: string;
  frontmatter_json: string;
  status: string;
}

interface FrontmatterData {
  title?: string;
  description?: string;
  pubDate?: string;
  pillar?: string;
  author?: string;
  readTime?: number;
  tone?: string;
  featured?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

const GITHUB_OWNER = 'instashop-dev';
const GITHUB_REPO = 'accountic-ui-ux';
const GITHUB_BRANCH = 'main';

// ── Content cleaning helpers ──────────────────────────────────────────────────

/**
 * Strip a wrapping ```mdx ... ``` or ``` ... ``` code fence if Claude
 * wrapped its entire output in one (a common model behaviour).
 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:mdx|markdown|md)?\r?\n([\s\S]*?)\r?\n```\s*$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Strip a YAML frontmatter block (--- ... ---) from the top of the content.
 * The article-generation prompt tells Claude not to write frontmatter, but
 * it sometimes does anyway — we always build it from structured pipeline data.
 */
function stripEmbeddedFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
}

/**
 * Build a YAML frontmatter block from the structured frontmatter object.
 * Values come from the pipeline (outline JSON + topic row), not from Claude.
 */
function buildFrontmatterBlock(fm: FrontmatterData): string {
  const esc = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const lines = [
    '---',
    `title: "${esc(String(fm.title ?? ''))}"`,
    `description: "${esc(String(fm.description ?? ''))}"`,
    `pubDate: ${String(fm.pubDate ?? new Date().toISOString().slice(0, 10))}`,
    `pillar: "${esc(String(fm.pillar ?? ''))}"`,
    `author: "${esc(String(fm.author ?? 'Accountic Team'))}"`,
    `readTime: ${Number(fm.readTime ?? 5)}`,
    `tone: "${esc(String(fm.tone ?? 'emerald'))}"`,
    `featured: ${Boolean(fm.featured ?? false)}`,
    '---',
    '',
  ];
  return lines.join('\n');
}

// ── Worker ────────────────────────────────────────────────────────────────────

export default {
  async queue(batch: MessageBatch<PublishMessage>, env: Env): Promise<void> {
    const db = env.BLOG_DB;

    for (const msg of batch.messages) {
      const { draft_id } = msg.body;
      const start = Date.now();

      if (!draft_id) {
        console.warn('[publisher] Missing draft_id');
        msg.ack();
        continue;
      }

      // ── Emergency stop ─────────────────────────────────────────────────────
      try {
        await checkEmergencyStop(db);
      } catch (e) {
        if (e instanceof EmergencyStopError) {
          console.warn('[publisher] Emergency stop active — acking message without processing');
          msg.ack();
          continue;
        }
        throw e;
      }

      logEvent(env, { event: 'article_publish_start', stage: 'publisher', article_id: draft_id, tokens_used: 0, duration_ms: 0, quality_score: 0, outcome: 'success' });

      const draft = await db
        .prepare('SELECT id, slug, content, frontmatter_json, status FROM drafts WHERE id = ?')
        .bind(draft_id)
        .first<Draft>();

      if (!draft) {
        console.warn('[publisher] Draft not found:', draft_id);
        msg.ack();
        continue;
      }

      if (draft.status !== 'approved') {
        console.warn('[publisher] Draft is not approved, skipping:', draft_id, draft.status);
        msg.ack();
        continue;
      }

      if (!validateSlug(draft.slug)) {
        console.error('[publisher] Invalid slug rejected:', draft.slug);
        await db
          .prepare(`UPDATE drafts SET status = 'publish_failed', error = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind('Invalid slug: failed path-traversal guard', draft_id)
          .run();
        msg.ack();
        continue;
      }

      // ── Slug-level idempotency ─────────────────────────────────────────────
      // If a post with this slug already exists, the draft was already published.
      // Mark it published and ack without calling GitHub again.
      const existingPost = await db
        .prepare('SELECT id FROM posts WHERE slug = ?')
        .bind(draft.slug)
        .first<{ id: string }>();

      if (existingPost) {
        await db
          .prepare(`UPDATE drafts SET status = 'published', updated_at = datetime('now') WHERE id = ?`)
          .bind(draft_id)
          .run();
        logEvent(env, { event: 'article_published', stage: 'publisher', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'success', reason: 'idempotent_slug' });
        msg.ack();
        continue;
      }

      let fm: FrontmatterData = {};
      try { fm = JSON.parse(draft.frontmatter_json) as FrontmatterData; } catch { /**/ }

      // ── Clean article body ─────────────────────────────────────────────────
      // Strip any ```mdx ... ``` wrapper Claude may have added, then strip any
      // embedded frontmatter Claude wrote (we always build it from pipeline data).
      const cleanBody = stripEmbeddedFrontmatter(stripCodeFence(draft.content));

      // ── Internal link injection ─────────────────────────────────────────────
      const internalLinks = await findInternalLinks(
        db,
        { tags: Array.isArray(fm.tags) ? fm.tags as string[] : [], pillar: String(fm.pillar ?? '') },
        draft.slug,
      );
      const linkedBody = injectInternalLinks(cleanBody, internalLinks);

      // ── SEO schema injection ────────────────────────────────────────────────
      const schemaBlock = buildSchemaScriptBlock(
        { title: String(fm.title ?? ''), description: String(fm.description ?? ''), pubDate: String(fm.pubDate ?? ''), author: String(fm.author ?? 'Accountic Team'), slug: draft.slug, pillar: String(fm.pillar ?? '') },
        linkedBody,
      );

      // ── Assemble final MDX file: frontmatter + body + schema ───────────────
      const frontmatterBlock = buildFrontmatterBlock(fm);
      const finalContent = frontmatterBlock + linkedBody + schemaBlock;

      const filePath = `src/content/blog/${draft.slug}.mdx`;
      const commitMessage = `[ai-gen] ${fm.title ?? draft.slug} | draft_id=${draft.id}`;

      // Check if file already exists (get current SHA for update vs create)
      let existingSha: string | undefined;
      try {
        const checkResp = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
          {
            headers: {
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'accountic-blog-pipeline/1.0',
            },
          },
        );
        if (checkResp.ok) {
          const fileData = await checkResp.json() as { sha?: string };
          existingSha = fileData.sha;
        }
      } catch { /* file doesn't exist, proceed with create */ }

      const contentBase64 = btoa(unescape(encodeURIComponent(finalContent)));

      const body: Record<string, unknown> = {
        message: commitMessage,
        content: contentBase64,
        branch: GITHUB_BRANCH,
      };
      if (existingSha) body.sha = existingSha;

      const resp = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'accountic-blog-pipeline/1.0',
          },
          body: JSON.stringify(body),
        },
      );

      if (resp.ok) {
        const postId = generateId();
        const pubDate = (fm.pubDate as string | undefined) ?? new Date().toISOString().slice(0, 10);

        await db.batch([
          db.prepare(`UPDATE drafts SET status = 'published', internal_links_added = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(internalLinks.length, draft_id),
          db.prepare(
            `INSERT OR IGNORE INTO posts (id, slug, title, description, pillar, tone, author, pub_date, read_time, source, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', 'published')`,
          ).bind(
            postId,
            draft.slug,
            String(fm.title ?? draft.slug),
            String(fm.description ?? ''),
            String(fm.pillar ?? ''),
            String(fm.tone ?? 'emerald'),
            String(fm.author ?? 'Accountic Team'),
            pubDate,
            Number(fm.readTime ?? 5),
          ),
        ]);

        logEvent(env, { event: 'article_published', stage: 'publisher', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'success' });
        console.log('[publisher] Published:', draft.slug, 'links:', internalLinks.length);
      } else {
        const errorBody = await resp.text();
        await db
          .prepare(`UPDATE drafts SET status = 'publish_failed', error = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(errorBody.slice(0, 2000), draft_id)
          .run();
        logEvent(env, { event: 'article_publish_failed', stage: 'publisher', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', reason: `github_${resp.status}` });
        // Redact to ensure response bodies never include credential echoes
        console.error('[publisher] GitHub API error:', resp.status, redactSecrets(errorBody.slice(0, 200)));
      }

      msg.ack();
    }
  },
};
