### Requirement: wrangler.jsonc declares all required infrastructure bindings
`wrangler.jsonc` SHALL declare stubs for D1 (`BLOG_DB`), KV (`BLOG_KV`), R2 (`BLOG_ASSETS`), two Queues (`blog-pipeline`, `blog-publish`), and two Cron triggers, without removing or modifying any existing keys (`ASSETS`, `SIGNUP_NOTIFY`, `observability`, `compatibility_date`).

#### Scenario: Existing bindings preserved
- **WHEN** `wrangler.jsonc` is updated with infrastructure stubs
- **THEN** `ASSETS`, `SIGNUP_NOTIFY`, `observability`, and `compatibility_date` remain unchanged and `wrangler deploy` does not report removed bindings

#### Scenario: D1 binding declared
- **WHEN** `wrangler.jsonc` is read
- **THEN** it contains a `d1_databases` array entry with `binding: "BLOG_DB"` and a placeholder `database_id`

#### Scenario: KV binding declared
- **WHEN** `wrangler.jsonc` is read
- **THEN** it contains a `kv_namespaces` array entry with `binding: "BLOG_KV"` and a placeholder `id`

#### Scenario: R2 binding declared
- **WHEN** `wrangler.jsonc` is read
- **THEN** it contains an `r2_buckets` array entry with `binding: "BLOG_ASSETS"` and a placeholder `bucket_name`

#### Scenario: Queues declared
- **WHEN** `wrangler.jsonc` is read
- **THEN** it contains a `queues.producers` entry for `blog-pipeline` bound as `BLOG_PIPELINE_QUEUE` and a `blog-publish` queue bound as `BLOG_PUBLISH_QUEUE`

#### Scenario: Cron triggers declared
- **WHEN** `wrangler.jsonc` is read
- **THEN** it contains `triggers.crons` with `"0 3 * * 1"` (weekly topic discovery) and `"0 4 * * *"` (daily refresh scan)

### Requirement: Placeholder values are clearly marked for operator replacement
Every stub binding that requires a provisioned resource ID SHALL include a comment or sentinel value (e.g. `"REPLACE_AFTER_PROVISION"`) so the operator knows what to fill in before deploying.

#### Scenario: Placeholder sentinel present
- **WHEN** a developer reads `wrangler.jsonc` before provisioning
- **THEN** each resource ID field that requires a real value contains a string that starts with `"REPLACE_"` or is annotated with a `// TODO` comment
