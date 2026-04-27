// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://accountic.com',
  integrations: [mdx(), sitemap()],

  fonts: [
      {
          provider: fontProviders.google(),
          name: 'Inter',
          cssVariable: '--font-sans',
          fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
          weights: [300, 400, 500, 600, 700],
          styles: ['normal'],
      },
	],

  adapter: cloudflare(),
});