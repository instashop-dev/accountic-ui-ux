## ADDED Requirements

### Requirement: Analytics module writes structured events to Cloudflare Analytics Engine
`src/lib/analytics.ts` SHALL export a `logEvent(env: Env, event: PipelineEvent): void` function that writes a row to the `BLOG_ANALYTICS` Analytics Engine dataset. Each row SHALL include the following fields: `event` (string — event name), `stage` (string — pipeline stage), `article_id` (string — draft ID or topic ID), `tokens_used` (number), `duration_ms` (number), `quality_score` (number, 0 if not applicable), `outcome` (string: `'success' | 'failure' | 'skipped' | 'fallback'`). The function SHALL silently no-op (without throwing) if `env.BLOG_ANALYTICS` is undefined, allowing local development without the binding.

#### Scenario: Event is written to Analytics Engine in production
- **WHEN** `logEvent` is called with a valid `PipelineEvent` and `env.BLOG_ANALYTICS` is defined
- **THEN** a row is written to the `BLOG_ANALYTICS` dataset with all required fields

#### Scenario: Missing binding does not throw in local dev
- **WHEN** `logEvent` is called and `env.BLOG_ANALYTICS` is `undefined`
- **THEN** the function returns without throwing any error

### Requirement: All five pipeline workers emit Analytics Engine events
Each pipeline stage Worker (`topic-discovery`, `outline-generation`, `article-generation`, `humanizer`, `publisher`) SHALL call `logEvent` at the following moments: (a) at the start of processing (`outcome: 'skipped'` if the message is skipped early), (b) on successful completion (`outcome: 'success'`), and (c) on error or quality failure (`outcome: 'failure'`). The humanizer Worker additionally SHALL emit `outcome: 'fallback'` when the original content is retained due to quality regression or disabled state.

#### Scenario: Article-generation emits success event with token count
- **WHEN** the article-generation Worker successfully creates a draft
- **THEN** `logEvent` is called with `event = 'article_generated'`, `stage = 'article-generation'`, `tokens_used` = actual Claude token count, `outcome = 'success'`

#### Scenario: Humanizer emits fallback event
- **WHEN** the humanizer Worker retains original content due to quality regression
- **THEN** `logEvent` is called with `event = 'humanizer_fallback'`, `stage = 'humanizer'`, `outcome = 'fallback'`

#### Scenario: Publisher emits success event on GitHub commit
- **WHEN** the publisher Worker successfully commits to GitHub
- **THEN** `logEvent` is called with `event = 'article_published'`, `stage = 'publisher'`, `outcome = 'success'`

### Requirement: `BLOG_ANALYTICS` binding is declared in `wrangler.jsonc`
`wrangler.jsonc` SHALL include an `analytics_engine_datasets` binding named `BLOG_ANALYTICS` pointing to dataset `blog-pipeline-events`. This binding SHALL be available to all pipeline Worker entry points that import `src/lib/analytics.ts`.

#### Scenario: Analytics Engine binding declared
- **WHEN** `wrangler.jsonc` is applied
- **THEN** all pipeline Workers have access to the `BLOG_ANALYTICS` binding via `env.BLOG_ANALYTICS`
