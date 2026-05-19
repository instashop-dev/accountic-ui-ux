import { describe, it, expect } from 'vitest';
import { toSlug } from './slug';

describe('toSlug', () => {
  it('converts mixed-case title with spaces to lowercase kebab', () => {
    expect(toSlug('How to Claim ITC Under GST')).toBe('how-to-claim-itc-under-gst');
  });

  it('replaces special characters with hyphens', () => {
    expect(toSlug('GST: Rules & Regulations (2025)')).toBe('gst-rules-regulations-2025');
  });

  it('collapses multiple consecutive hyphens to one', () => {
    expect(toSlug('TDS -- Section 194C')).toBe('tds-section-194c');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toSlug('  GST Guide  ')).toBe('gst-guide');
  });

  it('truncates to 60 characters and strips trailing hyphen from truncation', () => {
    const longTitle = 'A Very Long Title That Exceeds The Maximum Slug Length Of Sixty Characters For URL Safety';
    const slug = toSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });

  it('handles rupee and numeric characters', () => {
    const slug = toSlug('Section 16 ITC ₹1,00,000 Threshold');
    expect(slug).toBe('section-16-itc-1-00-000-threshold');
  });

  it('returns empty string for empty input', () => {
    expect(toSlug('')).toBe('');
  });
});
