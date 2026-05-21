## 1. Write Documentation

- [x] 1.1 Create `BLOG_AUTOMATION.md` at repo root with Quick Start section (enable pipeline via `/admin/settings` or SQL)
- [x] 1.2 Add Settings Reference table covering all operational keys: `generation_enabled`, `pipeline_emergency_stop`, `auto_publish`, `daily_token_cap`, `tokens_used_today`, `ai_model`, `humanizer_enabled`, `humanizer_temperature`
- [x] 1.3 Add Pipeline Overview section describing all 6 stages (topic-discovery → outline-generation → article-generation → humanizer → publisher → refresh) with trigger and output for each
- [x] 1.4 Add Required Secrets section listing `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `ADMIN_PASSWORD` with permissions and Cloudflare bindings
- [x] 1.5 Add CLI Commands section with copy-paste `npm run` commands: `blog:generate`, `blog:deploy`, `db:seed-prompts`, `blog:validate`, `blog:trigger-article`
- [x] 1.6 Add Draft Approval Workflow section explaining `/admin/queue` approve/reject flow
- [x] 1.7 Add Safety Mechanisms section covering token budget, emergency stop, circuit breaker, and quality gates

## 2. Review and Verify

- [x] 2.1 Cross-check all setting keys and defaults against `src/lib/safety.ts`, `src/lib/ai.ts`, and migrations to confirm accuracy
- [x] 2.2 Verify CLI commands against `package.json` scripts
- [x] 2.3 Confirm the doc fits on one printed page (target: ≤ 120 lines of Markdown)
- [x] 2.4 Commit `BLOG_AUTOMATION.md` to `main` branch
