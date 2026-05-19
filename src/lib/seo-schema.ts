const BASE_URL = 'https://accountic.in';

interface ArticleFrontmatter {
  title?: string;
  description?: string;
  pubDate?: string;
  author?: string;
  slug?: string;
  pillar?: string;
}

export function generateArticleSchema(frontmatter: ArticleFrontmatter): string {
  const title = String(frontmatter.title ?? '');
  const description = String(frontmatter.description ?? '');
  const pubDate = String(frontmatter.pubDate ?? new Date().toISOString().slice(0, 10));
  const author = String(frontmatter.author ?? 'Accountic Team');
  const slug = String(frontmatter.slug ?? '');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: pubDate,
    author: {
      '@type': 'Person',
      name: author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Accountic',
      url: BASE_URL,
    },
    url: `${BASE_URL}/blog/${slug}/`,
  };

  return JSON.stringify(schema);
}

export function generateFAQSchema(content: string): string | null {
  // Only extract from exact ## FAQ or ## Frequently Asked Questions headings
  const faqSectionRe = /^## (?:FAQ|Frequently Asked Questions)\s*$/m;
  const sectionMatch = faqSectionRe.exec(content);
  if (!sectionMatch) return null;

  // Get content from this heading to the next ## heading (or end)
  const sectionStart = sectionMatch.index + sectionMatch[0].length;
  const nextH2 = content.indexOf('\n## ', sectionStart);
  const sectionContent = nextH2 === -1
    ? content.slice(sectionStart)
    : content.slice(sectionStart, nextH2);

  // Extract ### subheadings as questions, following paragraph as answer
  const pairs: Array<{ question: string; answer: string }> = [];
  const qRe = /^### (.+)$/m;
  const lines = sectionContent.split('\n');

  let i = 0;
  while (i < lines.length && pairs.length < 10) {
    const qMatch = qRe.exec(lines[i]);
    if (qMatch) {
      const question = qMatch[1].trim();
      // Collect paragraph lines after the heading (skip blank lines, stop at next heading)
      const answerLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('#')) {
        const line = lines[i].trim();
        if (line) answerLines.push(line);
        i++;
      }
      const answer = answerLines.join(' ').trim();
      if (question && answer) {
        pairs.push({ question, answer });
      }
    } else {
      i++;
    }
  }

  if (pairs.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  return JSON.stringify(schema);
}

export function generateBreadcrumbSchema(pillar: string, slug: string, title: string): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: pillar.charAt(0).toUpperCase() + pillar.slice(1),
        item: `${BASE_URL}/blog/?pillar=${encodeURIComponent(pillar)}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `${BASE_URL}/blog/${slug}/`,
      },
    ],
  };

  return JSON.stringify(schema);
}

export function buildSchemaScriptBlock(
  frontmatter: ArticleFrontmatter,
  content: string,
): string {
  const schemas: unknown[] = [];

  try { schemas.push(JSON.parse(generateArticleSchema(frontmatter))); } catch { /**/ }

  const faq = generateFAQSchema(content);
  if (faq) {
    try { schemas.push(JSON.parse(faq)); } catch { /**/ }
  }

  try {
    schemas.push(JSON.parse(generateBreadcrumbSchema(
      String(frontmatter.pillar ?? ''),
      String(frontmatter.slug ?? ''),
      String(frontmatter.title ?? ''),
    )));
  } catch { /**/ }

  if (schemas.length === 0) return '';

  // MDX parses `{` as a JSX expression — raw JSON inside a <script> tag breaks the build.
  // Use Astro's `set:html` directive with a template literal so the JSON is a valid JS
  // expression that acorn can parse, and Astro injects it as raw HTML at render time.
  // Escape backticks and template-literal `${` sequences that appear inside the JSON string.
  const jsonStr = JSON.stringify(schemas)
    .replace(/\\/g, '\\\\')   // escape existing backslashes first
    .replace(/`/g, '\\`')     // escape backticks
    .replace(/\$\{/g, '\\${'); // escape template-literal interpolations

  return `\n<script type="application/ld+json" set:html={\`${jsonStr}\`} />`;
}
