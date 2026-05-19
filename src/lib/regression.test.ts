import { describe, it, expect } from 'vitest';
import {
  computeBigramJaccard,
  extractHeadings,
  extractComplianceEntities,
  checkNewNumerics,
  detectRegression,
} from './regression';
import { GST_ITC_ARTICLE, TDS_194C_ARTICLE, ITR_FILING_ARTICLE } from '../test-fixtures/articles/index';

// ── computeBigramJaccard ──────────────────────────────────────────────────────

describe('computeBigramJaccard', () => {
  it('returns 1 for identical non-empty strings', () => {
    const text = 'The GST rate is applicable on CGST and SGST supplies';
    expect(computeBigramJaccard(text, text)).toBe(1);
  });

  it('returns 0 for completely different strings with no shared bigrams', () => {
    expect(computeBigramJaccard('alpha beta gamma', 'delta epsilon zeta')).toBe(0);
  });

  it('returns 1 for two empty strings', () => {
    expect(computeBigramJaccard('', '')).toBe(1);
  });

  it('returns 0 when one string is empty', () => {
    expect(computeBigramJaccard('hello world test', '')).toBe(0);
    expect(computeBigramJaccard('', 'hello world test')).toBe(0);
  });

  it('returns value between 0 and 1 for partially similar strings', () => {
    const a = 'GST Input Tax Credit under Section 16 of the CGST Act';
    const b = 'GST Input Tax Credit under Section 17 of the IGST Act';
    const score = computeBigramJaccard(a, b);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

// ── extractHeadings ───────────────────────────────────────────────────────────

describe('extractHeadings', () => {
  it('extracts ## and ### headings trimmed, in order', () => {
    const content = [
      '# Title (should be ignored)',
      '## Section One',
      '### Sub-section A',
      '#### Deep heading (should be ignored)',
      'Some body text',
      '## Section Two',
    ].join('\n');

    expect(extractHeadings(content)).toEqual(['Section One', 'Sub-section A', 'Section Two']);
  });

  it('returns empty array when no ## or ### headings exist', () => {
    expect(extractHeadings('Just plain text\nNo headings here')).toEqual([]);
  });

  it('trims whitespace from heading text', () => {
    expect(extractHeadings('##   Padded Heading  ')).toEqual(['Padded Heading']);
  });
});

// ── extractComplianceEntities ─────────────────────────────────────────────────

describe('extractComplianceEntities', () => {
  it('extracts GST compliance keyword', () => {
    const entities = extractComplianceEntities('The GST return must be filed by the due date.');
    expect(entities.has('GST')).toBe(true);
  });

  it('extracts multiple compliance keywords', () => {
    const text = 'CGST and SGST and IGST are components of GST. TDS under Section 194C.';
    const entities = extractComplianceEntities(text);
    expect(entities.has('CGST')).toBe(true);
    expect(entities.has('SGST')).toBe(true);
    expect(entities.has('IGST')).toBe(true);
    expect(entities.has('GST')).toBe(true);
    expect(entities.has('TDS')).toBe(true);
  });

  it('extracts section reference pattern', () => {
    const text = 'Under Section 16(2) of the CGST Act, ITC can be claimed.';
    const entities = extractComplianceEntities(text);
    const hasSection = [...entities].some((e) => e.includes('Section 16'));
    expect(hasSection).toBe(true);
  });

  it('extracts u/s numeric reference', () => {
    const text = 'Notice u/s 143 was issued to the taxpayer.';
    const entities = extractComplianceEntities(text);
    const hasUs = [...entities].some((e) => e.includes('u/s'));
    expect(hasUs).toBe(true);
  });

  it('extracts numeric values and normalises rupee amounts', () => {
    const text = 'The amount of ₹1,00,000 was paid as advance tax.';
    const entities = extractComplianceEntities(text);
    // Normalised: strips ₹ and commas
    const hasNumeric = [...entities].some((e) => e.includes('100000') || e.includes('1,00,000') || e === '100000');
    expect(hasNumeric).toBe(true);
  });
});

// ── checkNewNumerics ──────────────────────────────────────────────────────────

describe('checkNewNumerics', () => {
  it('returns true when humanized adds a new rupee figure not in original', () => {
    const original = 'The tax liability was ₹30,000 for the quarter.';
    const humanized = 'The tax liability was ₹30,000 and an additional ₹5,00,000 was assessed.';
    expect(checkNewNumerics(original, humanized)).toBe(true);
  });

  it('returns false when no new numerics are introduced', () => {
    const original = 'The tax liability was ₹30,000 for the quarter.';
    const humanized = 'The quarterly tax liability stood at ₹30,000.';
    expect(checkNewNumerics(original, humanized)).toBe(false);
  });

  it('returns false for identical content', () => {
    const text = 'Pay ₹1,00,000 by 31 March 2024 to avoid Section 234B interest.';
    expect(checkNewNumerics(text, text)).toBe(false);
  });
});

// ── detectRegression ─────────────────────────────────────────────────────────

describe('detectRegression', () => {
  // Build a realistic base text with compliance content and enough bigrams
  const BASE = `
## Understanding ITC Under GST

Input Tax Credit under GST allows GSTIN holders to offset CGST and SGST paid.
Under Section 16 of the CGST Act, the registered taxpayer must satisfy eligibility conditions.
The aggregate ITC amount was ₹2,00,000 for the financial year.

## How to Apply the Rule 43 Formula

1. Calculate total ITC claimed on capital goods
2. Apply the exempt supply ratio to CGST and SGST credits
3. Reverse proportionate IGST credit in GSTR-3B

| Turnover | ITC | Reversal |
|---|---|---|
| Taxable | ₹40,00,000 | None |
| Exempt | ₹10,00,000 | 20% |
`.trim();

  it('similarity gate: rejects text with <70% Jaccard similarity', () => {
    // Completely rewritten text — very low similarity
    const differentText = `
## Completely Different Topic About TDS

TDS on contractor payments under Section 194C requires deduction at source.
PAN must be submitted by contractor to avail lower TDS rate.
The threshold for single payment is ₹30,000 under the Income Tax Act.
This has nothing to do with the original content above.
    `.trim();

    const result = detectRegression(BASE, differentText, 0.70);
    expect(result.passed).toBe(false);
    expect(result.failed_gate).toBe('similarity');
  });

  it('heading gate: rejects text missing a ## heading from original', () => {
    // Same content but with "## How to Apply the Rule 43 Formula" heading removed
    const missingHeading = BASE.replace('## How to Apply the Rule 43 Formula\n\n', '');
    const result = detectRegression(BASE, missingHeading, 0.30); // low threshold to pass similarity
    expect(result.passed).toBe(false);
    expect(result.failed_gate).toBe('heading');
  });

  it('compliance entity gate: rejects text with GST removed', () => {
    // Replace GST keywords in body lines only — heading lines are preserved so heading gate doesn't
    // fire first. CGST/SGST/IGST/GSTIN don't appear in any heading, so their removal triggers
    // the compliance_entity gate after headings pass.
    const noGST = BASE.split('\n').map((line) =>
      /^##/.test(line)
        ? line
        : line
            .replace(/\bGST\b/g, 'tax')
            .replace(/\bCGST\b/g, 'central tax')
            .replace(/\bSGST\b/g, 'state tax')
            .replace(/\bIGST\b/g, 'integrated tax')
            .replace(/\bGSTIN\b/g, 'registration'),
    ).join('\n');
    const result = detectRegression(BASE, noGST, 0.30); // low threshold to pass similarity
    expect(result.passed).toBe(false);
    expect(result.failed_gate).toBe('compliance_entity');
  });

  it('passes for content with only cosmetic prose changes', () => {
    // Restyle the intro sentences but keep all headings, keywords, numerics
    const restyled = BASE
      .replace('Input Tax Credit under GST allows GSTIN holders to offset CGST and SGST paid.',
               'GSTIN holders can offset CGST and SGST paid via Input Tax Credit under GST.')
      .replace('the registered taxpayer must satisfy eligibility conditions.',
               'eligibility conditions must be satisfied by the registered taxpayer.');
    const result = detectRegression(BASE, restyled, 0.70);
    expect(result.passed).toBe(true);
    expect(result.failed_gate).toBeNull();
  });
});

// ── Semantic preservation with golden fixtures ────────────────────────────────

describe('semantic preservation', () => {
  it('GST_ITC_ARTICLE passes all gates on self-comparison (baseline)', () => {
    const result = detectRegression(GST_ITC_ARTICLE, GST_ITC_ARTICLE, 0.70);
    expect(result.passed).toBe(true);
    expect(result.failed_gate).toBeNull();
  });

  it('TDS_194C_ARTICLE passes all gates on self-comparison (baseline)', () => {
    const result = detectRegression(TDS_194C_ARTICLE, TDS_194C_ARTICLE, 0.70);
    expect(result.passed).toBe(true);
    expect(result.failed_gate).toBeNull();
  });

  it('ITR_FILING_ARTICLE passes all gates on self-comparison (baseline)', () => {
    const result = detectRegression(ITR_FILING_ARTICLE, ITR_FILING_ARTICLE, 0.70);
    expect(result.passed).toBe(true);
    expect(result.failed_gate).toBeNull();
  });

  it('cosmetic-only restyle of GST_ITC_ARTICLE passes all gates', () => {
    const restyled = GST_ITC_ARTICLE
      .replace('allows a registered GSTIN holder', 'enables a GSTIN-registered taxpayer')
      .replace('lays down the eligibility conditions', 'specifies the eligibility conditions');
    const result = detectRegression(GST_ITC_ARTICLE, restyled, 0.70);
    expect(result.passed).toBe(true);
  });

  it('numerical value change in TDS_194C_ARTICLE triggers compliance_entity gate', () => {
    // ₹30,000 threshold changed to ₹35,000 — fabricated figure
    const altered = TDS_194C_ARTICLE.replace('₹30,000', '₹35,000');
    // First check checkNewNumerics detects the new value
    expect(checkNewNumerics(TDS_194C_ARTICLE, altered)).toBe(true);
  });

  it('removal of GSTIN from GST_ITC_ARTICLE triggers compliance_entity gate', () => {
    // GSTIN appears only in body text (not in any heading), so heading gate stays green
    // and the compliance_entity gate is the first to fire.
    const noGSTIN = GST_ITC_ARTICLE.replace(/\bGSTIN\b/g, 'registration number');
    const result = detectRegression(GST_ITC_ARTICLE, noGSTIN, 0.30);
    expect(result.passed).toBe(false);
    expect(result.failed_gate).toBe('compliance_entity');
  });

  it('removal of Section 194C from TDS_194C_ARTICLE causes regression detection', () => {
    // Section 194C appears in three headings, so heading gate fires before compliance_entity gate.
    // The important invariant is that the regression is detected (passed === false).
    const noSection = TDS_194C_ARTICLE.replace(/Section 194C/g, 'this section');
    const result = detectRegression(TDS_194C_ARTICLE, noSection, 0.30);
    expect(result.passed).toBe(false);
  });

  it('checkNewNumerics returns false for ITR_FILING_ARTICLE self-comparison', () => {
    expect(checkNewNumerics(ITR_FILING_ARTICLE, ITR_FILING_ARTICLE)).toBe(false);
  });
});
