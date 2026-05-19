import { describe, it, expect } from 'vitest';
import { injectInternalLinks } from './linker';
import type { InternalLink } from './linker';

const links: InternalLink[] = [
  { slug: 'gst-itc-claim-procedure', title: 'How to Claim ITC', anchor: 'GST' },
  { slug: 'tds-194c-contractor', title: 'TDS Section 194C', anchor: 'TDS' },
];

describe('injectInternalLinks', () => {
  it('returns content unchanged when links array is empty', () => {
    const content = 'GST ITC claim is important for all taxpayers.';
    expect(injectInternalLinks(content, [])).toBe(content);
  });

  it('wraps first unlinked occurrence of anchor as Markdown link', () => {
    const content = 'Under the GST Act, registered taxpayers can claim ITC.';
    const result = injectInternalLinks(content, [links[0]]);
    expect(result).toContain('[GST](/blog/gst-itc-claim-procedure/)');
  });

  it('does not inject link when anchor appears only inside a fenced code block', () => {
    const content = 'Some text.\n\n```\nGST calculation example here\n```\n\nEnd.';
    const result = injectInternalLinks(content, [links[0]]);
    // Should not inject link inside the code block
    expect(result).not.toContain('[GST](/blog/');
  });

  it('does not double-link an already-linked anchor', () => {
    const content = 'The [GST](/blog/existing-gst-article/) rules apply here.';
    const result = injectInternalLinks(content, [links[0]]);
    // Should not create a nested link
    expect(result).toBe(content);
  });

  it('injects only the first occurrence of the anchor', () => {
    const content = 'GST is complex. TDS under GST rules applies differently.';
    const result = injectInternalLinks(content, [links[0]]);
    // Only one [GST] link should appear
    const matches = result.match(/\[GST\]/g);
    expect(matches).toHaveLength(1);
  });

  it('injects multiple different anchors from different links', () => {
    const content = 'Both GST and TDS compliance is critical for CAs.';
    const result = injectInternalLinks(content, links);
    expect(result).toContain('[GST](/blog/gst-itc-claim-procedure/)');
    expect(result).toContain('[TDS](/blog/tds-194c-contractor/)');
  });
});
