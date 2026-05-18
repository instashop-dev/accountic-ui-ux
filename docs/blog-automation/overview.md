# FINAL PRODUCTION SPEC

# Accountic AI Blogging Automation System

Project: [Accountic](https://accountic.in)
Target Environment: Existing Astro + Cloudflare Workers production repository
Deployment Platform: Cloudflare
Execution Workflow: Claude Code + OpenSpec
Deployment Strategy: Incremental production-safe rollout on main branch

---

# 1. Official Development Stack

| Layer             | Final Decision                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| Coding Agent      | [Claude Code](https://www.anthropic.com/claude-code) |
| Workflow          | [OpenSpec](https://github.com/openspecai/openspecm)   |
| IDE               | Claude Code                                                                 |
| Spec Format       | Modular phase specs                                                         |
| Git Strategy      | Main branch                                                                 |
| Reviews           | Mandatory approvals                                                         |
| Deployment Target | Production                                                                  |

---

# 2. Objective

Implement a fully automated AI-native blogging system integrated into the existing Accountic website/blog codebase.

The system must:

* auto-discover high-quality topics
* generate humanized people-first articles
* optimize for SEO + AI Overviews naturally
* generate branded educational illustrations
* publish automatically into the existing Astro blog system
* refresh content intelligently
* provide a native admin dashboard
* deploy entirely on Cloudflare infrastructure
* integrate safely into the existing production architecture

The implementation MUST feel like a native Accountic subsystem.

---

# 3. Core Principles

## 3.1 Additive Integration Only

The implementation MUST operate in additive mode.

DO NOT:

* refactor unrelated systems
* rename existing directories
* restructure Astro architecture
* replace existing deployment flows
* rewrite existing design systems
* replace existing components/utilities unnecessarily

Prefer:

* extension over replacement
* isolated integrations
* reversible changes

Existing project architecture is source-of-truth.

---

# 4. OpenSpec Workflow Is Mandatory

Implementation MUST follow OpenSpec-style execution.

The coding agent MUST:

* separate discovery/planning/execution
* operate phase-by-phase
* request approvals between phases
* generate implementation plans before coding
* keep commits isolated and reversible

---

# 5. Spec Organization

Create:

```text id="3z9s1t"
/docs/blog-automation/
```

Required spec files:

```text id="jlwm27"
overview.md
discovery.md
architecture.md
infrastructure.md
ai-pipeline.md
astro-integration.md
admin-dashboard.md
seo-content-policy.md
observability.md
testing.md
deployment.md
rollback.md
```

---

# 6. Mandatory Discovery Phase

The FIRST phase MUST ONLY perform discovery.

The coding agent MUST NOT:

* create infrastructure
* create workers
* modify production systems
* generate UI
* create routes

until discovery approval is received.

---

# 7. Discovery Requirements

The coding agent MUST inspect and understand:

## Core Project

* package.json
* astro.config.*
* tsconfig.json
* wrangler.toml
* GitHub workflows
* deployment scripts
* environment handling
* middleware
* routing
* MDX integrations
* content collections

## Existing Architecture

* layouts
* admin system
* auth/session system
* utilities
* component structure
* styling architecture

## Existing Blog System

* schema contracts
* markdown strategy
* rendering strategy
* SEO system
* image handling

## Existing Design System

* colors
* typography
* spacing
* cards
* tables
* dashboard layouts
* animations
* illustration styles
* CTA systems

## Existing Documentation

* READMEs
* architecture docs
* ADRs
* comments/conventions

---

# 8. Mandatory Discovery Deliverable

Generate:

```text id="jlwm28"
/docs/blog-automation-analysis.md
```

This MUST include:

* repository analysis
* architecture analysis
* Astro integration analysis
* Cloudflare analysis
* design system analysis
* admin/auth analysis
* deployment analysis
* integration strategy
* risk analysis
* file modification plan

NO implementation during discovery phase.

---

# 9. Mandatory Approval Gates

The coding agent MUST STOP after each phase and wait for approval.

Approval required after:

* discovery
* infrastructure
* AI pipeline
* Astro integration
* admin dashboard
* observability
* testing
* deployment

---

# 10. Infrastructure Requirements

Use Cloudflare-native infrastructure only.

## Allowed Services

| Service          | Usage            |
| ---------------- | ---------------- |
| Workers          | orchestration    |
| Queues           | async processing |
| D1               | metadata/state   |
| KV               | caching/settings |
| R2               | generated assets |
| Cron Triggers    | scheduling       |
| Workers AI       | AI generation    |
| Analytics Engine | telemetry        |

## DO NOT USE

* Docker
* Kubernetes
* external databases
* external workflow engines
* Durable Objects
* Vectorize (future-ready only)

---

# 11. Wrangler CLI Requirement

ALL infrastructure MUST be provisioned using Wrangler CLI only.

Generate:

* wrangler configs
* provisioning scripts
* deployment scripts
* migration scripts

No manual dashboard-only setup.

---

# 12. Cloudflare Resource Naming

ALL resources MUST use:

```text id="jlwm29"
accountic-blog
```

prefix.

Examples:

```text id="jlwm30"
accountic-blog-topic-queue
accountic-blog-d1
accountic-blog-r2
accountic-blog-refresh-worker
```

---

# 13. Environment Separation

Support:

* local
* staging
* production

All resources MUST be environment-scoped.

Example:

```text id="jlwm31"
accountic-blog-prod-d1
accountic-blog-staging-d1
```

---

# 14. Resource Metadata

All resources MUST include metadata/tags where supported:

```text id="jlwm32"
namespace=accountic-blog
project=accountic
managed-by=wrangler
environment=<env>
```

---

# 15. Queue Architecture

Required queues:

* topic queue
* outline queue
* article queue
* humanizer queue
* publish queue
* refresh queue

Each queue MUST support:

* retries
* exponential backoff
* dead-letter queues
* replay support
* observability

---

# 16. Queue Safety

Implement poison message handling.

Failed jobs MUST:

* move to DLQ
* appear in admin dashboard
* support replay

---

# 17. Idempotency Requirements

All workers MUST be idempotent.

Prevent:

* duplicate article generation
* duplicate refresh jobs
* duplicate commits
* duplicate queue processing

---

# 18. Scheduling Requirements

Default:

* 2 articles/day
* refresh every 60 days

Admin configurable.

Future-ready for category-specific refresh rules.

---

# 19. AI Provider Architecture

Abstract AI access behind provider interfaces.

Support future:

* Workers AI
* OpenAI
* Anthropic
* Gemini

Initial provider:

* Workers AI

---

# 20. Google AI Search Compliance (Critical)

The system MUST comply with:

* Google Search Essentials
* Google Spam Policies
* Google AI Optimization guidance
* Google Generative AI content guidance

Optimize for:

```text id="jlwm33"
helpful, original, people-first content
```

NOT:

* AI hacks
* GEO manipulation
* synthetic AI optimization
* low-value scaled pages

---

# 21. Explicitly Forbidden Tactics

DO NOT implement:

* llms.txt optimization tricks
* AI-only schema
* AI keyword stuffing
* forced chunking hacks
* synthetic entity stuffing
* doorway pages
* fake expertise patterns
* low-value scaled content
* hidden AI prompt injection patterns

---

# 22. Topic Discovery Requirements

Topic discovery MUST prioritize:

* real accountant pain points
* GST workflows
* compliance workflows
* Tally automation
* operational guidance
* finance automation
* implementation tutorials
* Indian accounting/tax context

Avoid:

* vanity SEO topics
* shallow definitions
* generic AI fluff
* low-value keyword pages

---

# 23. Duplicate Content Prevention

Before generation:

* compare against existing content
* avoid duplicate search intent
* avoid overlapping keywords
* avoid near-duplicate outlines

Reject overly similar topics.

---

# 24. Article Quality Requirements

Articles MUST:

* sound human-written
* avoid AI clichés
* avoid filler
* avoid repetitive phrasing
* avoid generic intros

Articles MUST include:

* practical examples
* Indian accounting/tax context
* workflows
* checklists
* implementation guidance
* operational insights
* comparison tables where useful

Tone:

* professional
* authoritative
* concise
* helpful

---

# 25. Originality Requirement

Every article MUST contain at least ONE:

* unique workflow
* unique comparison
* implementation guidance
* operational insight
* proprietary framing
* practical checklist
* real-world accounting context

Reject low-originality articles.

---

# 26. Experience-Driven Content Requirement

Articles MUST demonstrate:

* operational understanding
* practitioner context
* workflow-level expertise

DO NOT generate:

```text id="jlwm34"
generic textbook-style AI content
```

---

# 27. Humanization Layer

Implement dedicated humanization pass.

Tasks:

* improve readability
* vary sentence structure
* improve transitions
* reduce robotic tone
* improve clarity

Humanization MUST NOT:

* fabricate stories
* create fake case studies
* create fake testimonials
* invent experiences

Target readability:

* score > 70

---

# 28. SEO & AI Overview Optimization

Optimize naturally for:

* semantic SEO
* AI Overviews
* conversational search
* featured snippets

Generate:

* FAQ sections
* concise answer blocks
* scannable structure
* strong heading hierarchy

DO NOT:

* artificially rewrite for AI
* force unnatural chunking
* over-optimize for GEO

---

# 29. Structured Data Rules

Use only valid schema:

* FAQ schema
* Article schema
* Breadcrumb schema

Schema MUST match visible content.

DO NOT:

* invent AI-specific schema
* overuse structured data

---

# 30. Technical SEO Requirements

Prioritize:

* crawlability
* semantic HTML
* accessibility
* proper canonicalization
* sitemap inclusion
* valid rendering
* proper internal linking

---

# 31. Multimedia Requirements

Illustrations MUST:

* improve comprehension
* explain workflows/processes
* visually support content

NOT:

* decorative AI art
* unrelated graphics

Generate:

* diagrams
* process flows
* comparison visuals
* workflow illustrations
* checklists/tables

---

# 32. Illustration Generation

Use installed:

```text id="jlwm35"
ui-ux-pro-max
```

skill.

Illustrations MUST:

* match existing design system
* match Accountic branding
* follow existing visual language
* use lightweight SVG-first assets

Fallback:

* reusable branded templates

Illustration failures MUST NOT block publishing.

---

# 33. Content Scoring System

Before publishing, articles MUST pass:

| Check                | Requirement     |
| -------------------- | --------------- |
| Originality score    | required        |
| Readability score    | >70             |
| Duplicate similarity | below threshold |
| Semantic usefulness  | required        |
| Practicality score   | required        |
| SEO validation       | required        |
| Schema validation    | required        |
| Build validation     | required        |

Reject failing articles.

---

# 34. Prompt System

Prompts MUST:

* be modular
* versioned
* editable at runtime
* testable

Store prompts in:

* D1 or KV

Track per article:

* prompt version
* model used
* generation timestamp
* pipeline version

---

# 35. Astro Integration

DO NOT assume Astro structure.

Dynamically inspect:

* content collections
* schemas
* MDX strategy
* routing conventions

Generated content MUST follow existing schema contracts exactly.

---

# 36. Frontmatter Safety

Before publishing:

* validate frontmatter
* validate schema
* validate markdown
* validate slugs
* validate imports/components

Never publish build-breaking content.

---

# 37. Build Validation

Before GitHub commit:

* run Astro validation
* run TypeScript checks
* run markdown validation
* run schema validation
* run production build

Never commit content that breaks builds.

---

# 38. GitHub Publishing

Publisher MUST:

* generate MDX
* generate asset references
* commit via GitHub API
* trigger existing deployment pipeline

Support:

* retries
* rate limits
* dry-run mode
* rollback metadata

Store:

* commit SHAs
* snapshots
* generation metadata

---

# 39. Refresh System

Refresh content intelligently.

Goals:

* improve usefulness
* update regulations
* improve examples
* improve clarity
* improve SEO naturally

DO NOT:

* mechanically rewrite content
* artificially rotate keywords

---

# 40. Internal Linking

Generate:

* 3–5 contextual internal links/article

Purpose:

* user navigation
* topical clarity
* crawlability

NOT:

* AI manipulation

---

# 41. Admin Dashboard Requirement

Create native admin pages integrated into the existing app.

Reuse:

* existing auth system
* layouts
* components
* tables
* modals
* design tokens

DO NOT create isolated admin apps unless architecture already requires it.

---

# 42. Admin Features

Required:

* article management
* category management
* tag management
* queue monitoring
* failed job replay
* prompt management
* settings management
* article regeneration
* illustration regeneration
* generation logs
* content preview

---

# 43. Admin Authorization

Support RBAC:

* admin
* editor
* viewer

Reuse existing auth if present.

If absent:

* create minimal secure auth

---

# 44. Admin Settings

Configurable:

* articles/day
* refresh interval
* AI model
* prompt overrides
* auto-publish toggle
* scheduling windows
* GitHub branch
* dry-run mode
* generation quotas

---

# 45. Observability

Implement structured telemetry.

Track:

* generation duration
* retries
* failures
* queue latency
* token usage
* model usage
* publish history
* refresh history

Use:

* Analytics Engine

---

# 46. Budget Controls

Implement:

* daily token caps
* retry caps
* article size limits
* timeout limits

Admin configurable.

---

# 47. Local Development

Support:

* wrangler dev
* local D1
* local queues
* mock AI providers

---

# 48. Security Requirements

Implement:

* markdown sanitization
* slug sanitization
* queue payload validation
* prompt injection protection
* safe GitHub publishing

---

# 49. Testing Requirements

Generate:

* unit tests
* queue tests
* markdown validation tests
* GitHub publishing tests
* admin route tests
* schema validation tests

---

# 50. Database Requirements

Use migration-based schema management.

Migrations MUST be:

* versioned
* reversible
* environment-safe

---

# 51. Rollback Requirements

Support rollback.

Store:

* markdown snapshots
* generated assets
* commit SHAs
* generation metadata

Use R2 for backups.

---

# 52. Performance Requirements

Workers MUST:

* remain stateless
* minimize cold starts
* avoid memory-heavy operations
* stream generation where possible

---

# 53. Required CLI Commands

Provide:

```bash id="jlwm36"
npm run blog:provision
npm run blog:deploy
npm run blog:seed
npm run blog:test
npm run blog:generate
npm run blog:refresh
```

All MUST use Wrangler internally.

---

# 54. Required Deliverables

Generate:

* wrangler configs
* provisioning scripts
* workers
* queues
* D1 setup
* KV setup
* R2 setup
* cron setup
* admin dashboard
* prompts
* MDX generation
* validation systems
* tests
* documentation

Required documentation:

* architecture.md
* deployment.md
* local-development.md
* troubleshooting.md

---

# 55. Future Extensibility

Architecture MUST support future:

* RAG
* multilingual generation
* social distribution
* newsletter generation
* citation engines
* human review workflows
* AI video generation

without major refactors.

---

# 56. Deployment Philosophy

This project is NOT:

```text id="jlwm37"
build a new blogging platform
```

This project IS:

```text id="jlwm38"
safely evolve the existing Accountic platform with a native AI blogging subsystem
```

---

# 57. Definition Of Done

Implementation is complete only when:

* fully deployable via Wrangler CLI
* production deployment stable
* 2 articles/day publish automatically
* refresh jobs execute successfully
* admin dashboard fully operational
* generated content complies with Google AI guidance
* generated content is genuinely useful and original
* no build-breaking content can publish
* retries and DLQs functional
* GitHub publishing reliable
* Astro builds pass automatically
* rollback works
* all tests pass
* documentation complete
* system survives retries/idempotency scenarios
* implementation integrates cleanly into the existing Accountic architecture.
