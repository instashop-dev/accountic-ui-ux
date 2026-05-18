/**
 * Blog post frontmatter parsing and serialization.
 * Pure TypeScript — no astro:* imports. Safe to use in Workers and scripts.
 */

const FENCE = '---';

/**
 * Splits a markdown string into its YAML frontmatter and body content.
 * Returns `{ data: {}, content: raw }` when no frontmatter fence is present.
 */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
	const normalized = raw.replace(/\r\n/g, '\n');

	// Must start with ---
	if (!normalized.startsWith(FENCE + '\n') && normalized !== FENCE) {
		return { data: {}, content: raw };
	}

	const afterFirst = normalized.slice(FENCE.length + 1);
	const closingIndex = afterFirst.indexOf('\n' + FENCE);

	if (closingIndex === -1) {
		return { data: {}, content: raw };
	}

	const yamlBlock = afterFirst.slice(0, closingIndex);
	const body = afterFirst.slice(closingIndex + FENCE.length + 1);

	return {
		data: parseYaml(yamlBlock),
		content: body.startsWith('\n') ? body.slice(1) : body,
	};
}

/**
 * Serializes a data object and markdown body back into a fenced frontmatter string.
 */
export function serializeFrontmatter(data: Record<string, unknown>, content: string): string {
	const yaml = Object.entries(data)
		.map(([key, value]) => `${key}: ${yamlValue(value)}`)
		.join('\n');
	return `${FENCE}\n${yaml}\n${FENCE}\n${content}`;
}

// ── Minimal YAML parser (covers Astro blog frontmatter types only) ─────────────

function parseYaml(block: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const line of block.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const colonIdx = trimmed.indexOf(':');
		if (colonIdx === -1) continue;

		const key = trimmed.slice(0, colonIdx).trim();
		const raw = trimmed.slice(colonIdx + 1).trim();

		result[key] = parseScalar(raw);
	}

	return result;
}

function parseScalar(raw: string): unknown {
	if (raw === '' || raw === 'null' || raw === '~') return null;
	if (raw === 'true') return true;
	if (raw === 'false') return false;

	// Single-quoted string
	if (raw.startsWith("'") && raw.endsWith("'")) {
		return raw.slice(1, -1).replace(/''/g, "'");
	}
	// Double-quoted string
	if (raw.startsWith('"') && raw.endsWith('"')) {
		return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
	}

	// Number
	if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
	if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);

	// Unquoted string (dates, plain strings)
	return raw;
}

function yamlValue(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (typeof value === 'boolean') return String(value);
	if (typeof value === 'number') return String(value);
	if (value instanceof Date) return `'${value.toISOString().slice(0, 10)}'`;

	const str = String(value);
	// Quote if contains special chars or looks ambiguous
	const needsQuotes = /[:#\[\]{},|>&*!'"?@`]/.test(str) || str === 'true' || str === 'false' || /^\d/.test(str);
	if (needsQuotes) return `'${str.replace(/'/g, "''")}'`;
	return str;
}
