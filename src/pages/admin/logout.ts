export const prerender = false;

import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  context.cookies.delete('admin_token', { path: '/admin' });
  return context.redirect('/admin/login');
}
