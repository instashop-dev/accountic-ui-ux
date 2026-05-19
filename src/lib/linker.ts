export interface InternalLink {
  slug: string;
  title: string;
  anchor: string;
}

interface PostRow {
  slug: string;
  title: string;
  pillar: string;
}

interface LinkFrontmatter {
  tags?: string[];
  pillar?: string;
}

export async function findInternalLinks(
  db: D1Database,
  frontmatter: LinkFrontmatter,
  currentSlug: string,
): Promise<InternalLink[]> {
  const pillar = frontmatter.pillar ?? '';
  const tags = frontmatter.tags ?? [];

  if (!pillar && tags.length === 0) return [];

  // Build WHERE clause: pillar match OR any tag appears in slug
  // Using parameterised LIKE for each tag is safest in D1
  const conditions: string[] = [];
  const params: string[] = [];

  if (pillar) {
    conditions.push('pillar = ?');
    params.push(pillar);
  }

  for (const tag of tags) {
    conditions.push('slug LIKE ?');
    params.push(`%${tag.toLowerCase().replace(/[%_]/g, '')}%`);
  }

  const where = conditions.join(' OR ');
  const query = `
    SELECT slug, title, pillar
    FROM posts
    WHERE (${where})
      AND slug != ?
      AND source IS NOT NULL
    ORDER BY pub_date DESC
    LIMIT 5
  `;

  params.push(currentSlug);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<PostRow>();

  return result.results.map((row) => ({
    slug: row.slug,
    title: row.title,
    anchor: row.pillar === pillar ? pillar : tags.find((t) => row.slug.includes(t.toLowerCase())) ?? row.title,
  }));
}

export function injectInternalLinks(content: string, links: InternalLink[]): string {
  if (links.length === 0) return content;

  // Split content into code-fence blocks and plain text segments
  // so we never modify content inside ``` fences
  const segments: Array<{ text: string; isCode: boolean }> = [];
  const codeFenceRe = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFenceRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), isCode: false });
    }
    segments.push({ text: match[0], isCode: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), isCode: false });
  }

  // For each link, inject into the first non-code segment containing an unlinked anchor
  for (const link of links) {
    // Escape anchor for use in regex
    const escapedAnchor = link.anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Matches the anchor word when NOT already inside [...](...) — negative lookbehind for ]
    // and not immediately followed by a closing ] that forms a link
    const anchorRe = new RegExp(`(?<!\\[)\\b(${escapedAnchor})\\b(?![^\\[]*\\])`, 'i');
    // Also skip if anchor is already wrapped as a link destination
    const alreadyLinked = new RegExp(`\\[${escapedAnchor}\\]`, 'i');

    let injected = false;
    for (let i = 0; i < segments.length && !injected; i++) {
      const seg = segments[i];
      if (seg.isCode) continue;
      if (alreadyLinked.test(seg.text)) continue;
      if (!anchorRe.test(seg.text)) continue;

      seg.text = seg.text.replace(anchorRe, `[$1](/blog/${link.slug}/)`);
      injected = true;
    }
  }

  return segments.map((s) => s.text).join('');
}
