export type FailedGate = 'similarity' | 'heading' | 'compliance_entity' | 'placeholder_missing';

export interface RegressionResult {
  passed: boolean;
  failed_gate: FailedGate | null;
}

// ── Text normalisation ────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\n?/, '') // frontmatter
    .replace(/```[\s\S]*?```/g, '') // code fences
    .replace(/`[^`]+`/g, '') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, '') // links
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/[*_~]/g, '') // emphasis
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .toLowerCase();
}

// ── Gate 1: Bigram Jaccard similarity ────────────────────────────────────────

function tokenize(text: string): string[] {
  return stripMarkdown(text).match(/\b[a-z0-9₹]+\b/g) ?? [];
}

function buildBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}|${tokens[i + 1]}`);
  }
  return bigrams;
}

export function computeBigramJaccard(a: string, b: string): number {
  const bigramsA = buildBigrams(tokenize(a));
  const bigramsB = buildBigrams(tokenize(b));

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  const union = bigramsA.size + bigramsB.size - intersection;
  return intersection / union;
}

// ── Gate 2: Heading structure ─────────────────────────────────────────────────

export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (match) headings.push(match[2].trim());
  }
  return headings;
}

function headingsMissing(original: string, humanized: string): boolean {
  const origHeadings = extractHeadings(original);
  const humHeadings = new Set(extractHeadings(humanized).map((h) => h.toLowerCase()));
  return origHeadings.some((h) => !humHeadings.has(h.toLowerCase()));
}

// ── Gate 3: Compliance entity preservation ───────────────────────────────────

const COMPLIANCE_KEYWORDS = [
  'GST', 'CGST', 'SGST', 'IGST', 'TDS', 'TCS', 'ITR', 'PAN', 'TAN',
  'GSTIN', 'RCM', 'QRMP',
];

const SECTION_PATTERN = /[Ss]ection\s+\d+[A-Z]?(?:\(\d+\))?|u\/s\s+\d+/;
const SECTION_PATTERN_G = /[Ss]ection\s+\d+[A-Z]?(?:\(\d+\))?|u\/s\s+\d+/g;

function normaliseNumeric(s: string): string {
  // Strip currency symbols, commas, spaces between digits, common suffixes for comparison
  return s.replace(/[₹,\s]/g, '').replace(/(?:lakh|crore|lakhs|crores)/gi, '');
}

function extractAllNumerics(text: string): Set<string> {
  const raw = text.match(/(?:₹\s*)?[\d,]+(?:\.\d+)?(?:\s*(?:lakh|crore|lakhs|crores))?/gi) ?? [];
  return new Set(raw.map(normaliseNumeric).filter((n) => /\d/.test(n)));
}

export function extractComplianceEntities(content: string): Set<string> {
  const entities = new Set<string>();

  for (const kw of COMPLIANCE_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(content)) entities.add(kw);
  }

  const sections = content.match(SECTION_PATTERN_G) ?? [];
  for (const s of sections) entities.add(s.trim());

  for (const n of extractAllNumerics(content)) entities.add(n);

  return entities;
}

function entitiesMissing(original: string, humanized: string): boolean {
  const origEntities = extractComplianceEntities(original);
  const humText = humanized;
  for (const entity of origEntities) {
    // For keywords and section refs: exact substring match
    if (COMPLIANCE_KEYWORDS.includes(entity) || SECTION_PATTERN.test(entity)) {
      if (!humText.includes(entity)) return true;
    } else {
      // Numeric entity: check normalised form appears in humanized numerics
      const humNumerics = extractAllNumerics(humText);
      if (!humNumerics.has(entity)) return true;
    }
  }
  return false;
}

// ── Fabricated numeric detection ─────────────────────────────────────────────

export function checkNewNumerics(original: string, humanized: string): boolean {
  const origNumerics = extractAllNumerics(original);
  const humNumerics = extractAllNumerics(humanized);
  for (const n of humNumerics) {
    if (!origNumerics.has(n)) return true;
  }
  return false;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function detectRegression(
  original: string,
  humanized: string,
  threshold: number,
): RegressionResult {
  const similarity = computeBigramJaccard(original, humanized);
  if (similarity < threshold) {
    return { passed: false, failed_gate: 'similarity' };
  }

  if (headingsMissing(original, humanized)) {
    return { passed: false, failed_gate: 'heading' };
  }

  if (entitiesMissing(original, humanized)) {
    return { passed: false, failed_gate: 'compliance_entity' };
  }

  return { passed: true, failed_gate: null };
}
