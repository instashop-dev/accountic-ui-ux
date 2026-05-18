## ADDED Requirements

### Requirement: frontmatter.ts parses and serializes blog post frontmatter
`src/lib/frontmatter.ts` SHALL export a `parseFrontmatter(raw: string)` function that splits a markdown string into `{ data: Record<string, unknown>, content: string }` and a `serializeFrontmatter(data: Record<string, unknown>, content: string): string` function that produces a valid YAML-fenced markdown string. Neither function SHALL import from `astro:*` namespaces.

#### Scenario: parseFrontmatter splits YAML and body
- **WHEN** `parseFrontmatter` is called with a string containing a `---`-fenced YAML block followed by markdown body
- **THEN** it returns `data` containing the parsed YAML keys and `content` containing the body text without the fence

#### Scenario: parseFrontmatter handles missing frontmatter
- **WHEN** `parseFrontmatter` is called with a plain markdown string (no `---` fence)
- **THEN** it returns `data: {}` and `content` equal to the full input string

#### Scenario: serializeFrontmatter round-trips cleanly
- **WHEN** `serializeFrontmatter(data, content)` is called and its output is passed back to `parseFrontmatter`
- **THEN** the returned `data` deeply equals the original `data` object

### Requirement: slug.ts generates deterministic kebab-case slugs
`src/lib/slug.ts` SHALL export a `toSlug(title: string): string` function that lowercases the input, replaces non-alphanumeric characters with hyphens, collapses consecutive hyphens, strips leading/trailing hyphens, and truncates to 60 characters. The function SHALL be pure (same input always produces same output) and SHALL NOT import from `astro:*` namespaces.

#### Scenario: Basic slug generation
- **WHEN** `toSlug('Five Failure Modes of AI-Drafted Replies')` is called
- **THEN** it returns `'five-failure-modes-of-ai-drafted-replies'`

#### Scenario: Slug truncates at 60 characters
- **WHEN** `toSlug` is called with a title that would produce a slug longer than 60 characters
- **THEN** the returned slug is at most 60 characters long and does not end with a hyphen

#### Scenario: Special characters are replaced
- **WHEN** `toSlug` is called with a title containing `&`, `:`, `?`, `%`, or unicode characters
- **THEN** each such character is replaced with a hyphen and consecutive hyphens are collapsed to one

### Requirement: schema-validate.ts exports a runtime Zod validator for blog post frontmatter
`src/lib/schema-validate.ts` SHALL export a `validatePostFrontmatter(data: unknown): { success: true; data: PostData } | { success: false; errors: string[] }` function that validates the input against the same Zod schema used by `src/content.config.ts`, returning a discriminated union. It SHALL import the enum values from `src/content.config.ts` (or `src/blog-meta.ts`) rather than re-declaring them. It SHALL NOT import from `astro:*` namespaces.

#### Scenario: Valid frontmatter returns success
- **WHEN** `validatePostFrontmatter` is called with an object containing all required fields and valid enum values
- **THEN** it returns `{ success: true, data: <parsed object> }`

#### Scenario: Invalid frontmatter returns error list
- **WHEN** `validatePostFrontmatter` is called with an object missing `title` and containing an invalid `pillar`
- **THEN** it returns `{ success: false, errors: [<array with two or more error strings>] }`

#### Scenario: Enum values are sourced from canonical definitions
- **WHEN** a new pillar is added to `src/blog-meta.ts` PILLARS array
- **THEN** `validatePostFrontmatter` accepts the new pillar value without any change to `schema-validate.ts`
