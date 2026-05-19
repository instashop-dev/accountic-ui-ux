-- TEST FIXTURES ONLY — DO NOT RUN IN PRODUCTION
-- This file seeds deterministic test data for Vitest integration tests.
-- It is intentionally excluded from all package.json db:migrate scripts.
-- Never run: wrangler d1 execute BLOG_DB --file=migrations/005_test-fixtures.sql

-- ── settings overrides for tests ────────────────────────────────────────────
INSERT OR IGNORE INTO settings (key, value) VALUES ('generation_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('humanizer_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('humanizer_temperature', '0.3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('humanizer_similarity_threshold', '0.70');
INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_token_cap', '200000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tokens_used_today', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('quality_threshold', '0.8');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_publish', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('pipeline_emergency_stop', 'false');

-- ── prompts ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'test-prompt-article-v1',
  'article-generation',
  99,
  'Test system prompt for article generation.',
  'Write an article for outline: {{outline_json}} targeting {{read_time}} min read.',
  1
);

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'test-prompt-humanizer-v1',
  'humanizer',
  99,
  'You are a prose editor. Improve readability without changing facts.',
  'Improve this article: {{content}}',
  1
);

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'test-prompt-topic-v1',
  'topic-discovery',
  99,
  'You are a content strategist.',
  'Generate {{count}} topic ideas. Return JSON array: [{"title":"...","pillar":"...","rationale":"..."}]',
  1
);

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'test-prompt-outline-v1',
  'outline-generation',
  99,
  'You are a content architect.',
  'Create outline for: {{title}} ({{pillar}}). Rationale: {{rationale}}. Return JSON object.',
  1
);

-- ── posts (for internal linker tests) ────────────────────────────────────────
INSERT OR IGNORE INTO posts (id, slug, title, description, pillar, tone, author, pub_date, read_time, source, status)
VALUES (
  'post-gst-001',
  'gst-itc-claim-procedure',
  'How to Claim ITC Under GST: Step-by-Step Procedure',
  'A complete guide to claiming Input Tax Credit under GST for Indian CAs.',
  'Income Tax Notices',
  'emerald',
  'Accountic Team',
  '2025-03-01',
  8,
  'ai',
  'published'
);

INSERT OR IGNORE INTO posts (id, slug, title, description, pillar, tone, author, pub_date, read_time, source, status)
VALUES (
  'post-tds-002',
  'tds-194c-contractor-deduction',
  'TDS on Contractor Payments under Section 194C: Complete Guide',
  'Understand TDS obligations for contractors and professionals under Section 194C.',
  'Faceless Assessment',
  'amber',
  'Accountic Team',
  '2025-04-15',
  6,
  'ai',
  'published'
);

INSERT OR IGNORE INTO posts (id, slug, title, description, pillar, tone, author, pub_date, read_time, source, status)
VALUES (
  'post-itr-003',
  'itr-filing-ay-2024-25',
  'ITR Filing for AY 2024-25: Deadlines, Forms, and Common Errors',
  'Complete guide to ITR filing for Assessment Year 2024-25 with deadline tracker.',
  'Income Tax Notices',
  'rose',
  'Accountic Team',
  '2025-05-10',
  7,
  'ai',
  'published'
);

-- ── topics ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO topics (id, title, pillar, rationale, status)
VALUES (
  'topic-test-001',
  'GST Input Tax Credit Reversal on Capital Goods',
  'Income Tax Notices',
  'Many CAs get ITC reversal notices on capital goods depreciation adjustments.',
  'pending'
);

-- ── outlines ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO outlines (id, topic_id, outline_json)
VALUES (
  'outline-test-001',
  'topic-test-001',
  '{"title":"GST ITC Reversal on Capital Goods","description":"How to handle ITC reversal notices for capital goods under GST Rule 43","sections":[{"heading":"What is ITC Reversal","summary":"Overview of when ITC must be reversed","key_points":["Capital goods used for exempt supplies","Partial reversal formula"]}],"tone":"emerald","estimated_read_time":7}'
);

-- ── drafts ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO drafts (id, outline_id, slug, content, frontmatter_json, status, quality_report_json)
VALUES (
  'draft-ready-001',
  'outline-test-001',
  'gst-itc-reversal-capital-goods',
  '---
title: GST ITC Reversal on Capital Goods
description: How to handle ITC reversal notices for capital goods under GST Rule 43
pubDate: 2025-05-01
pillar: Income Tax Notices
author: Accountic Team
readTime: 7
tone: emerald
featured: false
---

## What is ITC Reversal Under GST

When a taxpayer uses capital goods for both taxable and exempt supplies, they must reverse a portion of the Input Tax Credit (ITC) claimed under GST Rule 43. The GSTIN holder must calculate the reversal proportionately.

## How to Calculate ITC Reversal for Capital Goods

1. Identify all capital goods on which CGST and SGST credit was claimed
2. Apply the GST Rule 43 formula: Reversal = (ITC × Exempt Turnover) / Total Turnover
3. File the reversal in GSTR-3B under Table 4(B)

| Category | ITC Claimed | Reversal Rate | Amount Reversed |
|---|---|---|---|
| Plant & Machinery | ₹1,00,000 | 40% | ₹40,000 |
| Office Equipment | ₹50,000 | 20% | ₹10,000 |
| Vehicles | ₹80,000 | 60% | ₹48,000 |

## Section 17(2) and Section 17(5) Restrictions

Under Section 17(2) of the CGST Act, ITC is not available for goods or services used for exempt supplies. Section 17(5) blocks ITC on motor vehicles used for personal purposes.

Example: A CA firm with GSTIN 27ABCDE1234F1Z5 handling both taxable audit services (₹30,00,000) and exempt educational services (₹10,00,000) must reverse ITC proportionately.

## FAQ

### What triggers an ITC reversal notice from GST department?

A notice under Section 73 or Section 74 of the CGST Act is issued when the GST department identifies that a taxpayer claimed excess ITC. This commonly occurs when capital goods are used for exempt supplies without proper reversal.

### Is ITC reversal required for every financial year?

Yes. Under Rule 43, the ITC reversal calculation for capital goods must be done annually at the end of each financial year and adjusted in GSTR-3B for the month of March or September (for annual returns).

### How does Section 16(4) affect ITC claims?

Section 16(4) of the CGST Act restricts ITC claims to within the due date of filing GSTR-3B for September of the following year. Any ITC not claimed within this period is permanently lapsed.',
  '{"title":"GST ITC Reversal on Capital Goods","description":"How to handle ITC reversal notices for capital goods under GST Rule 43","pubDate":"2025-05-01","pillar":"Income Tax Notices","author":"Accountic Team","readTime":7,"tone":"emerald","featured":false}',
  'ready',
  '{"passed":true,"scores":{"readability":72.5,"originality":true,"schemaValid":true},"errors":[]}'
);

INSERT OR IGNORE INTO drafts (id, outline_id, slug, content, frontmatter_json, status, quality_report_json)
VALUES (
  'draft-approved-001',
  'outline-test-001',
  'tds-section-194c-contractors',
  '---
title: TDS on Contractor Payments Under Section 194C
description: Complete guide to deducting TDS on contractor and sub-contractor payments
pubDate: 2025-05-02
pillar: Faceless Assessment
author: Accountic Team
readTime: 6
tone: amber
featured: false
---

## TDS Obligations Under Section 194C

Section 194C of the Income Tax Act mandates TDS deduction on payments to contractors and sub-contractors. The deductee must have a valid PAN (e.g. ABCDE1234F) for the lower TDS rate.

## Threshold Limits

1. Single payment threshold: ₹30,000
2. Aggregate payment threshold in a financial year: ₹1,00,000
3. If PAN not provided by contractor, TDS rate increases to 20%

Case study: M/s ABC Constructions (TAN: MUMC12345E) contracted work worth ₹5,00,000 to a sub-contractor. Since the aggregate exceeds ₹1,00,000, TDS at 1% (for company contractors) must be deducted.

## Section 194C Rate Chart

| Contractor Type | TDS Rate | PAN Required |
|---|---|---|
| Individual/HUF | 1% | Yes |
| Company/Firm | 2% | Yes |
| No PAN furnished | 20% | No |',
  '{"title":"TDS on Contractor Payments Under Section 194C","description":"Complete guide to deducting TDS on contractor and sub-contractor payments","pubDate":"2025-05-02","pillar":"Faceless Assessment","author":"Accountic Team","readTime":6,"tone":"amber","featured":false}',
  'approved',
  '{"passed":true,"scores":{"readability":74.0,"originality":true,"schemaValid":true},"errors":[]}'
);

INSERT OR IGNORE INTO drafts (id, outline_id, slug, content, frontmatter_json, status, quality_report_json)
VALUES (
  'draft-humanized-001',
  'outline-test-001',
  'itr-filing-ay-2024-25-guide',
  '---
title: ITR Filing for AY 2024-25: What Every CA Needs to Know
description: Comprehensive guide to ITR filing deadlines and procedures for Assessment Year 2024-25
pubDate: 2025-05-03
pillar: Income Tax Notices
author: Accountic Team
readTime: 7
tone: rose
featured: false
---

## Key Deadlines for AY 2024-25

The due date for filing ITR under Section 139(1) for AY 2024-25 is 31 July 2024. Late filing attracts penalty under Section 234F.

1. File ITR-1 or ITR-2 by 31 July 2024 to avoid late fees
2. Belated return under Section 139(4) can be filed up to 31 December 2024
3. Revised return under Section 139(5) allowed until 31 December 2024

Case study: A CA in Mumbai received a notice u/s 143(1) for AY 2024-25 due to mismatch between TDS as per Form 26AS and ITR filed. The notice required reconciliation of ₹45,000 excess TDS claimed.',
  '{"title":"ITR Filing for AY 2024-25: What Every CA Needs to Know","description":"Comprehensive guide to ITR filing deadlines and procedures for Assessment Year 2024-25","pubDate":"2025-05-03","pillar":"Income Tax Notices","author":"Accountic Team","readTime":7,"tone":"rose","featured":false}',
  'humanized',
  '{"passed":true,"scores":{"readability":75.2,"originality":true,"schemaValid":true},"errors":[]}'
);
