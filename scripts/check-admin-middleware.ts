#!/usr/bin/env tsx
// Pre-build safety check: admin pages must not exist without src/middleware.ts.
// Run via: npx tsx scripts/check-admin-middleware.ts
// Add to package.json "prebuild" script to enforce automatically.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const adminPagesDir = join(root, 'src', 'pages', 'admin');
const middlewarePath = join(root, 'src', 'middleware.ts');

const adminExists =
  existsSync(adminPagesDir) && readdirSync(adminPagesDir).length > 0;
const middlewareExists = existsSync(middlewarePath);

if (adminExists && !middlewareExists) {
  console.error(
    'ERROR: src/pages/admin/ contains files but src/middleware.ts is missing.',
  );
  console.error(
    'Admin pages would be publicly accessible without authentication. Create src/middleware.ts first.',
  );
  process.exit(1);
}

console.log('✓ Admin middleware check passed.');
