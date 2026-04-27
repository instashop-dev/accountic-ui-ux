/**
 * Cloudflare Pages Function: POST /api/capture
 *
 * Accepts form submissions from the homepage CTA, contact page, and blog
 * subscribe forms, and forwards a notification email via Resend.
 *
 * Bindings expected (set in Cloudflare Pages → Settings → Environment variables,
 * and in `.dev.vars` for local `wrangler pages dev`):
 *
 *   RESEND_API_KEY      — Resend API key
 *   SIGNUP_NOTIFY_TO    — destination inbox (comma-separated allowed)
 *   SIGNUP_NOTIFY_FROM  — verified-domain sender, or onboarding@resend.dev for testing
 */

interface Env {
	RESEND_API_KEY: string;
	SIGNUP_NOTIFY_TO: string;
	SIGNUP_NOTIFY_FROM: string;
}

type Payload = {
	email?: unknown;
	source?: unknown;
	page?: unknown;
	name?: unknown;
	firm?: unknown;
	message?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.RESEND_API_KEY || !env.SIGNUP_NOTIFY_TO || !env.SIGNUP_NOTIFY_FROM) {
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

	const to = env.SIGNUP_NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean);

	const resendResp = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: env.SIGNUP_NOTIFY_FROM,
			to,
			reply_to: email,
			subject,
			text,
		}),
	});

	if (!resendResp.ok) {
		// Don't leak Resend's error body to the client; log it server-side
		// (Cloudflare → Pages → Logs).
		const detail = await resendResp.text().catch(() => '');
		console.error('Resend send failed', resendResp.status, detail);
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
