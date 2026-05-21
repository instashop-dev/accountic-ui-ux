## ADDED Requirements

### Requirement: Detect script reads all published blog posts
`scripts/detect-similar-posts.ts` SHALL read every `.md` and `.mdx` file under `src/content/blog/`, parse frontmatter via `parseFrontmatter()` from `src/lib/frontmatter.ts`, and extract the body text (content after the frontmatter fence) for each post.

#### Scenario: All posts loaded
- **WHEN** `npx tsx scripts/detect-similar-posts.ts` is executed
- **THEN** the script loads every file matching `src/content/blog/**/*.{md,mdx}` and reports the total count at startup

#### Scenario: Frontmatter excluded from similarity computation
- **WHEN** similarity is computed between two posts
- **THEN** only the body text (after the closing `---` fence) is used; YAML frontmatter fields are not included in the bigram computation

### Requirement: Detect script computes pairwise bigram-Jaccard similarity
The script SHALL compute bigram-Jaccard similarity between every unique pair of posts using the existing `computeBigramJaccard()` function from `src/lib/regression.ts` and collect all pairs whose score meets or exceeds the threshold.

#### Scenario: Default threshold applied
- **WHEN** `--threshold` flag is omitted
- **THEN** the script uses a default Jaccard threshold of `0.55`

#### Scenario: Custom threshold accepted
- **WHEN** `--threshold 0.7` is passed
- **THEN** only pairs with Jaccard ≥ 0.70 are included in the report

#### Scenario: Self-comparison excluded
- **WHEN** similarity is computed across the corpus
- **THEN** no post is compared against itself

### Requirement: Detect script outputs a ranked similarity report
The script SHALL write a Markdown report (`similar-posts-report.md`) and a JSON sidecar (`similar-posts-report.json`) at the project root, sorted by Jaccard score descending.

#### Scenario: Markdown report lists similar pairs
- **WHEN** the script finds pairs above the threshold
- **THEN** `similar-posts-report.md` contains one section per pair with: slug A, slug B, Jaccard score, title A, title B, and pub dates

#### Scenario: JSON report machine-readable
- **WHEN** `similar-posts-report.json` is written
- **THEN** it contains an array of objects with fields `slugA`, `slugB`, `score`, `titleA`, `titleB`, `pubDateA`, `pubDateB`

#### Scenario: No similar pairs found
- **WHEN** no pairs exceed the threshold
- **THEN** the script exits 0 and prints "No similar pairs found above threshold X.XX"

### Requirement: Detect script supports dry-run and verbose modes
The script SHALL support `--verbose` for per-pair progress logging and SHALL NOT modify any files regardless of flags.

#### Scenario: Verbose mode logs each comparison
- **WHEN** `--verbose` is passed
- **THEN** each pair comparison is logged with slugs and computed score

#### Scenario: Script never modifies files
- **WHEN** the script completes under any flags
- **THEN** no files in `src/content/blog/` are created, modified, or deleted
