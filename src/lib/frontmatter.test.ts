import { describe, it, expect } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses valid YAML frontmatter and returns data and content', () => {
    const raw = [
      '---',
      'title: GST ITC Guide',
      'pubDate: 2025-03-01',
      'featured: false',
      'readTime: 8',
      '---',
      '',
      '## Introduction',
      '',
      'Body content here.',
    ].join('\n');

    const { data, content } = parseFrontmatter(raw);
    expect(data.title).toBe('GST ITC Guide');
    expect(data.pubDate).toBe('2025-03-01');
    expect(data.featured).toBe(false);
    expect(data.readTime).toBe(8);
    expect(content).toContain('## Introduction');
    expect(content).not.toContain('---');
  });

  it('returns empty data and original raw content when no frontmatter fence present', () => {
    const raw = '## Heading\n\nNo frontmatter here.';
    const { data, content } = parseFrontmatter(raw);
    expect(data).toEqual({});
    expect(content).toBe(raw);
  });

  it('returns empty data when closing fence is missing', () => {
    const raw = '---\ntitle: Missing close\n## Body starts here';
    const { data, content } = parseFrontmatter(raw);
    expect(data).toEqual({});
    expect(content).toBe(raw);
  });

  it('handles boolean values correctly', () => {
    const raw = '---\nfeatured: true\ndraft: false\n---\nBody.';
    const { data } = parseFrontmatter(raw);
    expect(data.featured).toBe(true);
    expect(data.draft).toBe(false);
  });

  it('handles quoted string values with special characters', () => {
    const raw = "---\ndescription: 'A guide to GST: rules & regulations'\n---\nBody.";
    const { data } = parseFrontmatter(raw);
    expect(data.description).toBe('A guide to GST: rules & regulations');
  });
});

describe('serializeFrontmatter', () => {
  it('round-trips parse → serialize without data loss', () => {
    const raw = [
      '---',
      'title: TDS Section 194C',
      'readTime: 6',
      'featured: false',
      '---',
      '',
      'Content body.',
    ].join('\n');

    const { data, content } = parseFrontmatter(raw);
    const serialized = serializeFrontmatter(data, content);
    const { data: data2 } = parseFrontmatter(serialized);
    expect(data2.title).toBe(data.title);
    expect(data2.readTime).toBe(data.readTime);
    expect(data2.featured).toBe(data.featured);
  });
});
