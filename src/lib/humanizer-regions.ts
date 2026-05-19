const LOCK_START = '<!-- HUMANIZER_LOCK_START -->';
const LOCK_END = '<!-- HUMANIZER_LOCK_END -->';

export interface ExtractedRegions {
  stripped: string;
  regions: string[];
}

export function extractLockedRegions(content: string): ExtractedRegions {
  const regions: string[] = [];
  let stripped = content;
  let index = 0;

  while (true) {
    const startIdx = stripped.indexOf(LOCK_START, index);
    if (startIdx === -1) break;

    const endIdx = stripped.indexOf(LOCK_END, startIdx + LOCK_START.length);
    if (endIdx === -1) break; // malformed — leave remainder untouched

    const regionContent = stripped.slice(startIdx, endIdx + LOCK_END.length);
    const placeholder = `__LOCKED_REGION_${regions.length}__`;
    regions.push(regionContent);

    stripped = stripped.slice(0, startIdx) + placeholder + stripped.slice(endIdx + LOCK_END.length);
    // Don't advance index — next search starts from same position (placeholder is shorter)
  }

  return { stripped, regions };
}

// Returns null if any placeholder is missing from content (signals Claude omitted it).
export function restoreLockedRegions(content: string, regions: string[]): string | null {
  let restored = content;
  for (let i = 0; i < regions.length; i++) {
    const placeholder = `__LOCKED_REGION_${i}__`;
    if (!restored.includes(placeholder)) return null;
    restored = restored.replace(placeholder, regions[i]);
  }
  return restored;
}
