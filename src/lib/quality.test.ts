import { describe, it, expect } from 'vitest';
import { scoreArticle } from './quality';

const VALID_FM = {
  title: 'TDS Under Section 194C',
  description: 'Complete guide to TDS on contractor payments.',
  pubDate: '2025-04-15',
  pillar: 'Faceless Assessment',
  author: 'Accountic Team',
  readTime: 6,
  tone: 'amber',
  featured: false,
};

// Article with a numbered 3-step workflow and readable prose — should pass quality gate
const READABLE_ARTICLE = `---
title: TDS Under Section 194C
description: Complete guide to TDS on contractor payments.
pubDate: 2025-04-15
pillar: Faceless Assessment
author: Accountic Team
readTime: 6
tone: amber
featured: false
---

## What is TDS Under Section 194C?

TDS on contractor payments is a statutory obligation. Every person paying a contractor must deduct tax at source. The rate varies based on whether the contractor is an individual or a company.

## Step-by-Step TDS Deduction Process

1. Verify the contractor has a valid PAN and obtain Form 15G or 15H if applicable
2. Check whether single payment or aggregate crosses the ₹30,000 or ₹1,00,000 threshold
3. Deduct TDS at 1% for individuals or 2% for companies at the time of payment

This ensures compliance with Section 194C of the Income Tax Act.
`;

// Dense article with no originality markers — should fail quality gate
const FAILING_ARTICLE = `---
title: TDS Under Section 194C
description: Complete guide to TDS on contractor payments.
pubDate: 2025-04-15
pillar: Faceless Assessment
author: Accountic Team
readTime: 6
tone: amber
featured: false
---

Supercalifragilisticexpialidocious. Antidisestablishmentarianism. Pseudopseudohypoparathyroidism. Floccinaucinihilipilification. Honorificabilitudinitatibus. Thyroparathyroidectomized. Dichlorodifluoromethane. Psychophysicotherapeutics. Hepaticocholangiogastrostomy. Spectrophotofluorometrically.
`;

describe('scoreArticle', () => {
  it('returns passed:true for readable article with originality markers', () => {
    const report = scoreArticle(READABLE_ARTICLE, VALID_FM);
    expect(report.scores.readability).toBeGreaterThanOrEqual(0);
    expect(report.scores.readability).toBeLessThanOrEqual(100);
    expect(report.scores.originality).toBe(true);
    expect(report.scores.schemaValid).toBe(true);
    expect(report.passed).toBe(true);
  });

  it('returns passed:false and readability error for dense unreadable content', () => {
    const report = scoreArticle(FAILING_ARTICLE, VALID_FM);
    // Dense polysyllabic words should score low on Flesch Reading Ease
    expect(report.scores.readability).toBeLessThan(70);
    expect(report.passed).toBe(false);
    expect(report.errors.some((e) => e.includes('Readability'))).toBe(true);
  });

  it('returns score within [0, 100] range', () => {
    const report = scoreArticle(READABLE_ARTICLE, VALID_FM);
    expect(report.scores.readability).toBeGreaterThanOrEqual(0);
    expect(report.scores.readability).toBeLessThanOrEqual(100);
  });

  it('fails with schema error for invalid frontmatter', () => {
    const badFm = { ...VALID_FM, pillar: 'InvalidPillar' };
    const report = scoreArticle(READABLE_ARTICLE, badFm);
    expect(report.scores.schemaValid).toBe(false);
  });
});
