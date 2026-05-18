// Typed queue message constructors and idempotency helpers.
// Safe to import in Workers and Node.js scripts (no astro:* imports).

// ── Message types ─────────────────────────────────────────────────────────────

export interface TopicDiscoveryMessage {
  stage: 'topic-discovery';
  count?: number;
}

export interface OutlineMessage {
  stage: 'outline-generation';
  topic_id: string;
}

export interface ArticleMessage {
  stage: 'article-generation';
  outline_id: string;
}

export interface PublishMessage {
  stage: 'publisher';
  draft_id: string;
}

export interface RefreshMessage {
  stage: 'refresh';
  post_id: string;
}

export type PipelineMessage =
  | TopicDiscoveryMessage
  | OutlineMessage
  | ArticleMessage
  | PublishMessage
  | RefreshMessage;

// ── Message constructors ──────────────────────────────────────────────────────

export function topicDiscoveryMessage(count = 10): TopicDiscoveryMessage {
  return { stage: 'topic-discovery', count };
}

export function outlineMessage(topic_id: string): OutlineMessage {
  return { stage: 'outline-generation', topic_id };
}

export function articleMessage(outline_id: string): ArticleMessage {
  return { stage: 'article-generation', outline_id };
}

export function publishMessage(draft_id: string): PublishMessage {
  return { stage: 'publisher', draft_id };
}

export function refreshMessage(post_id: string): RefreshMessage {
  return { stage: 'refresh', post_id };
}

// ── Idempotency ───────────────────────────────────────────────────────────────

/**
 * Computes a deterministic SHA-256 hex hash of stage inputs for idempotency.
 * Uses crypto.subtle — available in Cloudflare Workers and Node.js 22+.
 */
export async function computeInputHash(stageInputs: object): Promise<string> {
  const json = JSON.stringify(stageInputs, Object.keys(stageInputs).sort());
  const encoded = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Simple ID generation ──────────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}
