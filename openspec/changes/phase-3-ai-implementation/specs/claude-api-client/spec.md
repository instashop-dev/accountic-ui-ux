## ADDED Requirements

### Requirement: ai.ts exports a typed Claude API client with prompt caching
`src/lib/ai.ts` SHALL export a `createAIClient(env: { ANTHROPIC_API_KEY: string })` factory that returns a client object with a `generate(params: GenerateParams): Promise<GenerateResult>` method. The client SHALL use the `@anthropic-ai/sdk` package, enable prompt caching on the `system` prompt block (via `cache_control: { type: 'ephemeral' }`), and default to model `claude-sonnet-4-6`. `GenerateParams` SHALL accept `{ system: string; user: string; maxTokens?: number; model?: string }`. `GenerateResult` SHALL be `{ text: string; inputTokens: number; outputTokens: number; cacheHit: boolean }`.

#### Scenario: Successful generation returns text and token counts
- **WHEN** `client.generate({ system: "...", user: "..." })` is called with a valid API key
- **THEN** it returns `{ text: <non-empty string>, inputTokens: <number>, outputTokens: <number>, cacheHit: <boolean> }`

#### Scenario: Prompt caching is applied to system prompt
- **WHEN** the client calls the Anthropic API
- **THEN** the request body includes `cache_control: { type: 'ephemeral' }` on the system message block

#### Scenario: Default model is claude-sonnet-4-6
- **WHEN** `generate` is called without specifying a `model`
- **THEN** the API request uses `model: 'claude-sonnet-4-6'`

#### Scenario: Model override is respected
- **WHEN** `generate` is called with `model: 'claude-opus-4-7'`
- **THEN** the API request uses `model: 'claude-opus-4-7'`

### Requirement: ai.ts implements exponential backoff retry on transient errors
`src/lib/ai.ts` client SHALL retry failed API calls up to 3 times on HTTP 429 (rate limit) and 529 (overloaded) responses, using delays of 2s, 4s, and 8s respectively. On non-retryable errors (4xx other than 429) or after exhausting retries, it SHALL throw an `AIError` with `{ code: string; message: string; retries: number }`.

#### Scenario: Rate-limit error triggers retry
- **WHEN** the Anthropic API returns HTTP 429 on the first call
- **THEN** the client waits 2 seconds and retries; if the retry succeeds, `generate` resolves normally

#### Scenario: Exhausted retries throw AIError
- **WHEN** the Anthropic API returns HTTP 429 on all 3 retry attempts
- **THEN** `generate` throws an `AIError` with `retries: 3`

#### Scenario: Non-retryable error throws immediately
- **WHEN** the Anthropic API returns HTTP 400 (invalid request)
- **THEN** `generate` throws an `AIError` immediately without retrying

### Requirement: ai.ts enforces a daily token budget read from D1 settings
`src/lib/ai.ts` SHALL export a `checkTokenBudget(db: D1Database, tokensRequested: number): Promise<void>` function that reads `daily_token_cap` from D1 `settings`, reads `tokens_used_today` from D1 `settings`, and throws a `BudgetExceededError` if `tokens_used_today + tokensRequested > daily_token_cap`. After a successful `generate` call, the caller SHALL increment `tokens_used_today` in D1 settings.

#### Scenario: Within-budget call proceeds
- **WHEN** `daily_token_cap = '200000'` and `tokens_used_today = '50000'` and 10,000 tokens are requested
- **THEN** `checkTokenBudget` resolves without throwing

#### Scenario: Over-budget call is blocked
- **WHEN** `daily_token_cap = '200000'` and `tokens_used_today = '195000'` and 10,000 tokens are requested
- **THEN** `checkTokenBudget` throws `BudgetExceededError` with `{ cap: 200000, used: 195000, requested: 10000 }`
