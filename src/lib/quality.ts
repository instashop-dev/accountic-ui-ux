import { validatePostFrontmatter } from './schema-validate';

export interface QualityReport {
  passed: boolean;
  scores: {
    readability: number;
    originality: boolean;
    schemaValid: boolean;
  };
  errors: string[];
}

// Indian tax law content is inherently dense (long sentences, complex vocabulary).
// Flesch-Kincaid scores for legal/technical content typically range 0–40.
// A threshold of 70 (general audience) is inappropriate for this domain.
const READABILITY_THRESHOLD = 20;

export function scoreArticle(
  content: string,
  frontmatter: Record<string, unknown>,
): QualityReport {
  const errors: string[] = [];

  const body = stripFrontmatterAndCodeBlocks(content);
  const readability = fleschReadingEase(body);
  const originality = hasOriginalityMarker(body);
  const schemaResult = validatePostFrontmatter(frontmatter);
  const schemaValid = schemaResult.success;

  if (readability < READABILITY_THRESHOLD) {
    errors.push(
      `Readability score ${readability.toFixed(1)} is below threshold ${READABILITY_THRESHOLD}`,
    );
  }
  if (!originality) {
    errors.push(
      'No originality marker found: article needs a numbered workflow (3+ steps), comparison table (3+ rows), concrete Indian tax example, or named case study',
    );
  }
  if (!schemaValid && !schemaResult.success) {
    errors.push(...schemaResult.errors);
  }

  return {
    passed: errors.length === 0,
    scores: { readability, originality, schemaValid },
    errors,
  };
}

// ── Flesch Reading Ease ───────────────────────────────────────────────────────

function fleschReadingEase(text: string): number {
  const sentences = countSentences(text);
  const words = countWords(text);
  const syllables = countSyllables(text);

  if (sentences === 0 || words === 0) return 0;

  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, score));
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return Math.max(1, matches ? matches.length : 1);
}

function countWords(text: string): number {
  const matches = text.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

function countSyllables(text: string): number {
  const words = text.match(/\b[a-zA-Z]+\b/g) ?? [];
  return words.reduce((total, word) => total + syllablesInWord(word), 0);
}

function syllablesInWord(word: string): number {
  const w = word.toLowerCase();
  if (w.length <= 3) return 1;

  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

// ── Originality markers ───────────────────────────────────────────────────────

function hasOriginalityMarker(text: string): boolean {
  return (
    hasNumberedWorkflow(text) ||
    hasComparisonTable(text) ||
    hasIndianTaxExample(text) ||
    hasNamedCaseStudy(text)
  );
}

function hasNumberedWorkflow(text: string): boolean {
  // Look for 3+ consecutive numbered list items (e.g. "1. ", "2. ", "3. ")
  const items = text.match(/^\s*\d+\.\s+.+/gm) ?? [];
  if (items.length < 3) return false;

  // Check they are sequential (within the same section)
  let maxConsecutive = 0;
  let consecutive = 1;
  for (let i = 1; i < items.length; i++) {
    const prev = parseInt(items[i - 1].match(/(\d+)/)?.[1] ?? '0', 10);
    const curr = parseInt(items[i].match(/(\d+)/)?.[1] ?? '0', 10);
    if (curr === prev + 1) {
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 1;
    }
  }
  return Math.max(maxConsecutive, items.length >= 3 ? 3 : 0) >= 3;
}

function hasComparisonTable(text: string): boolean {
  // Markdown table rows: lines with | ... | pattern
  const tableRows = text.match(/^\|.+\|/gm) ?? [];
  // Need at least 3 data rows (header + separator + 1 data = minimum, but spec says 3 rows)
  return tableRows.length >= 3;
}

function hasIndianTaxExample(text: string): boolean {
  // Concrete Indian tax context: PAN format, Assessment Year, or section reference with a value
  const panPattern = /[A-Z]{5}\d{4}[A-Z]/;
  const ayPattern = /(?:AY|Assessment Year)\s*\d{4}[-–]\d{2,4}/i;
  const sectionWithValue = /(?:section|sec\.?|u\/s)\s*\d+[A-Za-z()]{0,6}\s*(?:of the|,)?\s*(?:Income[\s-]?Tax Act|ITA)?/i;
  const rupeeFigure = /₹\s*[\d,]+(?:\.\d+)?(?:\s*(?:lakh|crore|lakhs|crores))?/i;

  return (
    panPattern.test(text) ||
    ayPattern.test(text) ||
    (sectionWithValue.test(text) && rupeeFigure.test(text))
  );
}

function hasNamedCaseStudy(text: string): boolean {
  // Named case study or practitioner scenario signals
  const caseStudyPattern = /(?:case study|case scenario|example:|scenario:|practitioner note|firm scenario|client scenario)/i;
  const courtCasePattern = /\bvs?\.\s+[A-Z][a-z]+|\b(?:HC|SC|ITAT|CIT)\b.*\b\d{4}\b/;
  return caseStudyPattern.test(text) || courtCasePattern.test(text);
}

// ── Preprocessing ─────────────────────────────────────────────────────────────

function stripFrontmatterAndCodeBlocks(raw: string): string {
  // Strip YAML frontmatter
  let text = raw.replace(/^---[\s\S]*?---\n?/, '');

  // Strip fenced code blocks (``` or ~~~)
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/~~~[\s\S]*?~~~/g, '');

  // Strip inline code
  text = text.replace(/`[^`]+`/g, '');

  // Strip markdown links/images
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  text = text.replace(/\[[^\]]*\]\([^)]*\)/g, '');

  // Strip heading markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  return text.trim();
}
