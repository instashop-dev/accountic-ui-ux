## 1. Cloudflare Bindings (wrangler.jsonc)

- [x] 1.1 Add `d1_databases` array to `wrangler.jsonc` with binding `BLOG_DB` and placeholder `database_id: "REPLACE_AFTER_PROVISION"`
- [x] 1.2 Add `kv_namespaces` array to `wrangler.jsonc` with binding `BLOG_KV` and placeholder `id: "REPLACE_AFTER_PROVISION"`
- [x] 1.3 Add `r2_buckets` array to `wrangler.jsonc` with binding `BLOG_ASSETS` and placeholder `bucket_name: "REPLACE_AFTER_PROVISION"`
- [x] 1.4 Add `queues.producers` to `wrangler.jsonc`: `BLOG_PIPELINE_QUEUE` → `blog-pipeline`, `BLOG_PUBLISH_QUEUE` → `blog-publish`
- [x] 1.5 Add `triggers.crons` to `wrangler.jsonc`: `"0 3 * * 1"` (topic discovery) and `"0 4 * * *"` (refresh scan)
- [x] 1.6 Verify all existing keys (`ASSETS`, `SIGNUP_NOTIFY`, `observability`, `compatibility_date`) are unchanged
- [x] 1.7 Run `npm run build` to confirm `astro build` still passes with updated `wrangler.jsonc`

## 2. Package.json Scripts

- [x] 2.1 Add `"db:migrate": "wrangler d1 execute BLOG_DB --file=migrations/001_init.sql"` to `package.json` scripts
- [x] 2.2 Add `"db:seed": "echo 'No seed data for production. Use migrations only.'"` to `package.json` scripts
- [x] 2.3 Add `"blog:validate": "npx tsx scripts/validate-post.ts"` to `package.json` scripts
- [x] 2.4 Add `"blog:generate-types": "wrangler types"` to `package.json` scripts
- [x] 2.5 Verify all existing scripts (`dev`, `build`, `preview`, `astro`, `generate-types`, `deploy`) remain unchanged

## 3. GitHub Actions CI/CD

- [x] 3.1 Create `.github/workflows/` directory
- [x] 3.2 Create `.github/workflows/deploy.yml` with trigger on `push` to `main`
- [x] 3.3 Add comment block at top of workflow listing required secrets (`CLOUDFLARE_API_TOKEN`) and how to obtain them
- [x] 3.4 Add job steps: `actions/checkout@v4`, `actions/setup-node@v4` (node 22), `npm ci`, `npm run build`, `npx wrangler deploy`
- [x] 3.5 Set `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}` env var on the wrangler deploy step
- [x] 3.6 Verify the workflow YAML is valid (correct indentation, no duplicate keys)

## 4. D1 Database Migrations

- [x] 4.1 Create `migrations/` directory
- [x] 4.2 Create `migrations/001_init.sql` with `CREATE TABLE IF NOT EXISTS posts` — all columns per spec (id, slug, title, description, pillar, tone, author, pub_date, read_time, source DEFAULT 'human', status DEFAULT 'published', created_at, updated_at)
- [x] 4.3 Add `CREATE TABLE IF NOT EXISTS generation_jobs` — all columns per spec (id, post_id FK, stage, status DEFAULT 'pending', input_hash, output_ref, error, created_at, updated_at)
- [x] 4.4 Add `CREATE TABLE IF NOT EXISTS settings` — columns (key PRIMARY KEY, value, updated_at)
- [x] 4.5 Add seed INSERT statements for default settings: `generation_enabled = 'false'`, `weekly_target = '2'`, `quality_threshold = '0.8'` using `INSERT OR IGNORE`
- [x] 4.6 Create `migrations/001_rollback.sql` with `DROP TABLE IF EXISTS generation_jobs`, `DROP TABLE IF EXISTS posts`, `DROP TABLE IF EXISTS settings` in that order

## 5. Provision Script

- [x] 5.1 Create `scripts/` directory
- [x] 5.2 Create `scripts/provision.ts` as a runnable `tsx` script (shebang or explicit `tsx scripts/provision.ts` invocation)
- [x] 5.3 Add section: create D1 database (`wrangler d1 create blog-db`) and print resulting `database_id` with instructions to paste into `wrangler.jsonc`
- [x] 5.4 Add section: create KV namespace (`wrangler kv:namespace create BLOG_KV`) and print `id`
- [x] 5.5 Add section: create R2 bucket (`wrangler r2 bucket create blog-assets`) and print bucket name
- [x] 5.6 Add section: create Queues (`wrangler queues create blog-pipeline` and `blog-publish`) and print names
- [x] 5.7 Add final summary block that tells the operator exactly which values to substitute in `wrangler.jsonc`
- [x] 5.8 Note at top of script: "Run this once per environment. Do not run in CI."

## 6. Post Validation Script

- [x] 6.1 Create `scripts/validate-post.ts` that reads `process.argv[2]` as the file path and exits with code 1 + usage message if not provided
- [x] 6.2 Read the file at the given path; exit with code 1 + error message if file not found
- [x] 6.3 Parse YAML frontmatter from the file using `src/lib/frontmatter.ts` `parseFrontmatter`
- [x] 6.4 Call `validatePostFrontmatter` from `src/lib/schema-validate.ts` on the parsed data
- [x] 6.5 On success: print `✓ Valid: <slug>` to stdout and exit with code 0
- [x] 6.6 On failure: print each error string to stderr and exit with code 1
- [x] 6.7 Test manually against one valid post (`src/content/blog/ai-drafted-notice-replies-failure-modes.md`) and verify exit code 0

## 7. src/lib — frontmatter.ts

- [x] 7.1 Create `src/lib/` directory
- [x] 7.2 Create `src/lib/frontmatter.ts` — export `parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string }`
- [x] 7.3 Implement: split on first and second `---` fence; parse YAML between fences using a minimal inline parser (no external yaml dep) or confirm `js-yaml` availability; return body after second fence as `content`
- [x] 7.4 Handle edge case: no frontmatter block → return `{ data: {}, content: raw }`
- [x] 7.5 Export `serializeFrontmatter(data: Record<string, unknown>, content: string): string` that writes `---\n<yaml>\n---\n<content>`
- [x] 7.6 Verify no `astro:*` imports are present in the file
- [x] 7.7 Verify round-trip: `parseFrontmatter(serializeFrontmatter(data, content))` returns equivalent `data`

## 8. src/lib — slug.ts

- [x] 8.1 Create `src/lib/slug.ts` — export `toSlug(title: string): string`
- [x] 8.2 Implement: lowercase → replace non-alphanumeric with `-` → collapse consecutive `-` → strip leading/trailing `-` → truncate to 60 chars → strip trailing `-` after truncation
- [x] 8.3 Verify no `astro:*` imports are present
- [x] 8.4 Test cases: `'Five Failure Modes of AI-Drafted Replies'` → `'five-failure-modes-of-ai-drafted-replies'`; title with special chars; title > 60 chars

## 9. src/lib — schema-validate.ts

- [x] 9.1 Create `src/lib/schema-validate.ts` — import `PILLARS`, `TONES` from `../../src/blog-meta` (or relative path from lib)
- [x] 9.2 Import `z` from `astro/zod` (same source as `src/content.config.ts`)
- [x] 9.3 Define inline Zod schema mirroring `src/content.config.ts` fields (excluding `heroImage` which uses Astro's `image()` helper — use `z.string().optional()` as runtime substitute)
- [x] 9.4 Export `validatePostFrontmatter(data: unknown): { success: true; data: PostData } | { success: false; errors: string[] }`
- [x] 9.5 On parse failure: extract `ZodError` issues into human-readable strings (field path + message)
- [x] 9.6 Verify no `astro:*` imports (only `astro/zod` which is a direct package re-export)
- [x] 9.7 Run `npm run build` as final regression check — confirms `src/lib/` additions don't break the Astro build
