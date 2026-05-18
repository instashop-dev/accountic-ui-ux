### Requirement: validate-post script accepts a file path and exits non-zero on invalid frontmatter
`scripts/validate-post.ts` SHALL accept a single CLI argument (path to a `.md` or `.mdx` file), parse its YAML frontmatter, validate it against the Zod schema from `src/content.config.ts`, print a structured error report to stderr on failure, and exit with code 1. On success it SHALL print a confirmation to stdout and exit with code 0.

#### Scenario: Valid post passes validation
- **WHEN** `npx tsx scripts/validate-post.ts src/content/blog/valid-post.md` is run against a post with valid frontmatter
- **THEN** the script exits with code 0 and prints a success message including the post slug

#### Scenario: Missing required field fails validation
- **WHEN** `scripts/validate-post.ts` is run against a post missing the `pillar` field
- **THEN** the script exits with code 1 and stderr includes the field name and a description of the violation

#### Scenario: Invalid enum value fails validation
- **WHEN** `scripts/validate-post.ts` is run against a post with `pillar: 'Unknown Pillar'`
- **THEN** the script exits with code 1 and stderr includes the invalid value and the list of valid enum members

#### Scenario: Missing file argument exits with usage error
- **WHEN** `scripts/validate-post.ts` is run with no arguments
- **THEN** the script exits with code 1 and stderr includes a usage hint

### Requirement: package.json script alias for validate-post
`package.json` SHALL include a `"blog:validate"` script that invokes `npx tsx scripts/validate-post.ts` so operators can run `npm run blog:validate <path>`.

#### Scenario: blog:validate script is callable
- **WHEN** `npm run blog:validate src/content/blog/any-post.md` is run
- **THEN** the `validate-post.ts` script is invoked with the file path argument
