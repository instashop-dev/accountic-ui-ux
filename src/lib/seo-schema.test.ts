import { describe, it, expect } from 'vitest';
import {
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
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

describe('buildSchemaScriptBlock', () => {
  it('returns a non-empty string containing the script tag', () => {
    const result = buildSchemaScriptBlock(COMPLETE_FM, '## FAQ\n\n### Q?\nA.');
    expect(result).toContain('<script type="application/ld+json">');
    expect(result.length).toBeGreaterThan(50);
  });

  it('produces a valid JSON-LD block for GST_ITC_ARTICLE', () => {
    const result = buildSchemaScriptBlock(
      { title: 'ITC Guide', slug: 'itc-guide', pillar: 'Income Tax Notices' },
      GST_ITC_ARTICLE,
    );
    expect(result).toContain('<script type="application/ld+json">');
    // Extract the JSON between the tags
    const jsonStart = result.indexOf('[');
    const jsonEnd = result.lastIndexOf(']') + 1;
    expect(() => JSON.parse(result.slice(jsonStart, jsonEnd))).not.toThrow();
  });
});
