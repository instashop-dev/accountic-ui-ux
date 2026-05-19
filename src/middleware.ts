import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

const UNAUTHORIZED = JSON.stringify({ error: 'Unauthorized' });

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith('/admin/')) {
    return next();
  }

  const adminToken = (env as unknown as { ADMIN_TOKEN?: string }).ADMIN_TOKEN;

  const authHeader = context.request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!adminToken || token !== adminToken) {
    return new Response(UNAUTHORIZED, {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  return next();
});
