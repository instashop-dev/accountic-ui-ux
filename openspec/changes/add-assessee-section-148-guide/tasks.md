## 1. Quality Gate — audience voice check

- [x] 1.1 Add `audienceVoiceValid: boolean` to the `QualityReport.scores` interface in `src/lib/quality.ts`
- [x] 1.2 Implement `detectAssesseeSlug(slug: string): boolean` helper — returns true if slug matches `for-assessees`, `taxpayer`, `what-to-do-when`, or `guide-for-individuals`
- [x] 1.3 Implement `hasAssesseeVoice(text: string): boolean` helper — returns true if body contains second-person possessive phrases near "notice" or "reply" (e.g., "your notice", "you received", "your reply")
- [x] 1.4 Update `scoreArticle(content, frontmatter, slug?)` signature to accept optional `slug` third argument
- [x] 1.5 Add audience gate logic: if `detectAssesseeSlug(slug)` is true and `hasAssesseeVoice(body)` is false, push audience mismatch error and set `audienceVoiceValid: false`
- [x] 1.6 Set `audienceVoiceValid: true` in all other cases (slug absent, no assessee signal, or voice check passes)

## 2. Pipeline worker — pass slug to scoreArticle

- [x] 2.1 In `src/workers/pipeline/article-generation.ts`, locate the existing `scoreArticle()` call
- [x] 2.2 Derive slug from the article topic title (kebab-case conversion, same logic used to generate the filename)
- [x] 2.3 Pass derived slug as third argument to `scoreArticle(content, frontmatter, slug)`

## 3. Validate-post script — include quality check output

- [x] 3.1 In `scripts/validate-post.ts` (or create it if absent), infer slug from the file path argument (filename without extension)
- [x] 3.2 After frontmatter validation passes, call `scoreArticle(content, frontmatter, slug)` and capture the `QualityReport`
- [x] 3.3 Print quality check results to stdout (readability score, originality, schemaValid, audienceVoiceValid)
- [x] 3.4 If `report.passed === false`, print all `report.errors` to stderr and exit with code 1

## 4. Article — write the assessee-facing MDX file

- [x] 4.1 Create `src/content/blog/section-148-notice-reply-step-by-step-guide-for-assessees.mdx` with valid frontmatter (`pillar: 'Income Tax Notices'`, `tone: 'emerald'`, `featured: false`, `readTime: 9`)
- [x] 4.2 Write introduction paragraph in assessee second-person voice — opens with a direct answer to "what do I do when I get this notice"
- [x] 4.3 Write 7-step numbered workflow (steps 1–7, sequential, second-person): acknowledge receipt → obtain recorded reasons → check procedural validity → reconcile escaped amount → draft grounds → prepare enclosures → file and follow up
- [x] 4.4 Include at least one concrete example with a rupee figure and assessment year (e.g., AY 2021-22, ₹14.7 lakh)
- [x] 4.5 Write `## FAQ` section with exactly 5 question-answer pairs in first-person assessee voice
- [x] 4.6 Add inline Markdown links to `section-148-reply-template`, `ai-drafted-section-148-reply-review`, and `lakhmani-mewal-das-s148`
- [x] 4.7 Verify all citations (148A framework, Finance Act 2021 amendments, ITO v. Lakhmani Mewal Das) against authoritative sources before writing
- [x] 4.8 Append `<script type="application/ld+json">` block at the end of the file with Article schema, FAQPage schema (from FAQ section), and Breadcrumb schema — formatted as a JSON array

## 5. Validation and final checks

- [x] 5.1 Run `npm run blog:validate src/content/blog/section-148-notice-reply-step-by-step-guide-for-assessees.mdx` — confirm exit code 0 and all quality checks pass
- [x] 5.2 Verify `audienceVoiceValid: true` appears in the validate-post output for the new article
- [x] 5.3 Run `npm run blog:validate src/content/blog/section-148-reply-template.md` — confirm existing CA-facing article still passes (no false positive from audience gate)
- [x] 5.4 Confirm JSON-LD block in the article is valid JSON (parse it manually or via `node -e`)
- [x] 5.5 Confirm the FAQ section has exactly 5+ Q&A pairs and all internal links resolve to existing files in `src/content/blog/`
