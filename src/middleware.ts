import { defineMiddleware } from 'astro:middleware';

const ADMIN_PASSWORD = 'accounticadmin';
const UNAUTHORIZED = JSON.stringify({ error: 'Unauthorized' });

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith('/admin/')) {
    return next();
  }

  if (context.url.pathname === '/admin/login') {
    return next();
  }

  const authHeader = context.request.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cookieToken = context.cookies.get('admin_token')?.value ?? '';
  const token = bearerToken || cookieToken;

  if (token !== ADMIN_PASSWORD) {
    if (context.url.pathname.startsWith('/admin/api/')) {
      return new Response(UNAUTHORIZED, {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    return context.redirect('/admin/login');
  }

  return next();
});
