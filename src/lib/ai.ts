import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const RETRYABLE_STATUS = new Set([429, 529]);

export interface GenerateParams {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
}

export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public retries: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class BudgetExceededError extends Error {
  constructor(
    public cap: number,
    public used: number,
    public requested: number,
  ) {
    super(`Daily token budget exceeded: cap=${cap}, used=${used}, requested=${requested}`);
    this.name = 'BudgetExceededError';
  }
}

export function createAIClient(env: { ANTHROPIC_API_KEY: string }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async function generate(params: GenerateParams): Promise<GenerateResult> {
    const model = params.model ?? DEFAULT_MODEL;
    const maxTokens = params.maxTokens ?? 4096;
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const createParams: Parameters<typeof client.messages.create>[0] = {
          model,
          max_tokens: maxTokens,
          system: [
            {
              type: 'text',
              text: params.system,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: params.user }],
        };
        if (params.temperature !== undefined) {
          (createParams as Record<string, unknown>).temperature = params.temperature;
        }
        const response = await client.messages.create(createParams);

        const text = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');

        const usage = response.usage as {
          input_tokens: number;
          output_tokens: number;
          cache_read_input_tokens?: number;
        };

        return {
          text,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
        };
      } catch (err: unknown) {
        lastError = err;

        const status = getStatus(err);
        if (status === null || !RETRYABLE_STATUS.has(status)) {
          throw new AIError(
            status !== null ? String(status) : 'unknown',
            err instanceof Error ? err.message : String(err),
            attempt,
          );
        }

        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    throw new AIError(
      'rate_limit',
      lastError instanceof Error ? lastError.message : String(lastError),
      RETRY_DELAYS_MS.length,
    );
  }

  return { generate };
}

export async function checkTokenBudget(
  db: D1Database,
  tokensRequested: number,
): Promise<void> {
  const [capRow, usedRow] = await Promise.all([
    db.prepare('SELECT value FROM settings WHERE key = ?').bind('daily_token_cap').first<{ value: string }>(),
    db.prepare('SELECT value FROM settings WHERE key = ?').bind('tokens_used_today').first<{ value: string }>(),
  ]);

  const cap = parseInt(capRow?.value ?? '200000', 10);
  const used = parseInt(usedRow?.value ?? '0', 10);

  if (used + tokensRequested > cap) {
    throw new BudgetExceededError(cap, used, tokensRequested);
  }
}

export async function incrementTokensUsed(
  db: D1Database,
  tokensUsed: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE settings
       SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT),
           updated_at = datetime('now')
       WHERE key = 'tokens_used_today'`,
    )
    .bind(tokensUsed)
    .run();
}

function getStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'status' in err) {
    return typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
