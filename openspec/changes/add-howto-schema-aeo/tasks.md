## 1. HowTo schema function — `src/lib/seo-schema.ts`

- [x] 1.1 Add `generateHowToSchema(content: string, title: string, description: string): string | null` export signature to `src/lib/seo-schema.ts`
- [x] 1.2 Implement step extractor: scan body for lines matching `^\s*(\d+)\.\s+(.+)` and collect sequential runs of 3+ incrementing numbers
- [x] 1.3 For each step line, strip leading `N. ` and markdown bold markers (`**...**`) to produce clean step text
- [x] 1.4 Build `HowToStep` array: each entry `{ "@type": "HowToStep", "name": text.slice(0, 60), "text": text }`
- [x] 1.5 Return full `HowTo` JSON-LD object: `{ "@context": "https://schema.org", "@type": "HowTo", "name": title, "description": description, "step": steps }`
- [x] 1.6 Return `null` if fewer than 3 sequential steps are detected

## 2. Publisher — HowTo injection + double-injection guard

- [x] 2.1 In `src/workers/pipeline/publisher.ts`, locate the schema injection block (the section that builds the JSON-LD array)
- [x] 2.2 Add pre-append guard: `if (mdxContent.includes('<script type="application/ld+json">')) { /* skip */ }` wrapping the entire injection block
- [x] 2.3 Import `generateHowToSchema` from `src/lib/seo-schema.ts`
- [x] 2.4 Call `generateHowToSchema(content, frontmatter.title, frontmatter.description)` alongside the existing three schema calls
- [x] 2.5 Include the HowTo result in the `schemas.filter(Boolean)` array (same pattern as FAQ's null check)

## 3. Verification

- [x] 3.1 Write a quick smoke test: call `generateHowToSchema` with a 7-step numbered body, assert result is non-null and `JSON.parse()` succeeds
- [x] 3.2 Call `generateHowToSchema` with a 2-step body, assert it returns `null`
- [x] 3.3 Call `generateHowToSchema` with body containing `**bold step name** — detail`, confirm `name` contains no `**` markers
- [x] 3.4 Run the publisher path against a mock draft that already contains `<script type="application/ld+json">` and confirm no second block is appended
- [x] 3.5 Run `npm run build` (or equivalent type check) and confirm no TypeScript errors in `seo-schema.ts` or `publisher.ts`
