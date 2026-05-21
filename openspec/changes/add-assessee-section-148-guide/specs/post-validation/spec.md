## MODIFIED Requirements

### Requirement: validate-post script accepts a file path and exits non-zero on invalid frontmatter
`scripts/validate-post.ts` SHALL accept a single CLI argument (path to a `.md` or `.mdx` file), parse its YAML frontmatter, validate it against the Zod schema from `src/content.config.ts`, print a structured error report to stderr on failure, and exit with code 1. On success it SHALL print a confirmation to stdout and exit with code 0. When a slug can be inferred from the file path (kebab-case filename without extension), the script SHALL also call `scoreArticle(content, frontmatter, slug)` and include quality check results in its output — exiting with code 1 if any quality check fails, including the new `audienceVoiceValid` check.

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

#### Scenario: Audience mismatch fails validation
- **WHEN** `scripts/validate-post.ts` is run against a post whose filename contains `for-assessees` but whose content uses CA-voice language
- **THEN** the script exits with code 1 and stderr includes an audience mismatch message
