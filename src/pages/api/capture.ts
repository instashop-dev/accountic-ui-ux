/**
 * Astro server-side API route: POST /api/capture
 *
 * Accepts form submissions from the homepage CTA, contact page, and blog
 * subscribe forms, and forwards a notification email via the Cloudflare
 * `send_email` binding (Email Routing).
 *
 * Runs inside the Cloudflare Worker built by @astrojs/cloudflare.
 *
 * Bindings (wrangler.jsonc):
 *   SIGNUP_NOTIFY  — send_email binding pinned to info@accountic.in
 *
 * Env vars (Cloudflare → Workers → accountic-ui-ux → Settings → Variables,
 * and locally in `.dev.vars` for `wrangler dev`):
 *   SIGNUP_NOTIFY_FROM  — sender on a domain with Email Routing enabled
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';

export const prerender = false;

type Payload = {
	email?: unknown;
	source?: unknown;
	page?: unknown;
	name?: unknown;
	firm?: unknown;
	message?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTIFY_TO = 'info@accountic.in';

export const POST: APIRoute = async ({ request }) => {
	const e = env as Record<string, unknown>;
	const SIGNUP_NOTIFY_FROM = e.SIGNUP_NOTIFY_FROM as string | undefined;
	const SIGNUP_NOTIFY = e.SIGNUP_NOTIFY as { send: (msg: EmailMessage) => Promise<void> } | undefined;

	if (!SIGNUP_NOTIFY_FROM || !SIGNUP_NOTIFY) {
		return json({ error: 'Server misconfigured' }, 500);
	}

	let body: Payload;
	try {
		body = (await request.json()) as Payload;
	} catch {
		return json({ error: 'Invalid JSON' }, 400);
	}

	const email = str(body.email);
	if (!EMAIL_RE.test(email) || email.length > 254) {
		return json({ error: 'Invalid email' }, 400);
	}

	const source = str(body.source) || 'unknown';
	const page = str(body.page) || '/';
	const name = str(body.name);
	const firm = str(body.firm);
	const message = str(body.message);

	const subject = `[Accountic] New signup — ${source}`;

	const lines = [
		`Source: ${source}`,
		`Page:   ${page}`,
		`Email:  ${email}`,
	];
	if (name) lines.push(`Name:   ${name}`);
	if (firm) lines.push(`Firm:   ${firm}`);
	if (message) {
		lines.push('', '— Message —', message);
	}
	const text = lines.join('\n');

	const mime = createMimeMessage();
	mime.setSender({ name: 'Accountic Signups', addr: SIGNUP_NOTIFY_FROM });
	mime.setRecipient(NOTIFY_TO);
	mime.setSubject(subject);
	mime.setHeader('Reply-To', email);
	mime.addMessage({ contentType: 'text/plain', data: text });

	try {
		await SIGNUP_NOTIFY.send(new EmailMessage(SIGNUP_NOTIFY_FROM, NOTIFY_TO, mime.asRaw()));
	} catch (err) {
		console.error('send_email failed', err);
		return json({ error: 'Send failed' }, 502);
	}

	return json({ ok: true });
};

function str(v: unknown, max = 4000): string {
	if (typeof v !== 'string') return '';
	const trimmed = v.trim();
	return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
}
