## ADDED Requirements

### Requirement: Topic-discovery v3 prompt enumerates all 9 pillars
Migration `008_expand_pillars.sql` SHALL insert a new `topic-discovery` prompt row (version 3, `is_active = 1`) whose `system_prompt` names all 9 India-specific pillars and whose `user_prompt_template` restricts the `"pillar"` field to exactly the 9 valid values. The v2 row SHALL be set `is_active = 0`.

#### Scenario: Exactly one active topic-discovery prompt after migration
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** `SELECT COUNT(*) FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1` returns 1

#### Scenario: Active topic-discovery prompt lists all 9 pillars
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** the active `topic-discovery` prompt's `user_prompt_template` contains each of: `"AI Tools for Indian CAs"`, `"GST Automation"`, `"CA Firm Automation"`, `"Audit Technology"`

#### Scenario: Active topic-discovery prompt excludes Firm Operations
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** the active `topic-discovery` prompt's `user_prompt_template` does NOT contain `"Firm Operations"`

#### Scenario: Topic-discovery v3 retains coverage brief placeholder
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** the active `topic-discovery` prompt's `user_prompt_template` still contains `{{coverage_brief}}` and `{{count}}`

### Requirement: Article-generation v2 prompt enumerates all 9 pillars
Migration `008_expand_pillars.sql` SHALL insert a new `article-generation` prompt row (version 2, `is_active = 1`) whose `user_prompt_template` frontmatter schema restricts the `pillar` field to exactly the 9 valid values. The v1 row SHALL be set `is_active = 0`.

#### Scenario: Exactly one active article-generation prompt after migration
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** `SELECT COUNT(*) FROM prompts WHERE stage = 'article-generation' AND is_active = 1` returns 1

#### Scenario: Active article-generation prompt lists all 9 pillars
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** the active `article-generation` prompt's `user_prompt_template` contains each of: `"AI Tools for Indian CAs"`, `"GST Automation"`, `"CA Firm Automation"`, `"Audit Technology"`

#### Scenario: Article-generation v2 retains outline and read-time placeholders
- **WHEN** `migrations/008_expand_pillars.sql` is applied
- **THEN** the active `article-generation` prompt's `user_prompt_template` contains `{{outline_json}}` and `{{read_time}}`

### Requirement: Rollback restores 6-pillar prompts as active
Migration `008_rollback.sql` SHALL set `prompt-topic-discovery-v2` `is_active = 1`, `prompt-topic-discovery-v3` `is_active = 0`, `prompt-article-generation-v1` `is_active = 1`, and `prompt-article-generation-v2` `is_active = 0`.

#### Scenario: Rollback restores topic-discovery v2
- **WHEN** `migrations/008_rollback.sql` is applied after `migrations/008_expand_pillars.sql`
- **THEN** `prompt-topic-discovery-v2` has `is_active = 1` and `prompt-topic-discovery-v3` has `is_active = 0`

#### Scenario: Rollback restores article-generation v1
- **WHEN** `migrations/008_rollback.sql` is applied after `migrations/008_expand_pillars.sql`
- **THEN** `prompt-article-generation-v1` has `is_active = 1` and `prompt-article-generation-v2` has `is_active = 0`
