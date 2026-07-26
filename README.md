# Accountic — Marketing Website

The public marketing site for [Accountic](https://accountic.in), the AI workbench for Indian CA firms. Built with [Astro](https://astro.build) and deployed on Cloudflare.

The product itself lives at [app.accountic.in](https://app.accountic.in); this repository is the marketing/content site only (homepage, blog, legal, and contact pages) plus an admin-gated blog pipeline.

## 🚀 Project structure

```text
├── public/            # Static assets (favicon, robots.txt, og-default.png)
├── src/
│   ├── components/     # Shared Astro components (Header, Footer, BaseHead…)
│   ├── content/blog/   # Blog posts (.md / .mdx content collection)
│   ├── layouts/        # Page + BlogPost layouts
│   ├── pages/          # Routes (index, blog, legal, contact, admin, api)
│   ├── lib/            # Blog-pipeline + SEO helpers
│   └── styles/         # Global CSS + design tokens
├── astro.config.mjs
└── wrangler.jsonc
```

Pages are file-routed from `src/pages/`. Blog posts are a content collection under `src/content/blog/`, retrieved with `getCollection()` and typed against the schema in `src/content.config.ts`.

## 🧞 Commands

| Command             | Action                                        |
| :------------------ | :-------------------------------------------- |
| `npm install`       | Install dependencies                          |
| `npm run dev`       | Start the local dev server at `localhost:4321`|
| `npm run build`     | Build the production site to `./dist/`        |
| `npm run preview`   | Build and preview locally via Wrangler        |
| `npm run test`      | Run the Vitest suite                          |
| `npm run deploy`    | Build and deploy to Cloudflare                |

## Feeds & SEO

- Sitemap: `/sitemap-index.xml` (via `@astrojs/sitemap`)
- RSS feed: `/rss.xml`
- `robots.txt` and Open Graph image (`/og-default.png`) live in `public/`
- Canonical domain: `accountic.in`
