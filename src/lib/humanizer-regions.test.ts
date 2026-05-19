import { describe, it, expect } from 'vitest';
import { extractLockedRegions, restoreLockedRegions } from './humanizer-regions';
import { GST_ITC_ARTICLE } from '../test-fixtures/articles/index';

const LOCK_START = '<!-- HUMANIZER_LOCK_START -->';
const LOCK_END = '<!-- HUMANIZER_LOCK_END -->';

describe('extractLockedRegions', () => {
  it('returns content unchanged and empty regions when no lock tags present', () => {
    const input = 'No lock tags here. Just plain content.';
    const { stripped, regions } = extractLockedRegions(input);
    expect(stripped).toBe(input);
    expect(regions).toEqual([]);
  });

  it('replaces one locked region with __LOCKED_REGION_0__ placeholder', () => {
    const locked = `${LOCK_START}\nDo not modify this.\n${LOCK_END}`;
    const input = `Before content.\n${locked}\nAfter content.`;
    const { stripped, regions } = extractLockedRegions(input);
    expect(stripped).toContain('__LOCKED_REGION_0__');
    expect(stripped).not.toContain(LOCK_START);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toBe(locked);
  });

  it('replaces two locked regions with sequential placeholders', () => {
    const region0 = `${LOCK_START}\nFirst locked section.\n${LOCK_END}`;
    const region1 = `${LOCK_START}\nSecond locked section.\n${LOCK_END}`;
    const input = `Intro.\n${region0}\nMiddle.\n${region1}\nEnd.`;
    const { stripped, regions } = extractLockedRegions(input);
    expect(regions).toHaveLength(2);
    expect(stripped).toContain('__LOCKED_REGION_0__');
    expect(stripped).toContain('__LOCKED_REGION_1__');
    expect(regions[0]).toBe(region0);
    expect(regions[1]).toBe(region1);
  });

  it('leaves remainder untouched when LOCK_START has no matching LOCK_END', () => {
    const input = `Before.\n${LOCK_START}\nOrphaned start. After.`;
    const { stripped, regions } = extractLockedRegions(input);
    expect(regions).toHaveLength(0);
    expect(stripped).toBe(input);
  });

  it('handles compliance-heavy content (GST_ITC_ARTICLE) with two lock regions round-trip', () => {
    const { stripped, regions } = extractLockedRegions(GST_ITC_ARTICLE);
    // GST_ITC_ARTICLE has exactly two HUMANIZER_LOCK blocks
    expect(regions).toHaveLength(2);
    expect(stripped).not.toContain(LOCK_START);
    expect(stripped).toContain('__LOCKED_REGION_0__');
    expect(stripped).toContain('__LOCKED_REGION_1__');
  });
});

describe('restoreLockedRegions', () => {
  it('substitutes placeholder back to original locked content', () => {
    const locked = `${LOCK_START}\nLocked text.\n${LOCK_END}`;
    const content = `Intro __LOCKED_REGION_0__ Outro`;
    const restored = restoreLockedRegions(content, [locked]);
    expect(restored).toBe(`Intro ${locked} Outro`);
  });

  it('returns null when placeholder is missing from content', () => {
    const result = restoreLockedRegions('No placeholder here.', ['some locked content']);
    expect(result).toBeNull();
  });

  it('round-trip: extract then restore equals original exactly', () => {
    const input = `Before.\n${LOCK_START}\nLocked critical note.\n${LOCK_END}\nAfter.`;
    const { stripped, regions } = extractLockedRegions(input);
    const restored = restoreLockedRegions(stripped, regions);
    expect(restored).toBe(input);
  });

  it('round-trip is lossless on GST_ITC_ARTICLE with two locked regions', () => {
    const { stripped, regions } = extractLockedRegions(GST_ITC_ARTICLE);
    const restored = restoreLockedRegions(stripped, regions);
    expect(restored).toBe(GST_ITC_ARTICLE);
  });

  it('returns null if second placeholder is missing (partial corruption)', () => {
    const { stripped, regions } = extractLockedRegions(
      `A\n${LOCK_START}R0${LOCK_END}\nB\n${LOCK_START}R1${LOCK_END}\nC`,
    );
    // Remove the second placeholder to simulate Claude dropping it
    const corrupted = stripped.replace('__LOCKED_REGION_1__', '');
    expect(restoreLockedRegions(corrupted, regions)).toBeNull();
  });
});
