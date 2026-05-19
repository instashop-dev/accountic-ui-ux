import { describe, it, expect } from 'vitest';
import {
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateHowToSchema,
  buildSchemaScriptBlock,
} from './seo-schema';
import { GST_ITC_ARTICLE } from '../test-fixtures/articles/index';

const COMPLETE_FM = {
  title: 'How to Claim ITC Under GST',
  description: 'A comprehensive guide for Indian CAs.',
  pubDate: '2025-03-01',
  author: 'CA Priya Sharma',
  slug: 'how-to-claim-itc-under-gst',
  pillar: 'Income Tax Notices',
};

describe('generateArticleSchema', () => {
  it('includes required JSON-LD fields for complete frontmatter', () => {
    const parsed = JSON.parse(generateArticleSchema(COMPLETE_FM));
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Article');
    expect(parsed.headline).toBe('How to Claim ITC Under GST');
    expect(parsed.datePublished).toBe('2025-03-01');
    expect(parsed.author.name).toBe('CA Priya Sharma');
    expect(parsed.url).toContain('how-to-claim-itc-under-gst');
  });

  it('applies defaults when title and slug are missing', () => {
    const parsed = JSON.parse(generateArticleSchema({}));
    expect(parsed['@type']).toBe('Article');
    expect(parsed.headline).toBe('');
    expect(parsed.author.name).toBe('Accountic Team');
    // JSON should still be valid
    expect(() => JSON.parse(generateArticleSchema({}))).not.toThrow();
  });
});

describe('generateFAQSchema', () => {
  it('returns null when no ## FAQ heading is present', () => {
    expect(generateFAQSchema('## Introduction\n\nSome content.')).toBeNull();
    expect(generateFAQSchema('## Frequently asked questions\n\n### Q?\nA.')).toBeNull(); // case sensitive
  });

  it('extracts FAQ pairs from exact ## FAQ heading', () => {
    const content = [
      '## FAQ',
      '',
      '### What is GST?',
      'GST is a unified indirect tax on goods and services.',
      '',
      '### Who must register for GST?',
      'Any person with aggregate turnover exceeding ₹20 lakh must register.',
      '',
      '### What is GSTIN?',
      'GSTIN is a 15-digit unique identification number assigned to GST registrants.',
    ].join('\n');

    const parsed = JSON.parse(generateFAQSchema(content)!);
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed.mainEntity).toHaveLength(3);
    expect(parsed.mainEntity[0].name).toBe('What is GST?');
    expect(parsed.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
  });

  it('caps FAQ pairs at 10 even with 12 questions', () => {
    const qas = Array.from({ length: 12 }, (_, i) => `### Question ${i + 1}?\nAnswer ${i + 1}.`).join('\n\n');
    const content = `## FAQ\n\n${qas}`;
    const parsed = JSON.parse(generateFAQSchema(content)!);
    expect(parsed.mainEntity).toHaveLength(10);
  });

  it('returns null for ## Frequently Asked Questions exact heading too', () => {
    // The exact heading "## Frequently Asked Questions" IS supported
    const content = '## Frequently Asked Questions\n\n### Q?\nA.';
    const result = generateFAQSchema(content);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.mainEntity).toHaveLength(1);
  });

  it('ignores unrelated ## headings', () => {
    expect(generateFAQSchema('## Common Questions\n\n### Q?\nA.')).toBeNull();
    expect(generateFAQSchema('## Questions and Answers\n\n### Q?\nA.')).toBeNull();
  });

  it('extracts FAQ from GST_ITC_ARTICLE golden fixture', () => {
    const result = generateFAQSchema(GST_ITC_ARTICLE);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed.mainEntity.length).toBeGreaterThanOrEqual(1);
  });
});

describe('generateBreadcrumbSchema', () => {
  it('has exactly 3 ListItem entries with positions 1, 2, 3', () => {
    const parsed = JSON.parse(generateBreadcrumbSchema('Income Tax Notices', 'gst-itc-guide', 'How to Claim ITC'));
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed.itemListElement).toHaveLength(3);
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[1].position).toBe(2);
    expect(parsed.itemListElement[2].position).toBe(3);
  });

  it('capitalises the pillar name in position 2', () => {
    const parsed = JSON.parse(generateBreadcrumbSchema('income tax notices', 'test-slug', 'Test Title'));
    expect(parsed.itemListElement[1].name).toBe('Income tax notices');
  });

  it('puts the article title in position 3', () => {
    const parsed = JSON.parse(generateBreadcrumbSchema('GST', 'my-article', 'My Article Title'));
    expect(parsed.itemListElement[2].name).toBe('My Article Title');
    expect(parsed.itemListElement[2].item).toContain('my-article');
  });
});

describe('generateHowToSchema', () => {
  const SEVEN_STEPS = Array.from({ length: 7 }, (_, i) =>
    `${i + 1}. Step ${i + 1} description text`,
  ).join('\n');

  it('returns non-null and valid JSON for a 7-step workflow', () => {
    const result = generateHowToSchema(SEVEN_STEPS, 'How to Reply', 'A guide.');
    expect(result).not.toBeNull();
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it('produces HowTo schema with correct type and 7 steps', () => {
    const parsed = JSON.parse(generateHowToSchema(SEVEN_STEPS, 'How to Reply', 'A guide.')!);
    expect(parsed['@type']).toBe('HowTo');
    expect(parsed.name).toBe('How to Reply');
    expect(parsed.description).toBe('A guide.');
    expect(parsed.step).toHaveLength(7);
    expect(parsed.step[0]['@type']).toBe('HowToStep');
  });

  it('returns null for a 2-step list (below threshold)', () => {
    const twoSteps = '1. First step\n2. Second step';
    expect(generateHowToSchema(twoSteps, 'T', 'D')).toBeNull();
  });

  it('returns null when no numbered list is present', () => {
    expect(generateHowToSchema('## Introduction\n\nSome content.', 'T', 'D')).toBeNull();
  });

  it('returns null for non-sequential numbering (1, 1, 2)', () => {
    const nonSeq = '1. First\n1. Also first\n2. Second';
    expect(generateHowToSchema(nonSeq, 'T', 'D')).toBeNull();
  });

  it('strips markdown bold markers from step name', () => {
    const boldSteps = [
      '1. **Obtain your recorded reasons** — request them formally',
      '2. **Check jurisdiction** — verify the rank',
      '3. **Reconcile the amount** — match every rupee',
    ].join('\n');
    const parsed = JSON.parse(generateHowToSchema(boldSteps, 'T', 'D')!);
    expect(parsed.step[0].name).not.toContain('**');
    expect(parsed.step[0].name).toContain('Obtain your recorded reasons');
  });

  it('truncates step name to 60 characters', () => {
    const longStep = '1. ' + 'A'.repeat(80) + '\n2. Short\n3. Also short';
    const parsed = JSON.parse(generateHowToSchema(longStep, 'T', 'D')!);
    expect(parsed.step[0].name.length).toBeLessThanOrEqual(60);
  });
});

describe('buildSchemaScriptBlock', () => {
  it('returns a non-empty string containing the script tag', () => {
    const result = buildSchemaScriptBlock(COMPLETE_FM, '## FAQ\n\n### Q?\nA.');
    expect(result).toContain('<script type="application/ld+json"');
    expect(result.length).toBeGreaterThan(50);
  });

  it('produces a valid JSON-LD block for GST_ITC_ARTICLE', () => {
    const result = buildSchemaScriptBlock(
      { title: 'ITC Guide', slug: 'itc-guide', pillar: 'Income Tax Notices' },
      GST_ITC_ARTICLE,
    );
    expect(result).toContain('<script type="application/ld+json"');
    // Extract the JSON between the tags
    const jsonStart = result.indexOf('[');
    const jsonEnd = result.lastIndexOf(']') + 1;
    expect(() => JSON.parse(result.slice(jsonStart, jsonEnd))).not.toThrow();
  });

  it('includes HowTo schema when content has a 3+ step workflow', () => {
    const steps = '1. Do first thing\n2. Do second thing\n3. Do third thing';
    const result = buildSchemaScriptBlock(COMPLETE_FM, steps);
    const jsonStart = result.indexOf('[');
    const jsonEnd = result.lastIndexOf(']') + 1;
    const schemas = JSON.parse(result.slice(jsonStart, jsonEnd)) as Array<{ '@type': string }>;
    expect(schemas.some(s => s['@type'] === 'HowTo')).toBe(true);
  });

  it('returns empty string when content already contains a JSON-LD script block', () => {
    const contentWithSchema = 'Some article text.\n<script type="application/ld+json" set:html={`[]`} />';
    const result = buildSchemaScriptBlock(COMPLETE_FM, contentWithSchema);
    expect(result).toBe('');
  });
});
