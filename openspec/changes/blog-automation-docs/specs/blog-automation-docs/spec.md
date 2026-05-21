## ADDED Requirements

### Requirement: Documentation file exists at repo root
A file `BLOG_AUTOMATION.md` SHALL exist at the repository root and be committed to the `main` branch so it is immediately visible to anyone who opens the repository.

#### Scenario: File is discoverable
- **WHEN** a user opens the GitHub repository root
- **THEN** `BLOG_AUTOMATION.md` is listed in the file tree without navigating any subdirectory

### Requirement: Quick-start section enables pipeline in under 2 minutes
The document SHALL open with a "Quick Start" section containing the exact DB commands or admin UI steps needed to enable auto-blogging, so an admin can activate the pipeline without reading further.

#### Scenario: Admin enables pipeline from cold start
- **WHEN** the admin reads only the Quick Start section
- **THEN** they know exactly which setting to toggle (`generation_enabled = true`) and where to do it (`/admin/settings` UI or SQL)

### Requirement: Settings reference table is complete and accurate
The document SHALL include a table listing every operational setting key, its default value, allowed values, and effect on the pipeline — matching the `settings` table in the live database.

#### Scenario: Admin looks up a setting
- **WHEN** an admin searches the doc for `daily_token_cap`
- **THEN** they find its default (`200000`), allowed range, and effect (daily Claude token budget) without opening any source file

#### Scenario: Emergency stop is documented
- **WHEN** an admin needs to halt the pipeline immediately
- **THEN** the doc shows `pipeline_emergency_stop = true` as the kill switch and explains its effect (all pipeline workers ack without processing)

### Requirement: Pipeline overview is scannable
The document SHALL describe the 6-stage pipeline in a format that can be read in under 60 seconds (numbered list or compact table), including stage name, trigger, and output for each stage.

#### Scenario: Admin checks what triggered an article
- **WHEN** an admin reviews the pipeline overview
- **THEN** they can trace a published article back through humanizer → article-generation → outline-generation → topic-discovery in one pass

### Requirement: Required secrets and bindings are listed
The document SHALL list every required environment secret (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `ADMIN_PASSWORD`) and Cloudflare binding with a one-line description of its purpose and minimum required permissions.

#### Scenario: New developer sets up secrets
- **WHEN** a new developer reads the secrets section
- **THEN** they know exactly which secrets to provision and what permission scope each needs

### Requirement: CLI commands are copy-paste ready
The document SHALL include a section with the most common `npm run` commands needed to operate the pipeline (generate topics, deploy, seed prompts, validate post), formatted as fenced code blocks.

#### Scenario: Admin triggers manual generation
- **WHEN** an admin copies `npm run blog:generate` from the doc
- **THEN** the command runs correctly without modification

### Requirement: Draft approval workflow is documented
The document SHALL describe the manual approval step between humanizer output and publication, including where to find pending drafts (`/admin/queue`) and how to approve or reject them.

#### Scenario: Admin reviews pending drafts
- **WHEN** an admin wants to approve a draft for publication
- **THEN** the doc directs them to `/admin/queue` and explains the approve/reject actions available there
